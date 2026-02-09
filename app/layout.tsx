import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { ThemeProvider } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mini Social — Connect Simply',
  description: 'A minimal social network for real friends.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
        <ThemeProvider>
          <Navbar />
          <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
            {children}
          </main>
          <footer className="max-w-2xl mx-auto px-3 sm:px-4 py-8 sm:py-12 text-center text-sm text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 mt-12 sm:mt-20">
            <div className="flex justify-center gap-4 sm:gap-6 mb-4">
              <a href="/legal/privacy" className="hover:text-blue-600 py-1">Privacy</a>
              <a href="/legal/terms" className="hover:text-blue-600 py-1">Terms</a>
              <a href="/legal/contact" className="hover:text-blue-600 py-1">Contact</a>
            </div>
            <p>&copy; 2026 Mini Social Network. Built for friends.</p>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
