import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

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
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="max-w-2xl mx-auto px-4 py-12 text-center text-sm text-gray-400 border-t border-gray-100 mt-20">
          <div className="flex justify-center gap-6 mb-4">
            <a href="/legal/privacy" className="hover:text-blue-600">Privacy</a>
            <a href="/legal/terms" className="hover:text-blue-600">Terms</a>
            <a href="/legal/contact" className="hover:text-blue-600">Contact</a>
          </div>
          <p>© 2026 Mini Social Network. Built for friends.</p>
        </footer>
      </body>
    </html>
  )
}
