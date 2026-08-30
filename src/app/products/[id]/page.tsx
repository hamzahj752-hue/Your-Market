import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import ProductDetailsClient from './ProductDetailsClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

const baseUrl =
  (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  let title = 'Product';
  let description = '';
  let image = '';
  let name = '';

  try {
    const { data } = await supabase
      .from('products')
      .select('name, description, image, alt')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      name = data.name || '';
      title = name;
      description =
        typeof data.description === 'string' && data.description.trim()
          ? data.description.trim().slice(0, 160)
          : '';
      image = typeof data.image === 'string' ? data.image : '';
    }
  } catch {
    // Leave defaults; product metadata is best-effort and must not crash the page.
  }

  const canonical = `${baseUrl}/products/${encodeURIComponent(id)}`;
  const ogImage = image
    ? { url: image, width: 1200, height: 630, alt: name || title }
    : {
        url: '/assets/images/Online_shopping_choice-1787816570502.jpg',
        width: 1200,
        height: 630,
        alt: 'Your Market',
      };

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: name || title,
      description,
      url: canonical,
      type: 'website',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: name || title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductDetailsPage({ params }: PageProps) {
  const { id } = await params;
  return <ProductDetailsClient id={id} />;
}
