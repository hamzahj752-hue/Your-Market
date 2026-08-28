import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return [
    { url: `${baseUrl}/`, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/products`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/cart`, lastModified: new Date(), priority: 0.5 },
  ];
}