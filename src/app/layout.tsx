import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { WishlistProvider } from '@/context/WishlistContext';
import { CartProvider } from '@/context/CartContext';
import MaintenanceGate from '@/components/MaintenanceGate';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  applicationName: 'Your Market',
  title: {
    default: 'Your Market — Everything You Need, One Place',
    template: '%s | Your Market',
  },
  description:
    'Your Market is your one-stop online marketplace for electronics, fashion, home goods, beauty, and more — fast shipping, trusted sellers, unbeatable prices.',
  keywords: [
    'online shopping',
    'Your Market',
    'electronics',
    'fashion',
    'home goods',
    'marketplace',
  ],
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Your Market',
    title: 'Your Market — One Place for Everything',
    description:
      'Shop millions of products across every category. Fast delivery, easy returns, trusted sellers.',
    images: [
      {
        url: '/assets/images/Online_shopping_choice-1787816570502.jpg',
        width: 1200,
        height: 630,
        alt: 'Your Market',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your Market — One Place for Everything',
    description:
      'Shop millions of products across every category. Fast delivery, easy returns, trusted sellers.',
    images: ['/assets/images/Online_shopping_choice-1787816570502.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className={plusJakartaSans.className}>
        <CartProvider>
          <WishlistProvider>
            <MaintenanceGate>{children}</MaintenanceGate>
          </WishlistProvider>
        </CartProvider>

        <script
          type="module"
          async
          src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fshopall5226back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20"
        />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" />
      </body>
    </html>
  );
}
