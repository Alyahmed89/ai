import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ultra Minimal Next.js App",
  description: "A clean, minimal Next.js starting point",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
          body {
            margin: 0;
            padding: 0;
            font-family: ${inter.style.fontFamily}, system-ui, -apple-system, sans-serif;
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
