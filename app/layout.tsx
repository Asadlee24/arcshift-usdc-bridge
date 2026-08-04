// app/layout.tsx
// Main layout configuration featuring Google Fonts Inter, SEO, and global client Providers

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Configure Google Fonts Inter
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Configure Viewport separately for Next.js standards
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// Production SEO-optimized metadata
export const metadata: Metadata = {
  title: 'ArcShift Premium Cross Chain USDC Bridge',
  description: 'The fastest, native way to move USDC to Arc Network with subsecond finality. Powered by Circle CCTP.',
  keywords: ['ArcShift', 'Arc Network', 'USDC Bridge', 'Circle CCTP', 'Crypto Bridge', 'Cross chain USDC', 'Defi', 'Asad Lee'],
  authors: [{ name: 'Asad Lee', url: 'https://asad-lee-portfolio.vercel.app' }],
  openGraph: {
    title: 'ArcShift Premium Cross Chain USDC Bridge',
    description: 'Move USDC to Arc Network instantly with subsecond deterministic finality using official Circle CCTP.',
    type: 'website',
    url: 'https://arcshift-usdc-bridge.vercel.app',
  },
  icons: {
    icon: '/favicon.ico',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} font-sans antialiased min-h-full flex flex-col`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
