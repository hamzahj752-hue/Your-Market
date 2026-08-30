import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const baseUrl =
  (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  let productUrls: string[] = [];
  let categoryUrls: string[] = [];

  try {
    const [productsRes, categoriesRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, created_at')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('categories')
        .select('name, slug')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
    ]);

    if (!productsRes.error && productsRes.data) {
      productUrls = productsRes.data.map((p) => `${baseUrl}/products/${p.id}`);
    }
    if (!categoriesRes.error && categoriesRes.data) {
      categoryUrls = categoriesRes.data
        .filter((c) => c.name)
        .map((c) => `${baseUrl}/products?category=${encodeURIComponent(c.name)}`);
    }
  } catch {
    // If the database query fails, fall back to core static URLs only so the
    // sitemap still resolves rather than erroring the whole route.
    productUrls = [];
    categoryUrls = [];
  }

  for (const url of [...productUrls, ...categoryUrls]) {
    entries.push({
      url,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  return entries;
}
