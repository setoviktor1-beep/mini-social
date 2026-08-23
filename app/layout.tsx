import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'
import { ThemeProvider } from './providers'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { I18nProvider } from '@/lib/i18n'
import SiteFooter from '@/components/SiteFooter'
import CookieNotice from '@/components/CookieNotice'

import AIFloatingLauncher from '@/components/ai/AIFloatingLauncher'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Pages depend on authenticated, request-scoped data.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'MiniSocial – bendrauk paprastai',
    template: '%s | Mini Social',
  },
  description: 'Paprastas socialinis tinklas tikram bendravimui.',
  applicationName: 'Mini Social',
  manifest: '/manifest.webmanifest',
  keywords: [
    'socialinis tinklas',
    'lietuviškas socialinis tinklas',
    'bendravimas',
    'diskusijos',
    'paslaugos',
    'meistrai',
    'Mini Social',
  ],
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'MiniSocial – bendrauk paprastai',
    description: 'Paprastas socialinis tinklas tikram bendravimui.',
    siteName: 'Mini Social',
  },
  twitter: {
    card: 'summary',
    title: 'MiniSocial – bendrauk paprastai',
    description: 'Paprastas socialinis tinklas tikram bendravimui.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt" suppressHydrationWarning>
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
          <SiteFooter />
          <BottomNav />
          <AIFloatingLauncher />
          <CookieNotice />
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
