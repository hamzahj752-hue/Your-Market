import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import ProductDetailsClient from './ProductDetailsClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

const baseUrl =
  (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') ||
  'https://your-market-nu.vercel.app';

interface ProductRow {
  name: string | null;
  description: string | null;
  image: string | null;
  alt: string | null;
  price: number | null;
  original_price?: number | null;
  sku?: string | null;
  brand?: string | null;
  rating?: number | null;
  reviews?: number | null;
  in_stock?: boolean | null;
  currency?: string | null;
  category?: string | null;
  video_url?: string | null;
}

/**
 * Loads one active public product for SEO purposes (metadata + JSON-LD).
 * Best-effort: any database error leaves the page fully functional with
 * generic metadata rather than crashing.
 */
async function loadProduct(id: string): Promise<ProductRow | null> {
  try {
    const { data } = await supabase
      .from('products')
      .select(
        'name, description, image, alt, price, original_price, sku, brand, rating, reviews, in_stock, category'
      )
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();
    return (data as ProductRow | null) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);

  const name = product?.name || '';
  const title = name || 'Product';
  const description =
    typeof product?.description === 'string' && product.description.trim()
      ? product.description.trim().slice(0, 160)
      : undefined;
  const image = typeof product?.image === 'string' ? product.image : '';
  const alt = typeof product?.alt === 'string' ? product.alt : name;

  const canonical = `${baseUrl}/products/${encodeURIComponent(id)}`;
  const ogImage = image
    ? { url: image, width: 1200, height: 630, alt: alt || title }
    : {
        url: `${baseUrl}/assets/images/Online_shopping_choice-1787816570502.jpg`,
        width: 1200,
        height: 630,
        alt: 'Your Market',
      };

  return {
    title: name || 'Product not found',
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [ogImage],
      siteName: 'Your Market',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

function escapeJsonLd(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds schema.org/Product JSON-LD using ONLY real product data.
 * Price, SKU, availability, description and brand are emitted only when they
 * actually exist. Rating/reviews are emitted only when both values are present
 * and positive (they are never invented). Returns null when no name is present.
 */
function buildProductJsonLd(product: ProductRow, id: string): Record<string, unknown> | null {
  const name = product?.name;
  if (!name) return null;

  const price = Number(product?.price);
  const hasPrice = Number.isFinite(price) && price >= 0;

  const productNode: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: escapeJsonLd(name),
    url: `${baseUrl}/products/${encodeURIComponent(id)}`,
    ...(typeof product.description === 'string' && product.description.trim()
      ? { description: escapeJsonLd(product.description.trim()) }
      : {}),
    ...(typeof product.image === 'string' && product.image ? { image: [product.image] } : {}),
    ...(product.brand && product.brand.trim()
      ? { brand: { '@type': 'Brand', name: escapeJsonLd(product.brand.trim()) } }
      : {}),
  };

  if (hasPrice) {
    const currency =
      product.currency && product.currency.trim()
        ? product.currency.trim().toUpperCase().slice(0, 3)
        : 'NPR';

    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      url: `${baseUrl}/products/${encodeURIComponent(id)}`,
      priceCurrency: currency,
      price,
      availability:
        product.in_stock === true ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    };

    if (product.sku && product.sku.trim()) {
      offer.sku = escapeJsonLd(product.sku.trim());
    }

    productNode.offers = offer;
  }

  // Aggregate rating only when real rating + review count data exists, is
  // positive and within the valid star range. Ratings are never fabricated.
  const rating = Number(product?.rating);
  const reviewCount = Number(product?.reviews);
  const hasRealRating =
    Number.isFinite(rating) &&
    rating > 0 &&
    rating <= 5 &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;

  if (hasRealRating) {
    productNode.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Math.round(rating * 10) / 10,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return productNode;
}

export default async function ProductDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const product = await loadProduct(id);

  const jsonLd = buildProductJsonLd(product ?? ({} as ProductRow), id);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailsClient id={id} />
    </>
  );
}
