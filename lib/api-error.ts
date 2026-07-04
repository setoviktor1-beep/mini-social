import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PAYMENT_REQUIRED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'MAPS_API_KEY_MISSING'
  | 'LOCATION_REQUIRED'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_API_ERROR';

export interface ApiErrorResponse {
  error: ApiErrorCode;
  message?: string;
  retryAfter?: number;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly retryAfter?: number;

  constructor(status: number, code: ApiErrorCode, message?: string, retryAfter?: number) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function isOperationalError(error: unknown): error is { status?: number; code?: string; message?: string; retryAfter?: number } {
  return typeof error === 'object' && error !== null && ('status' in error || 'code' in error);
}

export function createErrorResponse(code: ApiErrorCode, status: number, message?: string, retryAfter?: number) {
  const body: ApiErrorResponse = { error: code };
  if (message) body.message = message;
  if (retryAfter !== undefined) body.retryAfter = retryAfter;

  const headers: Record<string, string> = {};
  if (retryAfter !== undefined) headers['Retry-After'] = String(retryAfter);

  return NextResponse.json(body, { status, headers });
}

/**
 * Central API error handler.
 * Should be used as the final catch in every API route. It never leaks
 * unexpected error details to the client.
 */
export function handleApiError(
  error: unknown,
  options: { staleCache?: unknown; context?: string } = {}
): NextResponse {
  // 1. Return stale cache if available and caller supplies it
  if (options.staleCache) {
    return NextResponse.json(options.staleCache, {
      headers: { 'X-Cache': 'STALE' },
    });
  }

  // 2. Operational API errors
  if (error instanceof ApiError) {
    return createErrorResponse(error.code, error.status, error.message, error.retryAfter);
  }

  if (isOperationalError(error)) {
    const status = typeof error.status === 'number' ? error.status : 500;
    const code = (typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR') as ApiErrorCode;
    return createErrorResponse(code, status, error.message);
  }

  // 3. Unexpected errors: log, but never expose details to client
  const context = options.context || 'API route';
  if (error instanceof Error) {
    console.error(`[${context}] Unexpected error:`, error.message, error.stack);
  } else {
    console.error(`[${context}] Unexpected error:`, error);
  }

  return createErrorResponse('INTERNAL_ERROR', 500, 'Įvyko vidinė klaida. Bandykite vėliau.');
}

/**
 * Helper wrappers to keep route code concise.
 */
export function unauthorized(message = 'Autorizacija privaloma') {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function badRequest(message = 'Netinkamas užklausos formatas') {
  return new ApiError(400, 'BAD_REQUEST', message);
}

export function forbidden(message = 'Prieiga uždrausta') {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Objektas nerastas') {
  return new ApiError(404, 'NOT_FOUND', message);
}

export function rateLimited(retryAfter: number, message = 'Per daug užklausų. Bandykite vėliau.') {
  return new ApiError(429, 'RATE_LIMITED', message, retryAfter);
}

export function externalApiError(message = 'Išorinė API klaida') {
  return new ApiError(502, 'EXTERNAL_API_ERROR', message);
}

export function internalError(message = 'Vidinė serverio klaida') {
  return new ApiError(500, 'INTERNAL_ERROR', message);
}
