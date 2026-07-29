import {
  BackendQueryBuilder,
  BackendRpcBuilder,
  type QueryExecutor,
} from '@/lib/backend/query'
import { executePostgrest } from '@/lib/backend/postgrest'
import { getSession } from '@/lib/auth-session'
import {
  createDownloadUrl,
  deleteObject,
  getPublicObjectUrl,
  uploadObject,
} from '@/lib/object-storage'
import { getPool } from '@/lib/db'

function makeExecutor(service: boolean): QueryExecutor {
  let sessionPromise: ReturnType<typeof getSession> | undefined

  return async (spec) => {
    if (service) return executePostgrest(spec, { kind: 'service' })

    sessionPromise ||= getSession()
    const session = await sessionPromise
    return executePostgrest(
      spec,
      session?.user
        ? {
            kind: 'user',
            userId: session.user.id,
            email: session.user.email,
          }
        : { kind: 'anonymous' },
    )
  }
}

function serverStorageBucket(bucket: string) {
  return {
    getPublicUrl(path: string) {
      return { data: { publicUrl: getPublicObjectUrl(bucket, path) } }
    },
    async upload(
      path: string,
      body: Uint8Array | Buffer,
      options?: { contentType?: string; upsert?: boolean },
    ) {
      try {
        const data = await uploadObject(
          bucket,
          path,
          body,
          options?.contentType || 'application/octet-stream',
        )
        return { data, error: null }
      } catch (error) {
        return {
          data: null,
          error: {
            message: error instanceof Error ? error.message : 'UPLOAD_FAILED',
          },
        }
      }
    },
    async remove(paths: string[]) {
      try {
        await Promise.all(paths.map((path) => deleteObject(bucket, path)))
        return {
          data: paths.map((name) => ({ name })),
          error: null,
        }
      } catch (error) {
        return {
          data: null,
          error: {
            message: error instanceof Error ? error.message : 'DELETE_FAILED',
          },
        }
      }
    },
    async createSignedUrl(path: string, expiresIn: number) {
      try {
        const signedUrl = await createDownloadUrl(bucket, path)
        return { data: { signedUrl }, error: null }
      } catch (error) {
        return {
          data: null,
          error: {
            message:
              error instanceof Error ? error.message : 'SIGNING_FAILED',
          },
        }
      }
    },
  }
}

function createBackendClient(service: boolean) {
  const executor = makeExecutor(service)
  return {
    auth: {
      async getUser() {
        if (service) return { data: { user: null }, error: null }
        const session = await getSession()
        return {
          data: { user: session?.user || null },
          error: null,
        }
      },
      async getSession() {
        if (service) return { data: { session: null }, error: null }
        const session = await getSession()
        return { data: { session }, error: null }
      },
      admin: {
        async deleteUser(userId: string) {
          if (!service) {
            return {
              data: null,
              error: { message: 'SERVICE_ROLE_REQUIRED' },
            }
          }
          try {
            await getPool().query(
              'DELETE FROM "user" WHERE id = $1',
              [userId],
            )
            return { data: { user: null }, error: null }
          } catch (error) {
            return {
              data: null,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : 'DELETE_USER_FAILED',
              },
            }
          }
        },
      },
    },
    from: (table: string) => new BackendQueryBuilder(table, executor),
    rpc: (name: string, args?: Record<string, unknown>) =>
      new BackendRpcBuilder(name, args, executor),
    storage: { from: serverStorageBucket },
  }
}

export function createServerClient() {
  return createBackendClient(false)
}

export function createServiceClient() {
  return createBackendClient(true)
}

// Compatibility names while route handlers are migrated.
export const createClient = createServerClient
export const createSupabaseServerClient = createServerClient
export const createSupabaseServiceClient = createServiceClient
