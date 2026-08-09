import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mini-social.online'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const routes: Array<{
    path: string
    priority: number
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  }> = [
    { path: '/', priority: 1, changeFrequency: 'daily' },
    { path: '/pricing', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/services', priority: 0.8, changeFrequency: 'daily' },
    { path: '/discussions', priority: 0.7, changeFrequency: 'daily' },
    { path: '/search', priority: 0.5, changeFrequency: 'weekly' },
    { path: '/auth/register', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/auth/login', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/legal/cookies', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/legal/contact', priority: 0.4, changeFrequency: 'yearly' },
  ]

  return routes.map((route) => ({
    url: `${siteUrl}${route.path === '/' ? '' : route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
