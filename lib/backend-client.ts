'use client'

import { authClient } from '@/lib/auth-client'
import { io, type Socket } from 'socket.io-client'
import {
  BackendQueryBuilder,
  BackendRpcBuilder,
  type BackendResult,
  type QueryExecutor,
} from '@/lib/backend/query'

const AUTH_EVENT = 'mini-social-auth-change'
let realtimeSocket: Socket | null = null

type RealtimeHandler = {
  event: string
  schema?: string
  table?: string
  filter?: string
  callback: (payload: any) => void
}

function getRealtimeSocket() {
  if (!realtimeSocket) {
    realtimeSocket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
  }
  return realtimeSocket
}

function realtimeChannel(name: string) {
  const handlers: RealtimeHandler[] = []
  let listener: ((payload: any) => void) | null = null

  const channel = {
    on(
      _kind: string,
      config: {
        event?: string
        schema?: string
        table?: string
        filter?: string
      },
      callback: (payload: any) => void,
    ) {
      handlers.push({
        event: config.event || '*',
        schema: config.schema,
        table: config.table,
        filter: config.filter,
        callback,
      })
      return channel
    },
    subscribe(callback?: (status: string) => void) {
      const socket = getRealtimeSocket()
      listener = (payload: any) => {
        for (const handler of handlers) {
          if (
            handler.event !== '*' &&
            handler.event !== payload.eventType
          ) continue
          if (handler.table && handler.table !== payload.table) continue

          if (handler.filter) {
            const match = /^([A-Za-z0-9_]+)=eq\.(.+)$/.exec(handler.filter)
            const row = payload.new || payload.old || {}
            if (match && String(row[match[1]]) !== match[2]) continue
          }
          handler.callback(payload)
        }
      }
      socket.on('db-change', listener)
      socket.emit('subscribe', { name, handlers })
      callback?.('SUBSCRIBED')
      return channel
    },
    __unsubscribe() {
      const socket = getRealtimeSocket()
      if (listener) socket.off('db-change', listener)
      socket.emit('unsubscribe', { name })
    },
  }
  return channel
}

function authEvent(event: string, session: unknown = null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(AUTH_EVENT, { detail: { event, session } }),
    )
  }
}

const execute: QueryExecutor = async (spec) => {
  const response = await fetch('/api/data/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec),
    cache: 'no-store',
  })

  const value = await response.json().catch(() => null)
  if (value && typeof value === 'object' && 'error' in value) {
    return value as BackendResult
  }

  return {
    data: null,
    error: { message: response.statusText || 'REQUEST_FAILED' },
    count: null,
    status: response.status,
    statusText: response.statusText,
  }
}

function storageBucket(bucket: string) {
  return {
    getPublicUrl(path: string) {
      const baseURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL
      return {
        data: {
          publicUrl: baseURL
            ? `${baseURL.replace(/\/$/, '')}/${bucket}/${encodeURI(path)}`
            : '',
        },
      }
    },
    async upload(
      path: string,
      file: Blob,
      options?: { contentType?: string; upsert?: boolean },
    ) {
      try {
        const contentType =
          options?.contentType || file.type || 'application/octet-stream'
        const params = new URLSearchParams({ bucket, path })
        const upload = await fetch(`/api/storage/upload?${params}`, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(file.size),
          },
          body: file,
        })
        if (!upload.ok) {
          const result = await upload.json().catch(() => null)
          return {
            data: null,
            error: {
              message:
                result?.error || upload.statusText || 'UPLOAD_FAILED',
            },
          }
        }
        return { data: { path }, error: null }
      } catch (error) {
        return {
          data: null,
          error: {
            message:
              error instanceof Error ? error.message : 'UPLOAD_FAILED',
          },
        }
      }
    },
    async remove(paths: string[]) {
      const response = await fetch('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, paths }),
      })
      return response.ok
        ? { data: paths.map((name) => ({ name })), error: null }
        : {
            data: null,
            error: { message: (await response.json()).error },
          }
    },
  }
}

function browserAuth() {
  return {
    async getUser() {
      const result = await authClient.getSession()
      const user = result.data?.user
        ? {
            ...result.data.user,
            user_metadata:
              (result.data.user as any).userMetadata || {},
          }
        : null
      return {
        data: { user },
        error: result.error
          ? { message: result.error.message || 'AUTH_ERROR' }
          : null,
      }
    },
    async getSession() {
      const result = await authClient.getSession()
      const session = result.data
        ? {
            ...result.data,
            user: {
              ...result.data.user,
              user_metadata:
                (result.data.user as any).userMetadata || {},
            },
          }
        : null
      return {
        data: { session },
        error: result.error
          ? { message: result.error.message || 'AUTH_ERROR' }
          : null,
      }
    },
    async signInWithPassword(credentials: {
      email: string
      password: string
    }) {
      const result = await authClient.signIn.email(credentials)
      if (result.data) authEvent('SIGNED_IN', result.data)
      return {
        data: result.data,
        error: result.error
          ? { message: result.error.message || 'LOGIN_FAILED' }
          : null,
      }
    },
    async signUp(input: {
      email: string
      password: string
      options?: { data?: Record<string, unknown>; emailRedirectTo?: string }
    }) {
      const name =
        (input.options?.data?.display_name as string | undefined) ||
        (input.options?.data?.full_name as string | undefined) ||
        input.email.split('@')[0]
      const result = await authClient.signUp.email({
        email: input.email,
        password: input.password,
        name,
        callbackURL: input.options?.emailRedirectTo,
      })
      if (result.data) authEvent('SIGNED_IN', result.data)
      return {
        data: {
          user: result.data?.user || null,
          session: result.data?.token ? result.data : null,
        },
        error: result.error
          ? { message: result.error.message || 'SIGNUP_FAILED' }
          : null,
      }
    },
    async signInWithOAuth(input: {
      provider: string
      options?: { redirectTo?: string }
    }) {
      const result = await authClient.signIn.social({
        provider: input.provider as 'google',
        callbackURL: input.options?.redirectTo || '/',
      })
      return {
        data: result.data,
        error: result.error
          ? { message: result.error.message || 'OAUTH_FAILED' }
          : null,
      }
    },
    async resetPasswordForEmail(
      email: string,
      options?: { redirectTo?: string },
    ) {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: options?.redirectTo || '/auth/reset-password',
      })
      return {
        data: result.data,
        error: result.error
          ? { message: result.error.message || 'RESET_FAILED' }
          : null,
      }
    },
    async resend(input: {
      email: string
      options?: { emailRedirectTo?: string }
    }) {
      const result = await authClient.sendVerificationEmail({
        email: input.email,
        callbackURL: input.options?.emailRedirectTo,
      })
      return {
        data: result.data,
        error: result.error
          ? { message: result.error.message || 'RESEND_FAILED' }
          : null,
      }
    },
    async resetPassword(input: { password: string; token: string }) {
      const result = await authClient.resetPassword({
        newPassword: input.password,
        token: input.token,
      })
      return {
        data: result.data,
        error: result.error
          ? { message: result.error.message || 'RESET_FAILED' }
          : null,
      }
    },
    async changePassword(input: {
      currentPassword: string
      newPassword: string
      revokeOtherSessions?: boolean
    }) {
      const result = await authClient.changePassword({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: input.revokeOtherSessions ?? true,
      })
      return {
        data: result.data,
        error: result.error
          ? { message: result.error.message || 'PASSWORD_CHANGE_FAILED' }
          : null,
      }
    },
    async updateUser(input: {
      data?: Record<string, unknown>
      name?: string
      image?: string | null
    }) {
      const result = await authClient.updateUser({
        name:
          input.name ||
          (input.data?.display_name as string | undefined) ||
          undefined,
        image:
          input.image ??
          (input.data?.avatar_url as string | undefined) ??
          undefined,
      })
      return {
        data: result.data,
        error: result.error
          ? { message: result.error.message || 'UPDATE_FAILED' }
          : null,
      }
    },
    async signOut() {
      const result = await authClient.signOut()
      if (!result.error) authEvent('SIGNED_OUT')
      return {
        error: result.error
          ? { message: result.error.message || 'SIGNOUT_FAILED' }
          : null,
      }
    },
    onAuthStateChange(
      callback: (event: string, session: any) => void,
    ) {
      const listener = (event: Event) => {
        const detail = (event as CustomEvent).detail
        callback(detail?.event || 'SIGNED_IN', detail?.session || null)
      }
      window.addEventListener(AUTH_EVENT, listener)
      return {
        data: {
          subscription: {
            unsubscribe: () =>
              window.removeEventListener(AUTH_EVENT, listener),
          },
        },
      }
    },
  }
}

export function createClient() {
  return {
    auth: browserAuth(),
    from: (table: string) => new BackendQueryBuilder(table, execute),
    rpc: (name: string, args?: Record<string, unknown>) =>
      new BackendRpcBuilder(name, args, execute),
    storage: { from: storageBucket },
    channel: realtimeChannel,
    removeChannel(channel: ReturnType<typeof realtimeChannel>) {
      channel.__unsubscribe()
      return Promise.resolve('ok')
    },
  }
}
