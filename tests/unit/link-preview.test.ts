// Unit tests for lib/link-preview.ts.
//
// Run with: npx tsx --test tests/unit/link-preview.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  isBlockedIp,
  validateUrl,
  resolveSafeAddress,
  fetchOnce,
  parsePreview,
  sanitizeText,
  LinkPreviewError,
} from '../../lib/link-preview'

// --- SSRF address blocking ---------------------------------------------

test('isBlockedIp blocks loopback', () => {
  assert.equal(isBlockedIp('127.0.0.1'), true)
  assert.equal(isBlockedIp('127.255.255.254'), true)
});

test('isBlockedIp blocks RFC1918 private ranges', () => {
  assert.equal(isBlockedIp('10.0.0.1'), true)
  assert.equal(isBlockedIp('172.16.0.1'), true)
  assert.equal(isBlockedIp('172.31.255.255'), true)
  assert.equal(isBlockedIp('192.168.1.1'), true)
});

test('isBlockedIp blocks the cloud metadata / link-local range', () => {
  assert.equal(isBlockedIp('169.254.169.254'), true)
  assert.equal(isBlockedIp('169.254.0.1'), true)
});

test('isBlockedIp blocks CGNAT, documentation and reserved ranges', () => {
  assert.equal(isBlockedIp('100.64.0.1'), true)
  assert.equal(isBlockedIp('192.0.2.1'), true)
  assert.equal(isBlockedIp('198.51.100.1'), true)
  assert.equal(isBlockedIp('203.0.113.1'), true)
  assert.equal(isBlockedIp('240.0.0.1'), true)
  assert.equal(isBlockedIp('255.255.255.255'), true)
});

test('isBlockedIp allows public IPv4 addresses', () => {
  assert.equal(isBlockedIp('8.8.8.8'), false)
  assert.equal(isBlockedIp('1.1.1.1'), false)
});

test('isBlockedIp blocks IPv6 loopback and link-local/unique-local', () => {
  assert.equal(isBlockedIp('::1'), true)
  assert.equal(isBlockedIp('fe80::1'), true)
  assert.equal(isBlockedIp('fc00::1'), true)
  assert.equal(isBlockedIp('fd12:3456::1'), true)
});

test('isBlockedIp catches an IPv4-mapped IPv6 address used to smuggle a private target', () => {
  // ::ffff:169.254.169.254 is the cloud metadata address written as an
  // IPv4-mapped IPv6 literal — a classic SSRF-filter bypass attempt if the
  // embedded address isn't checked too.
  assert.equal(isBlockedIp('::ffff:169.254.169.254'), true)
  assert.equal(isBlockedIp('::ffff:10.0.0.1'), true)
});

test('isBlockedIp rejects non-IP input rather than guessing', () => {
  assert.equal(isBlockedIp('not-an-ip'), true)
  assert.equal(isBlockedIp(''), true)
});

// --- URL/scheme validation -----------------------------------------------

test('validateUrl accepts http and https', () => {
  assert.doesNotThrow(() => validateUrl('https://example.com/page'));
  assert.doesNotThrow(() => validateUrl('http://example.com/page'));
});

test('validateUrl rejects non-http(s) schemes', () => {
  assert.throws(() => validateUrl('file:///etc/passwd'), LinkPreviewError);
  assert.throws(() => validateUrl('ftp://example.com'), LinkPreviewError);
  assert.throws(() => validateUrl('gopher://example.com'), LinkPreviewError);
  assert.throws(() => validateUrl('javascript:alert(1)'), LinkPreviewError);
});

test('validateUrl rejects malformed input', () => {
  assert.throws(() => validateUrl('not a url'), LinkPreviewError);
});

// --- resolveSafeAddress: literal-IP hostnames -----------------------------

test('resolveSafeAddress rejects a literal loopback/private IP given as the hostname directly (no DNS needed to catch this)', async () => {
  await assert.rejects(() => resolveSafeAddress('127.0.0.1'), LinkPreviewError);
  await assert.rejects(() => resolveSafeAddress('169.254.169.254'), LinkPreviewError);
  await assert.rejects(() => resolveSafeAddress('192.168.1.1'), LinkPreviewError);
});

// --- fetchOnce: HTTP mechanics, tested against a local server ------------
//
// fetchOnce takes an already-validated/pinned address as a parameter — it
// does not itself decide whether an address is safe to connect to (that's
// resolveSafeAddress's job) — so exercising it directly against a local
// ephemeral server is the correct way to test redirect/size/content-type
// handling in isolation from the SSRF policy.

function withTestServer(handler: http.RequestListener, run: (port: number) => Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      run(port)
        .then(() => server.close(() => resolve()))
        .catch((err) => server.close(() => reject(err)))
    })
  })
}

test('fetchOnce returns a normal HTML response', async () => {
  await withTestServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<html><head><title>Hello</title></head></html>')
    },
    async (port) => {
      const url = new URL(`http://127.0.0.1:${port}/`)
      const result = await fetchOnce(url, '127.0.0.1')
      assert.equal(result.status, 200)
      assert.match(result.body.toString('utf-8'), /Hello/)
    },
  )
});

test('fetchOnce surfaces a redirect location without following it', async () => {
  await withTestServer(
    (req, res) => {
      res.writeHead(302, { Location: 'https://example.com/elsewhere' })
      res.end()
    },
    async (port) => {
      const url = new URL(`http://127.0.0.1:${port}/`)
      const result = await fetchOnce(url, '127.0.0.1')
      assert.equal(result.status, 302)
      assert.equal(result.finalUrl, 'https://example.com/elsewhere')
    },
  )
});

test('fetchOnce rejects a response whose Content-Length exceeds the size cap', async () => {
  await withTestServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': String(10 * 1024 * 1024) })
      res.end('<html></html>')
    },
    async (port) => {
      const url = new URL(`http://127.0.0.1:${port}/`)
      await assert.rejects(() => fetchOnce(url, '127.0.0.1'), /RESPONSE_TOO_LARGE/);
    },
  )
});

test('fetchOnce rejects a response whose actual body exceeds the size cap even if Content-Length under-reports it', async () => {
  await withTestServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' }); // no Content-Length — chunked
      const chunk = Buffer.alloc(1024 * 1024, 'a');
      const interval = setInterval(() => {
        res.write(chunk);
      }, 1);
      setTimeout(() => { clearInterval(interval); try { res.end(); } catch {} }, 500);
    },
    async (port) => {
      const url = new URL(`http://127.0.0.1:${port}/`)
      await assert.rejects(() => fetchOnce(url, '127.0.0.1'), /RESPONSE_TOO_LARGE/);
    },
  )
});

test('fetchOnce rejects a non-HTML content type', async () => {
  await withTestServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      res.end('binary-ish')
    },
    async (port) => {
      const url = new URL(`http://127.0.0.1:${port}/`)
      await assert.rejects(() => fetchOnce(url, '127.0.0.1'), /UNSUPPORTED_CONTENT_TYPE/);
    },
  )
});

// --- sanitization ----------------------------------------------------------

test('sanitizeText strips tags and decodes entities', () => {
  const result = sanitizeText('Hello <b>world</b> &amp; friends', 300)
  assert.equal(result, 'Hello world & friends')
});

test('sanitizeText truncates long text with an ellipsis', () => {
  const long = 'x'.repeat(400)
  const result = sanitizeText(long, 300)
  assert.equal(result?.length, 300)
  assert.equal(result?.endsWith('…'), true)
});

test('sanitizeText returns null for empty/whitespace-only input', () => {
  assert.equal(sanitizeText('   ', 300), null)
  assert.equal(sanitizeText(undefined, 300), null)
});

// --- parsePreview: OG tag extraction + image sanitization -----------------

test('parsePreview extracts og:title/og:description/og:image', () => {
  const html = `<html><head>
    <meta property="og:title" content="A Great Article">
    <meta property="og:description" content="Description &amp; details">
    <meta property="og:image" content="https://example.com/image.png">
  </head></html>`
  const result = parsePreview(html, 'https://example.com/article')
  assert.equal(result.title, 'A Great Article')
  assert.equal(result.description, 'Description & details')
  assert.equal(result.image, 'https://example.com/image.png')
});

test('parsePreview falls back to <title> and meta description when OG tags are absent', () => {
  const html = `<html><head><title>Plain Title</title><meta name="description" content="Plain desc"></head></html>`
  const result = parsePreview(html, 'https://example.com/article')
  assert.equal(result.title, 'Plain Title')
  assert.equal(result.description, 'Plain desc')
});

test('parsePreview resolves a relative og:image against the page URL', () => {
  const html = `<meta property="og:image" content="/images/preview.png">`
  const result = parsePreview(html, 'https://example.com/blog/post')
  assert.equal(result.image, 'https://example.com/images/preview.png')
});

test('parsePreview drops a non-http(s) og:image (e.g. a javascript: URL injection attempt)', () => {
  const html = `<meta property="og:image" content="javascript:alert(1)">`
  const result = parsePreview(html, 'https://example.com/')
  assert.equal(result.image, null)
});

test('parsePreview never lets HTML/script content survive into the sanitized fields', () => {
  const html = `<meta property="og:title" content="Title &lt;script&gt;alert(1)&lt;/script&gt; end">`
  const result = parsePreview(html, 'https://example.com/')
  assert.equal(result.title?.includes('<script>'), false)
});
