import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

export const runtime = 'edge';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Documentation System',
  description: 'Unified documentation management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black`}>
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}