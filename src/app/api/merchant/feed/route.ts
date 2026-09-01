import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const baseUrl =
  (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') ||
  'https://your-market-nu.vercel.app';

/**
 * Global Merchant Center feed (XML).
 *
 * Reads real, active YourMarket products from Supabase using the public anon
 * client (products are publicly readable via RLS — no service-role key is ever
 * used or exposed). Returns a Google Shopping-compatible RSS 2.0 / g:feed so it
 * can be pasted into Google Merchant Center as a "Google Sheets / content API"
 * style weekly fetch, or re-submitted as an XML feed.
 *
 * Only real data is emitted: a product must have a name, an image and a valid
 * price to be included. Ratings/GTINs are only emitted when the source data
 * exists; nothing is fabricated.
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, name, description, price, image, alt, brand, sku, in_stock, stock_quantity, rating, reviews, category, original_price'
      )
      .eq('active', true);

    if (error) {
      return NextResponse.json({ error: 'Unable to read products.' }, { status: 502 });
    }

    const items = (data ?? [])
      .map((p) => {
        const name = typeof p.name === 'string' ? p.name.trim() : '';
        const image = typeof p.image === 'string' ? p.image.trim() : '';
        const price = Number(p.price);
        const hasValidPrice = Number.isFinite(price) && price >= 0;
        if (!name || !image || !hasValidPrice) return null;

        const link = `${baseUrl}/products/${encodeURIComponent(p.id)}`;

        const xml = ['<item>'];

        xml.push(`<g:id>${xmlEscape(String(p.id))}</g:id>`);
        xml.push(`<g:title>${xmlEscape(name)}</g:title>`);
        xml.push(`<g:link>${xmlEscape(link)}</g:link>`);
        xml.push(`<g:image_link>${xmlEscape(image)}</g:image_link>`);

        const description =
          typeof p.description === 'string' && p.description.trim() ? p.description.trim() : name;
        xml.push(`<g:description>${xmlEscape(description)}</g:description>`);

        const category =
          typeof p.category === 'string' && p.category.trim() ? p.category.trim() : '';
        if (category) xml.push(`<g:product_type>${xmlEscape(category)}</g:product_type>`);

        if (typeof p.brand === 'string' && p.brand.trim()) {
          xml.push(`<g:brand>${xmlEscape(p.brand.trim())}</g:brand>`);
        }

        xml.push(
          `<g:availability>${p.in_stock === true ? 'in stock' : 'out of stock'}</g:availability>`
        );
        xml.push(`<g:condition>new</g:condition>`);
        xml.push(`<g:price>${price.toFixed(2)} NPR</g:price>`);

        // Original price is a legitimate sale anchor when it exists and is higher.
        const originalPrice = Number(p.original_price);
        if (Number.isFinite(originalPrice) && originalPrice > price) {
          xml.push(`<g:sale_price>${price.toFixed(2)} NPR</g:sale_price>`);
          xml.push(`<g:price>${originalPrice.toFixed(2)} NPR</g:price>`);
        }

        // SKU emitted only when it actually exists on the product.
        if (typeof p.sku === 'string' && p.sku.trim()) {
          xml.push(`<g:sku>${xmlEscape(p.sku.trim())}</g:sku>`);
        }

        xml.push('</item>');
        return xml.join('\n');
      })
      .filter((item): item is string => Boolean(item));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Your Market</title>
    <link>${xmlEscape(baseUrl)}</link>
    <description>Your Market product feed for Google Merchant Center</description>
    ${items.join('\n')}
  </channel>
</rss>
`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to generate feed.' }, { status: 502 });
  }
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
