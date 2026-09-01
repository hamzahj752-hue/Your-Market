import { MetadataRoute } from 'next';

const baseUrl =
  (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') ||
  'https://your-market-nu.vercel.app';

// NOTE: robots.txt is SEO guidance only, not access control. RLS and admin
// authorization remain authoritative for protecting private data.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/products',
          '/products/',
          '/assets/',
          // Public product data endpoint (merchant feed) is crawlable so search
          // engines and feed processors can read it.
          '/api/merchant/',
        ],
        disallow: [
          '/admin/',
          '/account/',
          '/checkout',
          '/checkout/',
          '/cart',
          '/cart/',
          '/wishlist',
          '/wishlist/',
          // Private/administrative APIs only.
          '/api/admin/',
          '/api/',
          '/_next/',
          '/favicon.ico',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
