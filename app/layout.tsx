// app/layout.tsx
// Main layout configuration featuring Google Fonts: Inter, Playfair Display, DM Sans, and global client Providers

import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, DM_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['700', '800', '900'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Bridgr — Native USDC Bridge',
  description: 'The fastest, native way to move USDC to Arc Network with subsecond finality. Powered by Circle CCTP.',
  keywords: ['Bridgr', 'Arc Network', 'USDC Bridge', 'Circle CCTP', 'Crypto Bridge', 'Cross chain USDC', 'Defi', 'Asad Lee'],
  authors: [{ name: 'Asad Lee', url: 'https://asad-lee-portfolio.vercel.app' }],
  openGraph: {
    title: 'Bridgr — Native USDC Bridge',
    description: 'Move USDC to Arc Network instantly with subsecond deterministic finality using official Circle CCTP.',
    type: 'website',
    url: 'https://bridgr-usdc-bridge.vercel.app', // ⚠️ FLAG: update when new Vercel domain is assigned
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
      <body className={`${inter.variable} ${playfair.variable} ${dmSans.variable} font-body antialiased min-h-full flex flex-col`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
