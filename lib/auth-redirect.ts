export function normalizeNextPath(next: string | null | undefined, fallback = '/home') {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return fallback
  }

  if (next.startsWith('/auth/')) {
    return fallback
  }

  return next
}
