import { SignJWT } from 'jose'
import type {
  BackendError,
  BackendResult,
  QuerySpec,
} from '@/lib/backend/query'

type AccessContext =
  | { kind: 'user'; userId: string; email?: string }
  | { kind: 'service' }
  | { kind: 'anonymous' }

function getJwtSecret() {
  const value = process.env.POSTGREST_JWT_SECRET
  if (!value || value.length < 32) {
    throw new Error('POSTGREST_JWT_SECRET must be at least 32 characters')
  }
  return new TextEncoder().encode(value)
}

async function createAccessToken(context: AccessContext) {
  const now = Math.floor(Date.now() / 1000)
  const role =
    context.kind === 'service'
      ? 'service_role'
      : context.kind === 'user'
        ? 'authenticated'
        : 'anonymous'

  const token = new SignJWT({
    role,
    ...(context.kind === 'user'
      ? { sub: context.userId, email: context.email }
      : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + 60)

  return token.sign(getJwtSecret())
}

function makeUrl(spec: QuerySpec) {
  const baseURL = process.env.POSTGREST_URL
  if (!baseURL) throw new Error('POSTGREST_URL is required')

  const safePath = spec.table
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  const url = new URL(`${baseURL.replace(/\/$/, '')}/${safePath}`)

  if (spec.select) url.searchParams.set('select', spec.select)
  for (const [key, value] of spec.filters) {
    url.searchParams.append(key, value)
  }
  if (spec.order.length) {
    url.searchParams.set('order', spec.order.join(','))
  }
  if (spec.limit !== undefined) {
    url.searchParams.set('limit', String(spec.limit))
  }
  if (spec.offset !== undefined) {
    url.searchParams.set('offset', String(spec.offset))
  }
  if (spec.upsert?.onConflict) {
    url.searchParams.set('on_conflict', spec.upsert.onConflict)
  }

  return url
}

function parseCount(header: string | null) {
  if (!header) return null
  const match = header.match(/\/(\d+|\*)$/)
  if (!match || match[1] === '*') return null
  return Number(match[1])
}

function normalizeError(value: unknown, statusText: string): BackendError {
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return {
      message:
        typeof object.message === 'string' ? object.message : statusText,
      code: typeof object.code === 'string' ? object.code : undefined,
      details:
        typeof object.details === 'string' ? object.details : undefined,
      hint: typeof object.hint === 'string' ? object.hint : undefined,
    }
  }
  return { message: statusText }
}

export async function executePostgrest<T = unknown>(
  spec: QuerySpec,
  context: AccessContext,
): Promise<BackendResult<T>> {
  const token = await createAccessToken(context)
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  })

  const preferences = []
  if (spec.method !== 'GET') {
    headers.set('Content-Type', 'application/json')
    preferences.push(
      spec.select ? 'return=representation' : 'return=minimal',
    )
  }
  if (spec.count) preferences.push(`count=${spec.count}`)
  if (spec.upsert) {
    preferences.push(
      spec.upsert.ignoreDuplicates
        ? 'resolution=ignore-duplicates'
        : 'resolution=merge-duplicates',
    )
  }
  if (preferences.length) headers.set('Prefer', preferences.join(','))

  if (spec.single) {
    headers.set('Accept', 'application/vnd.pgrst.object+json')
  }

  const response = await fetch(makeUrl(spec), {
    method: spec.head ? 'HEAD' : spec.method,
    headers,
    body:
      spec.method === 'GET' || spec.head
        ? undefined
        : JSON.stringify(spec.body ?? {}),
    cache: 'no-store',
  })

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!response.ok) {
    if (
      spec.single === 'maybeSingle' &&
      (response.status === 404 || response.status === 406)
    ) {
      return {
        data: null,
        error: null,
        count: 0,
        status: 200,
        statusText: 'OK',
      }
    }

    return {
      data: null,
      error: normalizeError(parsed, response.statusText),
      count: parseCount(response.headers.get('content-range')),
      status: response.status,
      statusText: response.statusText,
    }
  }

  return {
    data: parsed as T,
    error: null,
    count: parseCount(response.headers.get('content-range')),
    status: response.status,
    statusText: response.statusText,
  }
}
