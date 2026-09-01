import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const baseUrl =
  (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') ||
  'https://your-market-nu.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: today,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: today,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  let productUrls: { url: string; modified: string | null }[] = [];
  let categoryUrls: string[] = [];

  try {
    const [productsRes, categoriesRes] = await Promise.all([
      supabase
        .from('products')
        .select('id')
        .eq('active', true)
        .order('name', { ascending: true })
        .limit(2000),
      supabase
        .from('categories')
        .select('name, slug')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
    ]);

    if (!productsRes.error && productsRes.data) {
      productUrls = productsRes.data.map((p) => ({
        url: `${baseUrl}/products/${p.id}`,
        modified: null,
      }));
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

  for (const { url, modified } of productUrls) {
    entries.push({
      url,
      lastModified: modified || today,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  for (const url of categoryUrls) {
    entries.push({
      url,
      lastModified: today,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  return entries;
}
