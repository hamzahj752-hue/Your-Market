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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://your-market-nu.vercel.app'),
  applicationName: 'Your Market',
  title: {
    default: 'Your Market — Everything You Need, One Place',
    template: '%s | Your Market',
  },
  description:
    'Your Market is a local online storefront for electronics, fashion, home goods, beauty, and more, with cash on delivery.',
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
    title: 'Your Market — Shop Local, Pay on Delivery',
    description:
      'Browse electronics, fashion, home goods, beauty and more — order online and pay by cash on delivery.',
    images: [
      {
        url: '/assets/Online_shopping_choice.jpg',
        width: 1200,
        height: 630,
        alt: 'Your Market',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your Market — Shop Local, Pay on Delivery',
    description:
      'Browse electronics, fashion, home goods, beauty and more — order online and pay by cash on delivery.',
    images: ['/assets/Online_shopping_choice.jpg'],
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
      </body>
    </html>
  );
}
