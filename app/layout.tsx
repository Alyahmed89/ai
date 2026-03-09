import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export const runtime = 'edge';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Graph Documentation System",
  description: "A minimal, clean UI for graph-based documentation and flow system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
