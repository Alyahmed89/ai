import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cloudflare D1 CRUD',
  description: 'CRUD interface for Cloudflare D1 database',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <div className="min-h-screen">
          <nav className="bg-white border-b border-gray-200">
            <div className="px-4">
              <div className="flex justify-between h-12">
                <div className="flex items-center">
                  <h1 className="text-lg font-medium text-gray-800">
                    Data Tables
                  </h1>
                </div>
                <div className="flex items-center space-x-2">
                  <a href="/" className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm">
                    Dashboard
                  </a>
                  <a href="/flows" className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm">
                    Flows
                  </a>
                  <a href="/tasks" className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm">
                    Tasks
                  </a>
                  <a href="/steps" className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm">
                    Steps
                  </a>
                  <a href="/data" className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm">
                    All Tables
                  </a>
                </div>
              </div>
            </div>
          </nav>
          <main className="p-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}