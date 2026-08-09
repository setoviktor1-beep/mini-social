// Server-side link-preview fetcher. Never called from the browser — see
// app/api/link-preview/route.ts, the only caller. The browser only ever
// sees the sanitized {url,title,description,image} JSON this returns.
//
// SSRF is the primary threat model here: a user posts a link, and if we
// naively `fetch()` whatever URL they give us, they can make this server
// issue requests to internal services, the cloud metadata endpoint,
// localhost-bound admin panels, etc. — and read the response back through
// the preview title/description. Every check below exists to close one
// specific variant of that.

import dns from 'node:dns'
import net from 'node:net'
import https from 'node:https'
import http from 'node:http'

const CONNECT_TIMEOUT_MS = 5000
const TOTAL_TIMEOUT_MS = 8000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // 2MB
const MAX_REDIRECTS = 3
const MAX_FIELD_LENGTH = 300
const MAX_DESCRIPTION_LENGTH = 500

export class LinkPreviewError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'LinkPreviewError'
  }
}

// --- SSRF guards -----------------------------------------------------------

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function inCidr4(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask)
}

// Blocks loopback, private (RFC1918), link-local/metadata, CGNAT,
// documentation/test, multicast, reserved and broadcast ranges.
const BLOCKED_V4_CIDRS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16', // includes the 169.254.169.254 cloud metadata endpoint
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
]

function isBlockedV4(ip: string): boolean {
  return BLOCKED_V4_CIDRS.some((cidr) => inCidr4(ip, cidr))
}

function isBlockedV6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // unique local fc00::/7
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true // link-local fe80::/10
  if (normalized.startsWith('ff')) return true // multicast ff00::/8
  if (normalized.startsWith('2001:db8:')) return true // documentation
  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) — validate the
  // embedded IPv4 address too, or these become a trivial bypass.
  const mappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mappedMatch) return isBlockedV4(mappedMatch[1])
  const nat64Match = normalized.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/)
  if (nat64Match) return isBlockedV4(nat64Match[1])
  return false
}

export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return isBlockedV4(ip)
  if (family === 6) return isBlockedV6(ip)
  return true // not a recognizable IP at all — refuse rather than guess
}

// Resolves a hostname and validates every returned address, returning the
// first safe one. Rejects outright if ANY resolved address is blocked
// (rather than just picking a safe one from a mixed result) — a hostname
// that resolves to both a public and an internal address is far more
// consistent with an attempted bypass than a legitimate multi-homed host.
async function resolveSafeAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new LinkPreviewError('BLOCKED_ADDRESS')
    return { address: hostname, family: net.isIP(hostname) as 4 | 6 }
  }

  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true })
  if (results.length === 0) throw new LinkPreviewError('DNS_RESOLUTION_FAILED')
  for (const result of results) {
    if (isBlockedIp(result.address)) throw new LinkPreviewError('BLOCKED_ADDRESS')
  }
  return { address: results[0].address, family: results[0].family as 4 | 6 }
}

function validateUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new LinkPreviewError('INVALID_URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new LinkPreviewError('UNSUPPORTED_PROTOCOL')
  }
  if (!url.hostname) throw new LinkPreviewError('INVALID_URL')
  return url
}

// --- fetch with a pinned, pre-validated address -----------------------------
//
// Resolving the hostname once for validation and then letting the HTTP
// client resolve it AGAIN to actually connect is a classic DNS-rebinding
// SSRF gap: the second lookup can legitimately return a different (and
// unsafe) address. To close it, the request is made with an explicit
// `lookup` override that always returns the address already validated
// above — the connection is pinned to that address — while the `Host`
// header and TLS SNI (`servername`) still use the real hostname, so
// virtual-hosting and certificate validation both work normally.

type FetchResult = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; finalUrl: string }

function fetchOnce(url: URL, pinnedAddress: string): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:'
    const transport = isHttps ? https : http
    const pinnedFamily = net.isIP(pinnedAddress) as 0 | 4 | 6
    // Node's connection logic (Happy Eyeballs / autoSelectFamily) can call
    // a custom `lookup` in two different shapes depending on Node version
    // and internal path taken: the classic single-address
    // (err, address, family) form, or — when it wants every candidate
    // address to try in sequence — (err, [{address, family}, ...]) via
    // `options.all`. Only the address we've already validated should ever
    // be handed back, in whichever shape was actually requested; the
    // single-form-only version of this caused a real
    // ERR_INVALID_IP_ADDRESS failure in testing once the request path hit
    // the array form.
    const pinnedLookup: net.LookupFunction = (_hostname, options, callback) => {
      const wantsAll = typeof options === 'object' && options !== null && 'all' in options && options.all
      if (typeof options === 'function') {
        const cb = options as (err: NodeJS.ErrnoException | null, address: string, family: number) => void
        cb(null, pinnedAddress, pinnedFamily)
        return
      }
      if (wantsAll) {
        ;(callback as (err: NodeJS.ErrnoException | null, addresses: { address: string; family: number }[]) => void)(null, [
          { address: pinnedAddress, family: pinnedFamily },
        ])
        return
      }
      callback(null, pinnedAddress, pinnedFamily)
    }

    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        lookup: pinnedLookup,
        servername: isHttps ? url.hostname : undefined,
        timeout: CONNECT_TIMEOUT_MS,
        headers: {
          Host: url.host,
          'User-Agent': 'MiniSocialLinkPreview/1.0 (+https://mini-social.online)',
          Accept: 'text/html,application/xhtml+xml',
          // Never forward the requesting user's cookies/auth/internal
          // headers to an arbitrary third-party URL.
        },
      },
      (response) => {
        const status = response.statusCode || 0
        const contentType = String(response.headers['content-type'] || '')
        const contentLength = Number(response.headers['content-length'] || 0)

        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume() // discard body, we're following the redirect
          resolve({ status, headers: response.headers, body: Buffer.alloc(0), finalUrl: response.headers.location })
          return
        }

        if (contentLength > MAX_RESPONSE_BYTES) {
          response.destroy()
          reject(new LinkPreviewError('RESPONSE_TOO_LARGE'))
          return
        }
        if (status === 200 && !/^text\/html|^application\/xhtml\+xml/i.test(contentType)) {
          response.resume()
          reject(new LinkPreviewError('UNSUPPORTED_CONTENT_TYPE'))
          return
        }

        const chunks: Buffer[] = []
        let received = 0
        response.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (received > MAX_RESPONSE_BYTES) {
            response.destroy()
            reject(new LinkPreviewError('RESPONSE_TOO_LARGE'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => {
          resolve({ status, headers: response.headers, body: Buffer.concat(chunks), finalUrl: url.toString() })
        })
        response.on('error', () => reject(new LinkPreviewError('FETCH_FAILED')))
      },
    )

    request.on('timeout', () => {
      request.destroy()
      reject(new LinkPreviewError('TIMEOUT'))
    })
    request.on('error', () => reject(new LinkPreviewError('FETCH_FAILED')))
    request.end()
  })
}

// --- sanitization ------------------------------------------------------------

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
}

// Plain-text only: decodes entities FIRST, then strips any tags, then
// collapses whitespace and truncates. Decoding must happen before
// tag-stripping, not after — otherwise an entity-encoded tag like
// "&lt;script&gt;" (which contains no literal '<' for the strip regex to
// match) survives stripping and only becomes "<script>" once decoded
// afterward, smuggling tag-shaped text through. This is never rendered as
// HTML on the client (React renders it as text content), but sanitizing
// in the correct order here means nothing HTML-shaped survives into the
// stored/cached value at all, regardless of how it's ever rendered.
function sanitizeText(raw: string | undefined, maxLength: number): string | null {
  if (!raw) return null
  const stripped = decodeHtmlEntities(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!stripped) return null
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength - 1)}…` : stripped
}

function extractMetaContent(html: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return undefined
}

function parsePreview(html: string, pageUrl: string) {
  // Only scan a bounded prefix — OG/meta tags are always in <head>, and
  // this keeps a pathological "one giant line" document from making the
  // regexes above do more work than necessary despite the byte cap already
  // applied to the whole response.
  const head = html.slice(0, 200_000)

  const ogTitle = extractMetaContent(head, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i,
  ])
  const titleTag = extractMetaContent(head, [/<title[^>]*>([^<]*)<\/title>/i])
  const ogDescription = extractMetaContent(head, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
  ])
  const metaDescription = extractMetaContent(head, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
  ])
  const ogImage = extractMetaContent(head, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i,
  ])

  const title = sanitizeText(ogTitle || titleTag, MAX_FIELD_LENGTH)
  const description = sanitizeText(ogDescription || metaDescription, MAX_DESCRIPTION_LENGTH)

  let image: string | null = null
  if (ogImage) {
    try {
      const resolved = new URL(ogImage, pageUrl)
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        image = resolved.toString()
      }
    } catch {
      // Malformed image URL — omit rather than fail the whole preview.
    }
  }

  return { title, description, image }
}

// --- public entry point ------------------------------------------------------

export interface LinkPreviewResult {
  url: string
  title: string | null
  description: string | null
  image: string | null
}

// Exported for direct unit testing only (see tests/unit/link-preview.test.ts).
// fetchOnce/parsePreview are pure HTTP-mechanics/parsing concerns separate
// from the SSRF policy in resolveSafeAddress/isBlockedIp — testing the full
// fetchLinkPreview() end-to-end against a local test server isn't possible
// without a real public hostname, since a local server is on a loopback
// address the SSRF guard correctly refuses to connect to.
export { fetchOnce, parsePreview, sanitizeText, validateUrl, resolveSafeAddress }

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewResult> {
  let currentUrl = validateUrl(rawUrl)
  const deadline = Date.now() + TOTAL_TIMEOUT_MS

  for (let redirectCount = 0; ; redirectCount++) {
    if (Date.now() > deadline) throw new LinkPreviewError('TIMEOUT')
    if (redirectCount > MAX_REDIRECTS) throw new LinkPreviewError('TOO_MANY_REDIRECTS')

    // Every redirect target is revalidated from scratch — scheme, then a
    // fresh DNS resolution and address check. A redirect chain is exactly
    // how an attacker turns an initially-safe URL into one that ends up
    // pointing at an internal address.
    const { address } = await resolveSafeAddress(currentUrl.hostname)
    const result = await fetchOnce(currentUrl, address)

    if (result.status >= 300 && result.status < 400) {
      currentUrl = validateUrl(new URL(result.finalUrl, currentUrl).toString())
      continue
    }

    if (result.status !== 200) {
      throw new LinkPreviewError('UPSTREAM_ERROR')
    }

    const html = result.body.toString('utf-8')
    const parsed = parsePreview(html, currentUrl.toString())
    return {
      url: currentUrl.toString(),
      title: parsed.title,
      description: parsed.description,
      image: parsed.image,
    }
  }
}
