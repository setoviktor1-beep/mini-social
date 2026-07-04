import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'
import { ThemeProvider } from './providers'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { I18nProvider } from '@/lib/i18n'

const inter = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'] })
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Prevent static prerender from failing when Supabase env vars are not
// available at build time. All routes rely on auth/session data anyway.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Mini Social - Connect Simply',
    template: '%s | Mini Social',
  },
  description: 'A minimal social network for real friends.',
  applicationName: 'Mini Social',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Mini Social - Connect Simply',
    description: 'A minimal social network for real friends.',
    siteName: 'Mini Social',
  },
  twitter: {
    card: 'summary',
    title: 'Mini Social - Connect Simply',
    description: 'A minimal social network for real friends.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#2563eb" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && systemDark) || (theme === 'system' && systemDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <I18nProvider>
        <ThemeProvider>
          <Navbar />
          <ServiceWorkerRegister />
          <main className="mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20 md:pb-8" style={{ maxWidth: 'var(--content-max)' }}>{children}</main>
          <footer className="mx-auto px-3 sm:px-4 py-8 sm:py-12 pb-24 md:pb-12 text-center text-sm text-[var(--text-secondary)] border-t border-[var(--border-subtle)] mt-12 sm:mt-20" style={{ maxWidth: 'var(--content-max)' }}>
            <div className="flex justify-center gap-4 sm:gap-6 mb-4">
              <a href="/legal/privacy" className="hover:text-blue-600 py-1">
                Privacy
              </a>
              <a href="/legal/terms" className="hover:text-blue-600 py-1">
                Terms
              </a>
              <a href="/legal/cookies" className="hover:text-blue-600 py-1">
                Cookies
              </a>
              <a href="/legal/contact" className="hover:text-blue-600 py-1">
                Contact
              </a>
            </div>
            <p>&copy; 2026 Mini Social Network. Built for friends.</p>
          </footer>
          <BottomNav />
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
