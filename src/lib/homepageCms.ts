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
  /** True when the admin manually marked the product Sold Out (products.sold_out). */
  soldOut?: boolean;
  /** True when the product has at least one active variant row. Homewide cards
      use this to decide whether Buy Now can order directly or must first ask
      for a variant selection. */
  hasVariants?: boolean;
  /** True when the product belongs to the Food flow (products.food_category_id
      set). Food items Buy Now through the dedicated Food checkout. */
  isFood?: boolean;
  /** Per-product Card Image Appearance (products.card_image_*). Optional —
      legacy rows fall back to the canonical default (contain, 100%, centered). */
  cardImageFit?: 'cover' | 'contain';
  cardImageScale?: number;
  cardImageX?: number;
  cardImageY?: number;
}

export interface BriefHero {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  cta_text: string | null;
  cta_url: string | null;
  image_fit?: 'cover' | 'contain';
  image_scale?: number;
  image_position_x?: number;
  image_position_y?: number;
  foreground_image_url?: string | null;
  foreground_scale?: number;
  foreground_position_x?: number;
  foreground_position_y?: number;
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
  image_fit?: 'cover' | 'contain';
  image_scale?: number;
  image_position_x?: number;
  image_position_y?: number;
  foreground_image_url?: string | null;
  foreground_scale?: number;
  foreground_position_x?: number;
  foreground_position_y?: number;
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
    inStock: Boolean(p.in_stock) && p.sold_out !== true,
    soldOut: p.sold_out === true,
    isFood: p.food_category_id != null && p.food_category_id !== '',
    cardImageFit:
      p.card_image_fit === 'cover' || p.card_image_fit === 'contain' ? p.card_image_fit : undefined,
    cardImageScale:
      p.card_image_scale != null && Number.isFinite(Number(p.card_image_scale))
        ? Number(p.card_image_scale)
        : undefined,
    cardImageX:
      p.card_image_position_x != null && Number.isFinite(Number(p.card_image_position_x))
        ? Number(p.card_image_position_x)
        : undefined,
    cardImageY:
      p.card_image_position_y != null && Number.isFinite(Number(p.card_image_position_y))
        ? Number(p.card_image_position_y)
        : undefined,
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

// Fills any category still missing an image with a real active product image
// from that category. Single batched query reuse (no N+1); category-level or
// section artwork is always preferred, a product image is only ever used so a
// card never renders a blank box.
async function attachCategoryImageFallback(categories: BriefCategory[]): Promise<BriefCategory[]> {
  const missingImage = categories.filter((c) => !c.image).map((c) => c.name);
  if (missingImage.length === 0) return categories;

  // Single query: one image per category, reusing the existing product image
  // field. Only products that actually have an image are candidates.
  const { data: productRows, error: productError } = await supabase
    .from('products')
    .select('category, image')
    .eq('active', true)
    .not('image', 'is', null)
    .neq('image', '');

  if (productError || !productRows) return categories;

  const fallbackMap = new Map<string, string>();
  for (const p of productRows) {
    const name = String(p.category ?? '');
    const img = String(p.image ?? '');
    if (img && !fallbackMap.has(name)) {
      fallbackMap.set(name, img);
    }
  }

  return categories.map((c) => ({
    ...c,
    image: c.image || fallbackMap.get(c.name) || null,
  }));
}

// Returns active homepage categories joined with live category records, falling
// back to a real active product image per category when the category itself has
// no image. The product lookup is a SINGLE batched query (no N+1).
export async function fetchHomepageCategories(): Promise<BriefCategory[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_categories')
      .select('category_id, categories(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return [];

    const categories = (data ?? [])
      .map((row) => row.categories as unknown as Record<string, unknown> | undefined)
      .filter((c): c is Record<string, unknown> => !!c)
      .map((c) => ({
        id: String(c.id),
        name: String(c.name ?? ''),
        image: c.image != null ? String(c.image) : null,
        icon: c.icon != null ? String(c.icon) : null,
        slug: c.slug != null ? String(c.slug) : null,
      }));

    return attachCategoryImageFallback(categories);
  } catch {
    return [];
  }
}

export interface BriefFoodCategory {
  id: string;
  name: string;
  slug: string | null;
  image: string | null;
  notice: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface FoodSection {
  /** Whole-section ON/OFF from store_settings (default equivalent: off). */
  enabled: boolean;
  /** Admin-configured section heading (defaults to "Food"). */
  title: string;
  /** Active categories featured in the section, in admin order. */
  items: BriefFoodCategory[];
}

/** Build the customer-facing href for a food category card. */
export function foodCategoryHref(cat: { slug?: string | null; name?: string | null }): string {
  if (cat.slug) return `/${cat.slug}page/all${cat.slug}`;
  return `/products?category=${encodeURIComponent(cat.name ?? '')}`;
}

// Returns the admin-managed homepage "Food" section plus its category items.
// The section is OFF by default so callers render nothing. Items now come from
// the independent homepage_food_categories columns (name/slug/image/notice),
// with a fallback to the legacy category_id → categories join when the
// migration (20260907160000) has not yet been applied.
export async function fetchFoodSection(): Promise<FoodSection> {
  const off: FoodSection = { enabled: false, title: 'Food', items: [] };
  try {
    const { data: settings, error: settingsError } = await supabase
      .from('store_settings')
      .select('food_section_enabled, food_section_title')
      .limit(1)
      .maybeSingle();
    if (settingsError || !settings) return off;
    const title =
      settings.food_section_title != null ? String(settings.food_section_title) : 'Food';
    const enabled =
      settings.food_section_enabled != null ? Boolean(settings.food_section_enabled) : false;
    if (!enabled) return { enabled, title, items: [] };

    // Try the new independent columns first (migration 20260907160000 applied).
    const { data, error } = await supabase
      .from('homepage_food_categories')
      .select('id, name, slug, image, notice, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!error && data && data.length > 0 && 'name' in data[0]) {
      const items: BriefFoodCategory[] = data.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        slug: row.slug != null ? String(row.slug) : null,
        image: row.image != null ? String(row.image) : null,
        notice: row.notice != null ? String(row.notice) : null,
        sortOrder: Number(row.sort_order ?? 0),
        isActive: Boolean(row.is_active),
      }));
      return { enabled, title, items };
    }

    // Fallback: legacy join through category_id → categories (migration not applied yet).
    const { data: legacyData, error: legacyError } = await supabase
      .from('homepage_food_categories')
      .select('image, category_id, categories(id, name, image, icon, slug)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (legacyError || !legacyData) return { enabled, title, items: [] };

    const legacyItems: BriefFoodCategory[] = legacyData
      .map((row) => {
        const cat = row.categories as unknown as Record<string, unknown> | undefined;
        if (!cat) return null;
        const artwork = row.image != null ? String(row.image) : '';
        return {
          id: String(cat.id),
          name: String(cat.name ?? ''),
          slug: cat.slug != null ? String(cat.slug) : null,
          image: artwork || (cat.image != null ? String(cat.image) : null),
          notice: null,
          sortOrder: 0,
          isActive: true,
        };
      })
      .filter((c): c is BriefFoodCategory => !!c);

    return { enabled, title, items: legacyItems };
  } catch {
    return off;
  }
}

// All active food categories for the /food discovery page.
export async function fetchFoodCategories(): Promise<BriefFoodCategory[]> {
  try {
    // Try new independent columns first.
    const { data, error } = await supabase
      .from('homepage_food_categories')
      .select('id, name, slug, image, notice, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (!error && data && data.length > 0 && 'name' in data[0]) {
      return data.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        slug: row.slug != null ? String(row.slug) : null,
        image: row.image != null ? String(row.image) : null,
        notice: row.notice != null ? String(row.notice) : null,
        sortOrder: Number(row.sort_order ?? 0),
        isActive: Boolean(row.is_active),
      }));
    }
    // Fallback: legacy join.
    const { data: legacyData } = await supabase
      .from('homepage_food_categories')
      .select('image, categories(id, name, image, slug)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (!legacyData) return [];
    return legacyData
      .map((row) => {
        const cat = row.categories as unknown as Record<string, unknown> | undefined;
        if (!cat) return null;
        return {
          id: String(cat.id),
          name: String(cat.name ?? ''),
          slug: cat.slug != null ? String(cat.slug) : null,
          image:
            (row.image != null ? String(row.image) : null) ||
            (cat.image != null ? String(cat.image) : null),
          notice: null,
          sortOrder: 0,
          isActive: true,
        };
      })
      .filter((c): c is BriefFoodCategory => !!c);
  } catch {
    return [];
  }
}

// Fetch a single food category by slug from the independent table.
export async function fetchFoodCategoryBySlug(slug: string): Promise<BriefFoodCategory | null> {
  try {
    const { data, error } = await supabase
      .from('homepage_food_categories')
      .select('id, name, slug, image, notice, sort_order, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data || !('name' in data)) return null;
    return {
      id: String(data.id),
      name: String(data.name ?? ''),
      slug: data.slug != null ? String(data.slug) : null,
      image: data.image != null ? String(data.image) : null,
      notice: data.notice != null ? String(data.notice) : null,
      sortOrder: Number(data.sort_order ?? 0),
      isActive: Boolean(data.is_active),
    };
  } catch {
    return null;
  }
}

// Fetch active products linked to a food category via products.food_category_id.
// On any error we return an honest empty list — never the whole catalog — so a
// category page can never accidentally show products from other categories.
export async function fetchFoodCategoryProducts(
  categoryId: string,
  limit = 48
): Promise<BriefProduct[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        'id,name,price,original_price,image,alt,category,rating,reviews,discount,badge,variant,brand,in_stock,sold_out,food_category_id,card_image_fit,card_image_scale,card_image_position_x,card_image_position_y'
      )
      .eq('food_category_id', categoryId)
      .eq('active', true)
      .limit(limit);
    if (error) {
      // card_image_* columns come from an unapplied migration; retry with the
      // legacy column list instead of failing the whole listing.
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('products')
        .select(
          'id,name,price,original_price,image,alt,category,rating,reviews,discount,badge,variant,brand,in_stock,sold_out,food_category_id'
        )
        .eq('food_category_id', categoryId)
        .eq('active', true)
        .limit(limit);
      if (fallbackError) return [];
      const fallbackRows = (fallbackData as Array<Record<string, unknown>> | null) ?? [];
      return fallbackRows.map((p) => toBriefProduct(p));
    }
    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    return rows.map((p) => toBriefProduct(p));
  } catch {
    return [];
  }
}

// Returns active storefront products for the customer "All Products" sections
// (Home and Product Details) using the same canonical mapping as the rest of
// the storefront. Accepts a limit so a large catalog doesn't send an unbounded
// payload just to fill a listing section. Empty on error so callers can render
// a safe empty state.
export async function fetchAllProducts(limit = 24): Promise<BriefProduct[]> {
  try {
    const { data: firstData, error } = await supabase
      .from('products')
      .select(
        'id,name,price,original_price,image,alt,category,rating,reviews,discount,badge,variant,brand,in_stock,sold_out,food_category_id,card_image_fit,card_image_scale,card_image_position_x,card_image_position_y'
      )
      .eq('active', true)
      .limit(limit);
    let rows = (firstData as Array<Record<string, unknown>> | null) ?? [];
    if (error) {
      // sold_out AND card_image_* are added by migrations that may not be
      // applied to the live database yet; retry with progressively smaller
      // legacy column lists instead of failing.
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('products')
        .select(
          'id,name,price,original_price,image,alt,category,rating,reviews,discount,badge,variant,brand,in_stock,sold_out,food_category_id'
        )
        .eq('active', true)
        .limit(limit);
      if (!fallbackError) {
        rows = (fallbackData as Array<Record<string, unknown>> | null) ?? [];
      } else {
        const { data: legacyData, error: legacyError } = await supabase
          .from('products')
          .select(
            'id,name,price,original_price,image,alt,category,rating,reviews,discount,badge,variant,brand,in_stock'
          )
          .eq('active', true)
          .limit(limit);
        if (legacyError) return [];
        rows = (legacyData as Array<Record<string, unknown>> | null) ?? [];
      }
    }
    return rows.map((p) => toBriefProduct(p));
  } catch {
    return [];
  }
}

// Returns the set of product ids that currently have at least one active
// variant row. Homewide product cards use this so a Buy Now affordance never
// blind-orders a base row for a product that truly needs a variant selection.
export async function fetchVariantPresence(productIds: string[]): Promise<Set<string>> {
  const present = new Set<string>();
  if (productIds.length === 0) return present;
  try {
    const { data, error } = await supabase
      .from('product_variants')
      .select('product_id')
      .eq('active', true)
      .in('product_id', productIds);
    if (error) return present;
    for (const row of data ?? []) present.add(String(row.product_id));
  } catch {
    /* empty — unknown presence degrades to "needs selection" */
  }
  return present;
}

// Merges variant presence onto a product list (single batched query).
export async function attachVariantPresence<T extends BriefProduct>(products: T[]): Promise<T[]> {
  if (products.length === 0) return products;
  const present = await fetchVariantPresence(products.map((p) => p.id));
  return products.map((p) => ({ ...p, hasVariants: present.has(p.id) }));
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

export interface HeroAutoplay {
  enabled: boolean;
  intervalMs: number;
}

// Hero autoplay configuration. Reads the Admin-managed code from store_settings
// and clamps the interval to the 2500-10000ms range enforced by migration
// 20260903120000_homepage_hero_autoplay. If the store_settings row or the
// hero_autoplay_* columns are missing (the migration is currently unapplied on
// the live database, so the columns do not exist yet), gracefully fall back to
// safe defaults so the hero still rotates.
export async function fetchHeroAutoplay(): Promise<HeroAutoplay> {
  const defaults: HeroAutoplay = { enabled: true, intervalMs: 4500 };

  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('hero_autoplay_enabled, hero_autoplay_interval_ms')
      .limit(1)
      .maybeSingle();
    if (error || !data) return defaults;
    const enabled = data.hero_autoplay_enabled;
    const enabledValue = enabled == null ? true : Boolean(enabled);
    let interval =
      data.hero_autoplay_interval_ms == null ? 4500 : Number(data.hero_autoplay_interval_ms);
    if (!Number.isFinite(interval) || interval <= 0) interval = 4500;
    interval = Math.min(10000, Math.max(2500, interval));
    return { enabled: enabledValue, intervalMs: interval };
  } catch {
    return defaults;
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
