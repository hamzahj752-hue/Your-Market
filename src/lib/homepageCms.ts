import { supabase } from '@/lib/supabase';

export interface BriefProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  alt: string;
  category: string;
  rating: number;
  reviews: number;
  discount?: number;
  badge?: string;
  variant?: string;
  brand: string;
  inStock: boolean;
}

export interface BriefHero {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  cta_text: string | null;
  cta_url: string | null;
}

export interface BriefCategory {
  id: string;
  name: string;
  image: string | null;
  icon: string | null;
  slug: string | null;
}

export interface BriefDeal extends BriefProduct {
  dealTitle: string | null;
}

export interface BriefPromo {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  cta_text: string | null;
  cta_url: string | null;
}

export interface BriefTestimonial {
  id: string;
  customer_name: string;
  testimonial_text: string;
  customer_image_url: string | null;
  rating: number | null;
}

export interface BriefTrust {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
}

function toBriefProduct(p: Record<string, unknown>): BriefProduct {
  return {
    id: String(p.id),
    name: String(p.name ?? ''),
    price: Number(p.price ?? 0),
    originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
    image: String(p.image ?? ''),
    alt: String(p.alt ?? ''),
    category: String(p.category ?? ''),
    rating: Number(p.rating ?? 0),
    reviews: Number(p.reviews ?? 0),
    discount: p.discount != null ? Number(p.discount) : undefined,
    badge: p.badge != null ? String(p.badge) : undefined,
    variant: p.variant != null ? String(p.variant) : undefined,
    brand: String(p.brand ?? ''),
    inStock: Boolean(p.in_stock),
  };
}

// Returns active featured products joined with LIVE product data. Empty on
// error or when none configured so the caller can fall back to hard-coded UI.
export async function fetchFeaturedProducts(): Promise<BriefProduct[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_featured_products')
      .select('product_id, products(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return (data ?? [])
      .map((row) => row.products as unknown as Record<string, unknown> | undefined)
      .filter((p): p is Record<string, unknown> => !!p)
      .map(toBriefProduct);
  } catch {
    return [];
  }
}

// Returns active, in-window deals joined with LIVE product data.
export async function fetchDeals(): Promise<BriefDeal[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_deals')
      .select('title, products(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return (data ?? [])
      .map((row) => {
        const p = row.products as unknown as Record<string, unknown> | undefined;
        if (!p) return null;
        return {
          ...toBriefProduct(p),
          dealTitle: row.title != null ? String(row.title) : null,
        } as BriefDeal;
      })
      .filter((d): d is BriefDeal => !!d);
  } catch {
    return [];
  }
}

// Returns active homepage categories joined with live category records.
export async function fetchHomepageCategories(): Promise<BriefCategory[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_categories')
      .select('category_id, categories(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return (data ?? [])
      .map((row) => row.categories as unknown as Record<string, unknown> | undefined)
      .filter((c): c is Record<string, unknown> => !!c)
      .map((c) => ({
        id: String(c.id),
        name: String(c.name ?? ''),
        image: c.image != null ? String(c.image) : null,
        icon: c.icon != null ? String(c.icon) : null,
        slug: c.slug != null ? String(c.slug) : null,
      }));
  } catch {
    return [];
  }
}

export async function fetchHeroBanners(): Promise<BriefHero[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_hero_banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return (data ?? []) as BriefHero[];
  } catch {
    return [];
  }
}

export async function fetchPromoBanners(): Promise<BriefPromo[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_promotional_banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return (data ?? []) as BriefPromo[];
  } catch {
    return [];
  }
}

export async function fetchTestimonials(): Promise<BriefTestimonial[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_testimonials')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return (data ?? []) as BriefTestimonial[];
  } catch {
    return [];
  }
}

export async function fetchTrustItems(): Promise<BriefTrust[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_trust_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return [];
    return (data ?? []) as BriefTrust[];
  } catch {
    return [];
  }
}
