import { MetadataRoute } from 'next';

const baseUrl =
  (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

// NOTE: robots.txt is SEO guidance only, not access control. RLS and admin
// authorization remain authoritative for protecting private data.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/products', '/products/', '/assets/'],
        disallow: [
          '/admin/',
          '/account/',
          '/checkout',
          '/wishlist',
          '/api/',
          '/_next/',
          '/favicon.ico',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
