import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import bcrypt from 'bcryptjs'
import { getPool } from '@/lib/db'
import { sendEmail } from '@/lib/email'

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.APP_URL ||
  'http://localhost:3000'

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
)

function makeUsername(name: string, email: string, id: string) {
  const source = name || email.split('@')[0] || 'user'
  const slug = source
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)

  return `${slug || 'user'}_${id.replaceAll('-', '').slice(0, 8)}`
}

export const auth = betterAuth({
  appName: 'Mini Social',
  baseURL,
  secret:
    process.env.BETTER_AUTH_SECRET ||
    (process.env.NEXT_PHASE === 'phase-production-build'
      ? 'build-only-secret-with-at-least-32-characters'
      : undefined),
  database: getPool(),
  trustedOrigins: [
    baseURL,
    'https://mini-social.online',
    'https://www.mini-social.online',
    ...(process.env.AUTH_TRUSTED_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) || []),
  ],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification:
      process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true',
    revokeSessionsOnPasswordReset: true,
    password: {
      // Supabase Auth stores bcrypt hashes. Keeping bcrypt here preserves
      // migrated passwords without ever handling plaintext credentials.
      hash: (password) => bcrypt.hash(password, 12),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Atkurkite „Mini Social“ slaptažodį',
        text: `Slaptažodį galite atkurti čia: ${url}`,
        html: `<p>Slaptažodį galite atkurti paspaudę šią nuorodą:</p><p><a href="${url}">${url}</a></p>`,
      })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Patvirtinkite „Mini Social“ el. paštą',
        text: `El. paštą galite patvirtinti čia: ${url}`,
        html: `<p>El. paštą galite patvirtinti paspaudę šią nuorodą:</p><p><a href="${url}">${url}</a></p>`,
      })
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: 'select_account',
        },
      }
    : {},
  user: {
    additionalFields: {
      userMetadata: {
        type: 'json',
        required: false,
        input: false,
      },
      appMetadata: {
        type: 'json',
        required: false,
        input: false,
      },
      invitedAt: {
        type: 'date',
        required: false,
        input: false,
      },
      lastSignInAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const username = makeUsername(user.name, user.email, user.id)
          await getPool().query(
            `INSERT INTO profiles (id, username, display_name)
             VALUES ($1::uuid, $2, $3)
             ON CONFLICT (id) DO NOTHING`,
            [user.id, username, user.name || username],
          )
        },
      },
    },
  },
  advanced: {
    database: {
      generateId: 'uuid',
    },
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
