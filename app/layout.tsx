import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'
import { ThemeProvider } from './providers'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { I18nProvider } from '@/lib/i18n'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Pages depend on authenticated, request-scoped data.
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
      <body className="font-sans">
        <I18nProvider>
        <ThemeProvider>
          <Navbar />
          <ServiceWorkerRegister />
          <main className="mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20 md:pb-8" style={{ maxWidth: 'var(--content-max)' }}>{children}</main>
          <footer className="mx-auto px-3 sm:px-4 py-8 sm:py-12 pb-24 md:pb-12 text-center text-sm text-slate-500 border-t border-slate-200 mt-12 sm:mt-20 bg-white/50 backdrop-blur-sm" style={{ maxWidth: 'var(--content-max)' }}>
            <div className="flex justify-center gap-4 sm:gap-6 mb-4">
              <a href="/legal/privacy" className="hover:text-blue-600 py-1 transition-colors">
                Privacy
              </a>
              <a href="/legal/terms" className="hover:text-blue-600 py-1 transition-colors">
                Terms
              </a>
              <a href="/legal/cookies" className="hover:text-blue-600 py-1 transition-colors">
                Cookies
              </a>
              <a href="/legal/contact" className="hover:text-blue-600 py-1 transition-colors">
                Contact
              </a>
            </div>
            <p className="text-slate-400">&copy; 2026 Mini Social Network. Built for friends.</p>
          </footer>
          <BottomNav />
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
