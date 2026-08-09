import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mini-social.online'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard',
          '/settings',
          '/messages',
          '/notifications',
          '/wallet',
          '/my-orders',
          '/moderation',
          '/pro/',
          '/invite/',
          '/auth/callback',
          '/auth/auth-code-error',
          '/auth/reset-password',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
