'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

import ReviewsSection from '@/components/product/ReviewsSection';
import ProductCard, { CardProduct } from '@/components/product/ProductCard';

import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

import { supabase } from '@/lib/supabase';

import { hasProductDetails, parseProductDetails, ProductDetails } from '@/lib/productDetails';

/* =========================================================
   TYPES
   ========================================================= */

export interface Product {
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

  description?: string;

  sku?: string;
  stockQuantity?: number;

  videoUrl?: string;

  details?: ProductDetails;
}

export interface ProductVariant {
  id: string;
  product_id: string;

  size: string | null;

  color_name: string | null;
  color_value: string | null;

  image_url: string | null;

  sku: string | null;

  price: number | null;
  original_price: number | null;

  stock_quantity: number;

  active: boolean;

  sort_order: number;
}

const money = (value: number) => `रू${Math.round(value).toLocaleString('en-IN')}`;

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const NAME_TO_HEX: Record<string, string> = {
  black: '#1f2937',
  charcoal: '#374151',
  graphite: '#4b5563',
  navy: '#1e3a8a',
  blue: '#2563eb',
  indigo: '#4f46e5',
  violet: '#8b5cf6',
  purple: '#9333ea',
  lavender: '#b4a7d6',
  pink: '#ec4899',
  rose: '#f43f5e',
  red: '#dc2626',
  burgundy: '#800020',
  maroon: '#800000',
  orange: '#ea580c',
  amber: '#f59e0b',
  gold: '#d4af37',
  yellow: '#eab308',
  olive: '#708238',
  green: '#16a34a',
  lime: '#84cc16',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  brown: '#92400e',
  tan: '#d2b48c',
  beige: '#d8c8a8',
  cream: '#f5f0e1',
  white: '#fafafa',
  silver: '#c0c0c0',
  gray: '#9ca3af',
  grey: '#9ca3af',
};

const resolveColorValue = (colorName: string, colorVariants: ProductVariant[]): string | null => {
  const value = colorVariants.find((variant) => variant.color_value)?.color_value?.trim() ?? '';

  if (HEX_COLOR_RE.test(value)) {
    return value;
  }

  const key = colorName.trim().toLowerCase();

  const match = Object.entries(NAME_TO_HEX).find(([name]) => key === name || key.includes(name));

  return match ? match[1] : null;
};

/* =========================================================
   PREFERS REDUCED MOTION
   ========================================================= */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => setReduced(mq.matches);

    update();

    mq.addEventListener?.('change', update);

    return () => mq.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

/* =========================================================
   STAGE IMAGE
   ========================================================= */

/*
 * Plain, fully-controlled <img> for the animated product stage.
 *
 * - Renders the image visible IMMEDIATELY instead of gating it behind an
 *   onLoad-flipped opacity state. For cached images the browser can finish
 *   loading before React's delegated onLoad fires, which left the main
 *   stage permanently blank (opacity-0) after a color/variant swap or when
 *   the image was already in the HTTP cache. The premium enter/exit layer
 *   animations on the wrapper supply all the motion, so no fade is lost.
 * - Falls back to the product base image when a variant image fails,
 *   then to a neutral placeholder if the base image is missing too.
 * - Sanitizes src/fallbackSrc so null/undefined/empty/whitespace strings are
 *   never passed to the browser (an empty src makes the page reload).
 */
function StageImage({
  src,
  alt,
  fallbackSrc,
  priority = false,
  className = '',
}: {
  src: string;
  alt?: string;
  fallbackSrc?: string;
  priority?: boolean;
  className?: string;
}) {
  const [source, setSource] = useState<string>(() => (typeof src === 'string' ? src.trim() : ''));
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setSource(typeof src === 'string' ? src.trim() : '');
    setErrored(false);
  }, [src]);

  const handleError = useCallback(() => {
    const fallback = typeof fallbackSrc === 'string' ? fallbackSrc.trim() : '';
    if (fallback && source !== fallback) {
      setSource(fallback);
      return;
    }
    setErrored(true);
  }, [fallbackSrc, source]);

  /*
   * Never pass an empty or whitespace-only src to the browser: doing so makes
   * it reload the current page (a full document navigation) besides logging an
   * "empty string passed to src" error. Fall back to the same neutral
   * no-image placeholder rendered on error instead.
   */
  const sourceMissing = !source;

  if (errored || sourceMissing) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center bg-slate-100 ${className}`}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-300"
          aria-hidden="true"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- plain <img> required for the animated swap stage (variant fallback + exit/enter layers; the app already opts out of the Next image optimizer globally)
    <img
      src={source}
      alt={alt ?? ''}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onError={handleError}
      className={`h-full w-full object-contain p-1 sm:p-2 ${className}`}
    />
  );
}

/* =========================================================
   MOVEMENT PREFERENCES (nominal durations)
   ========================================================= */

const IMG_EXIT_MS = 340;

/* =========================================================
   PRODUCT DETAILS
   ========================================================= */

export default function ProductDetailsClient({ id }: { id: string }) {
  const router = useRouter();

  const { addToCart } = useCart();

  const { isInWishlist, toggleWishlist } = useWishlist();

  /* ---------------------------------------------------------
     Product
     --------------------------------------------------------- */

  const [product, setProduct] = useState<Product | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState('');

  /* ---------------------------------------------------------
     Media
     --------------------------------------------------------- */

  const [gallery, setGallery] = useState<string[]>([]);

  const [activeImage, setActiveImage] = useState(0);

  const [enlargeOpen, setEnlargeOpen] = useState(false);

  const touchStartX = useRef<number | null>(null);

  const touchStartY = useRef<number | null>(null);

  /* ---------------------------------------------------------
     Premium image swap
     --------------------------------------------------------- */

  const reducedMotion = usePrefersReducedMotion();

  /*
   * The stage shows two stacked layers while a variant/gallery swap
   * happens: the previous image animates out below while the new one
   * enters above. The authoritative src comes from currentActiveSrc;
   * these values only drive the visual transition, never product state.
   */
  const [shownSrc, setShownSrc] = useState('');
  const [leavingSrc, setLeavingSrc] = useState<string | null>(null);
  const [swapCount, setSwapCount] = useState(0);

  const leavingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------------------------------------------------
     Variants
     --------------------------------------------------------- */

  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  /* ---------------------------------------------------------
     Cart
     --------------------------------------------------------- */

  const [qty, setQty] = useState(1);

  const [stickyBuyVisible, setStickyBuyVisible] = useState(false);

  const purchaseActionsRef = useRef<HTMLDivElement | null>(null);

  /* ---------------------------------------------------------
     All products (bottom section, current product excluded)
     --------------------------------------------------------- */

  const [allProducts, setAllProducts] = useState<Product[]>([]);

  /* =========================================================
     VARIANT OPTIONS
     ========================================================= */

  const availableSizes = useMemo(() => {
    const result = [
      ...new Set(
        variants.filter((variant) => variant.size).map((variant) => variant.size as string)
      ),
    ];

    return result;
  }, [variants]);

  const availableColors = useMemo(() => {
    const result = [
      ...new Set(
        variants
          .filter((variant) => variant.color_name)
          .map((variant) => variant.color_name as string)
      ),
    ];

    return result;
  }, [variants]);

  const hasVariants = variants.length > 0;

  /* =========================================================
     SELECTED VARIANT
     ========================================================= */

  const selectedVariant = useMemo(() => {
    if (!hasVariants) {
      return null;
    }

    return (
      variants.find((variant) => {
        if (!variant.active) {
          return false;
        }

        const sizeMatches = availableSizes.length === 0 || variant.size === selectedSize;

        const colorMatches = availableColors.length === 0 || variant.color_name === selectedColor;

        return sizeMatches && colorMatches && variant.stock_quantity > 0;
      }) || null
    );
  }, [
    variants,
    hasVariants,
    selectedSize,
    selectedColor,
    availableSizes.length,
    availableColors.length,
  ]);

  /* =========================================================
     EFFECTIVE VALUES
     ========================================================= */

  const effectivePrice = selectedVariant
    ? Number(selectedVariant.price ?? product?.price ?? 0)
    : (product?.price ?? 0);

  const effectiveOriginalPrice = selectedVariant
    ? selectedVariant.original_price != null
      ? Number(selectedVariant.original_price)
      : product?.originalPrice
    : product?.originalPrice;

  const effectiveDiscount = useMemo(() => {
    if (
      effectiveOriginalPrice != null &&
      effectiveOriginalPrice > 0 &&
      effectiveOriginalPrice > effectivePrice
    ) {
      return Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100);
    }

    return 0;
  }, [effectivePrice, effectiveOriginalPrice]);

  const effectiveSavings =
    effectiveOriginalPrice != null && effectiveOriginalPrice > effectivePrice
      ? effectiveOriginalPrice - effectivePrice
      : 0;

  const effectiveImage = selectedVariant?.image_url || product?.image || '';

  const effectiveInStock = hasVariants
    ? selectedVariant !== null && selectedVariant.stock_quantity > 0
    : (product?.inStock ?? false);

  const effectiveSku = selectedVariant?.sku || product?.sku;

  const effectiveStockQty = hasVariants
    ? (selectedVariant?.stock_quantity ?? 0)
    : product?.stockQuantity != null
      ? product.stockQuantity
      : product?.inStock
        ? 99
        : 0;

  const maxQty = effectiveStockQty > 0 ? effectiveStockQty : 1;

  /* =========================================================
     VARIANT SELECTION HANDLERS
     ========================================================= */

  /*
   * Selecting a size is a direct state change; the derived selectedVariant
   * recomputes immediately. If the new size is not offered for the current
   * color the product UX falls back to the existing disabled-option
   * behaviour — the customer chooses a compatible size. A non-existent
   * color+size combination is never created because the variant lookup is
   * an intersection over real variant rows only.
   */
  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    setQty(1);
  };

  /*
   * Selecting a color updates the active variant state instantly. When the
   * product also has a size/storage dimension and the currently selected
   * value is not offered for the new color, the first genuinely compatible
   * in-stock option is selected instead of silently forming an invalid
   * combination.
   */
  const handleColorSelect = (color: string) => {
    const candidates = variants.filter((variant) => variant.active && variant.color_name === color);

    if (availableSizes.length > 0) {
      const validSizes = [...new Set(candidates.map((variant) => variant.size).filter(Boolean))];

      const currentValid = selectedSize && validSizes.includes(selectedSize);

      if (!currentValid && validSizes.length > 0) {
        const firstInStock = candidates.find(
          (variant) => variant.stock_quantity > 0 && variant.size
        )?.size;

        setSelectedSize(firstInStock ?? validSizes[0]);
      }
    }

    setSelectedColor(color);
    setQty(1);
  };

  /* =========================================================
     MEDIA
     ========================================================= */

  const allImages = useMemo(() => {
    const images: string[] = [];

    if (selectedVariant?.image_url && !images.includes(selectedVariant.image_url)) {
      images.push(selectedVariant.image_url);
    }

    if (product?.image && !images.includes(product.image)) {
      images.push(product.image);
    }

    for (const image of gallery) {
      if (image && !images.includes(image)) {
        images.push(image);
      }
    }

    return images;
  }, [selectedVariant?.image_url, product?.image, gallery]);

  const hasVideo = Boolean(product?.videoUrl);

  const videoIndex = hasVideo ? allImages.length : -1;

  const currentActiveSrc =
    activeImage === videoIndex
      ? ''
      : allImages[activeImage] || allImages[0] || product?.image || '';

  /* ---------------------------------------------------------
     IMAGE SWAP ORCHESTRATION
     --------------------------------------------------------- */

  /*
   * Drives the premium exit/enter layers. Whenever the authoritative
   * current src changes (variant tap OR gallery swipe), the previous
   * visible src is pushed onto the leaving layer and the new src
   * becomes the entering layer. Rapid taps simply supersede the swap
   * — the last src to land wins and stale leave layers are replaced,
   * so there is no animation queue and no stale final state.
   */
  useEffect(() => {
    if (!currentActiveSrc) {
      return;
    }

    if (currentActiveSrc === shownSrc) {
      return;
    }

    setLeavingSrc(reducedMotion ? null : shownSrc || null);
    setShownSrc(currentActiveSrc);
    setSwapCount((count) => count + 1);
  }, [currentActiveSrc, reducedMotion, shownSrc]);

  useEffect(() => {
    if (!leavingSrc) {
      return;
    }

    if (leavingTimerRef.current) {
      clearTimeout(leavingTimerRef.current);
    }

    leavingTimerRef.current = setTimeout(() => {
      setLeavingSrc(null);
    }, IMG_EXIT_MS);

    return () => {
      if (leavingTimerRef.current) {
        clearTimeout(leavingTimerRef.current);
        leavingTimerRef.current = null;
      }
    };
  }, [leavingSrc]);

  useEffect(
    () => () => {
      if (leavingTimerRef.current) {
        clearTimeout(leavingTimerRef.current);
      }
    },
    []
  );

  /* ---------------------------------------------------------
     IMAGE PRELOADING
     --------------------------------------------------------- */

  /*
   * Gracefully warms the cache for the current image and the nearby
   * variant gallery. Staggered and capped so a large catalog never
   * triggers an unreasonable burst of full-size downloads.
   */
  const preloadImages = useCallback((urls: (string | null | undefined)[], max = 8) => {
    const unique = [...new Set(urls.filter(Boolean) as string[])];
    unique.slice(0, max).forEach((url, index) => {
      setTimeout(
        () => {
          const img = new window.Image();
          img.decoding = 'async';
          img.src = url;
        },
        Math.min(index * 120, 840)
      );
    });
  }, []);

  /* =========================================================
     LOAD PRODUCT
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setLoadError('');

      /*
       * Reset the visual swap stage for a fresh product (e.g. navigating
       * between two product pages in the same session) so the previous
       * product's image never lingers as a leaving layer.
       */
      setShownSrc('');
      setLeavingSrc(null);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('active', true)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error || !data) {
        console.error('Supabase product detail error:', error);

        setLoadError('Unable to load product. Please try again.');

        setLoading(false);

        return;
      }

      const mappedProduct: Product = {
        id: String(data.id),

        name: data.name || 'Product',

        price: Number(data.price) || 0,

        originalPrice: data.original_price != null ? Number(data.original_price) : undefined,

        image: data.image || '',

        alt: data.alt || data.name || 'Product image',

        category: data.category || '',

        rating: Number(data.rating) || 0,

        reviews: Number(data.reviews) || 0,

        discount: data.discount != null ? Number(data.discount) : undefined,

        badge: data.badge ?? undefined,

        variant: data.variant ?? undefined,

        brand: data.brand || '',

        inStock: Boolean(data.in_stock),

        description: data.description ?? undefined,

        sku: data.sku ?? undefined,

        stockQuantity: data.stock_quantity != null ? Number(data.stock_quantity) : undefined,

        videoUrl: data.video_url ?? undefined,

        details: parseProductDetails(data.details),
      };

      setProduct(mappedProduct);

      /*
       * Load dedicated gallery rows.
       */
      const { data: imageRows, error: imagesError } = await supabase
        .from('product_images')
        .select('url')
        .eq('product_id', id)
        .order('sort_order', {
          ascending: true,
        });

      if (cancelled) {
        return;
      }

      const mergedImages: string[] = [];

      if (!imagesError && imageRows) {
        for (const row of imageRows) {
          if (row.url && !mergedImages.includes(row.url)) {
            mergedImages.push(row.url);
          }
        }
      }

      /*
       * Also preserve the legacy/admin
       * products.images JSON array.
       *
       * This works even when product_images
       * contains zero rows.
       */
      if (Array.isArray(data.images)) {
        for (const raw of data.images) {
          const image = typeof raw === 'string' ? raw.trim() : '';

          if (image && !mergedImages.includes(image)) {
            mergedImages.push(image);
          }
        }
      }

      setGallery(mergedImages);

      /*
       * Load real active variants.
       */
      const { data: variantRows, error: variantError } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', id)
        .eq('active', true)
        .order('sort_order', {
          ascending: true,
        });

      if (cancelled) {
        return;
      }

      if (!variantError && variantRows && variantRows.length > 0) {
        const rows = variantRows as ProductVariant[];

        setVariants(rows);

        const sizes = [
          ...new Set(
            rows.filter((variant) => variant.size).map((variant) => variant.size as string)
          ),
        ];

        const colors = [
          ...new Set(
            rows
              .filter((variant) => variant.color_name)
              .map((variant) => variant.color_name as string)
          ),
        ];

        setSelectedSize(sizes[0] ?? null);

        setSelectedColor(colors[0] ?? null);
      } else {
        setVariants([]);
        setSelectedSize(null);
        setSelectedColor(null);
      }

      setQty(1);
      setActiveImage(0);
      setLoading(false);

      /*
       * Warm the cache for the current image plus nearby variant/gallery
       * images so a color tap reaches a ready image instead of a blank
       * network wait. Staggered + capped by preloadImages.
       */
      const variantUrls =
        !variantError && variantRows ? variantRows.map((row) => row.image_url) : [];

      preloadImages([mappedProduct.image, ...variantUrls, ...mergedImages]);
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [id, preloadImages]);

  /* =========================================================
     ALL PRODUCTS (bottom section, current product excluded)
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadAllProducts() {
      if (!product?.id) {
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select(
          'id,name,price,original_price,image,alt,category,rating,reviews,discount,badge,variant,brand,in_stock'
        )
        .neq('id', product.id)
        .eq('active', true)
        .limit(24);

      if (cancelled) {
        return;
      }

      if (error || !data) {
        setAllProducts([]);
        return;
      }

      const mapped: Product[] = data.map((row) => ({
        id: String(row.id),

        name: row.name || 'Product',

        price: Number(row.price) || 0,

        originalPrice: row.original_price != null ? Number(row.original_price) : undefined,

        image: row.image || '',

        alt: row.alt || row.name || 'Product image',

        category: row.category || '',

        rating: Number(row.rating) || 0,

        reviews: Number(row.reviews) || 0,

        discount: row.discount != null ? Number(row.discount) : undefined,

        badge: row.badge ?? undefined,

        variant: row.variant ?? undefined,

        brand: row.brand || '',

        inStock: Boolean(row.in_stock),
      }));

      setAllProducts(mapped);
    }

    void loadAllProducts();

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  /* =========================================================
     VARIANT IMAGE CHANGE
     ========================================================= */

  useEffect(() => {
    /*
     * allImages puts the selected
     * variant image first.
     */
    setActiveImage(0);
  }, [selectedColor, selectedSize]);

  /* =========================================================
     STICKY BUY BAR
     ========================================================= */

  useEffect(() => {
    const node = purchaseActionsRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setStickyBuyVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, product]);

  /* =========================================================
     CART ACTIONS
     ========================================================= */

  const addToCartWithQty = () => {
    if (!product) {
      return;
    }

    if (hasVariants && !selectedVariant) {
      return;
    }

    const cartItem = {
      id: product.id,

      name: product.name,

      price: effectivePrice,

      originalPrice: effectiveOriginalPrice,

      image: effectiveImage,

      alt: product.alt,

      category: product.category,

      rating: product.rating,

      reviews: product.reviews,

      discount: effectiveDiscount || undefined,

      badge: product.badge,

      variant: product.variant,

      brand: product.brand,

      inStock: effectiveInStock,

      description: product.description,

      sku: effectiveSku,

      stockQuantity: effectiveStockQty,

      variantId: selectedVariant?.id,

      variantSize: selectedVariant?.size ?? undefined,

      variantColor: selectedVariant?.color_name ?? undefined,

      variantImage: selectedVariant?.image_url ?? undefined,
    };

    for (let index = 0; index < qty; index += 1) {
      addToCart(cartItem);
    }
  };

  // Buy Now goes DIRECTLY to Checkout with the currently selected product,
  // quantity and variant. It does not route through the Cart page and it does
  // not touch (or clear) the customer's normal cart. Checkout resolves the
  // server-side canonical product/variant before ordering.
  const buyNow = () => {
    if (!effectiveInStock) {
      return;
    }

    if (hasVariants && !selectedVariant) {
      return;
    }

    const params = new URLSearchParams();
    params.set('buyNow', '1');
    params.set('product', product.id);
    params.set('qty', String(qty));
    if (selectedVariant) {
      params.set('variant', selectedVariant.id);
    }
    router.push(`/checkout?${params.toString()}`);
  };

  /* =========================================================
     MEDIA SWIPE
     ========================================================= */

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current == null) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;

    const endY = event.changedTouches[0]?.clientY ?? touchStartY.current;

    const delta = endX - touchStartX.current;

    const vertical = Math.abs(endY - (touchStartY.current ?? endY));

    touchStartX.current = null;
    touchStartY.current = null;

    /*
     * Only treat the gesture as a gallery swipe when it is clearly
     * horizontal. A mostly vertical gesture keeps scrolling the page.
     */
    if (Math.abs(delta) <= 40 || vertical > Math.abs(delta) * 1.2 || allImages.length <= 1) {
      return;
    }

    if (delta < 0) {
      setActiveImage((current) => (current + 1) % allImages.length);
    } else {
      setActiveImage((current) => (current - 1 + allImages.length) % allImages.length);
    }
  };

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <main className="flex min-h-[50vh] items-center justify-center pb-24 lg:pb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
            Loading product...
          </div>
        </main>

        <BottomNav />
      </div>
    );
  }

  /* =========================================================
     ERROR
     ========================================================= */

  if (loadError || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <main className="flex min-h-[55vh] items-center justify-center px-4 pb-24">
          <div className="text-center">
            <h1 className="text-lg font-extrabold">Product not found</h1>

            <p className="mt-1 text-sm text-muted-foreground">
              {loadError || 'This product is not available.'}
            </p>

            <Link
              href="/products"
              className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white"
            >
              Browse Products
            </Link>
          </div>
        </main>

        <BottomNav />
      </div>
    );
  }

  const showRating = product.rating > 0 && product.reviews > 0;

  const lowStock =
    hasVariants && selectedVariant ? selectedVariant.stock_quantity : product.stockQuantity;

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <Header />

      <main className="pb-[calc(124px+env(safe-area-inset-bottom))] lg:pb-8">
        <div className="mx-auto max-w-7xl px-2.5 py-2.5 sm:px-4 sm:py-4">
          {/* =================================================
              BREADCRUMB
             ================================================= */}

          <nav className="mb-2 hidden min-w-0 flex-wrap items-center gap-1 text-[10px] text-slate-500 lg:flex lg:text-xs">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>

            <span>/</span>

            <Link href="/products" className="hover:text-primary">
              Products
            </Link>

            {product.category && (
              <>
                <span>/</span>

                <span className="max-w-[120px] truncate text-slate-700">{product.category}</span>
              </>
            )}
          </nav>

          {/* =================================================
              PRODUCT TOP
             ================================================= */}

          <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-5">
            {/* ===============================================
                GALLERY
               =============================================== */}

            <section className="min-w-0 lg:sticky lg:top-[150px]">
              <div
                className="relative aspect-square w-full min-w-0 overflow-hidden rounded-[28px] bg-[#f7f4ee] max-h-[75vh] lg:aspect-[4/3] lg:max-h-none"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onClick={() => {
                  if (activeImage !== videoIndex && currentActiveSrc) {
                    setEnlargeOpen(true);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.back();
                  }}
                  aria-label="Go back"
                  className="absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 shadow-[0_2px_10px_rgba(15,23,42,0.08)] backdrop-blur transition-transform hover:scale-105 active:scale-90"
                >
                  <Icon name="ArrowLeftIcon" size={18} />
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleWishlist(product);
                  }}
                  aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 shadow-[0_2px_10px_rgba(15,23,42,0.08)] backdrop-blur transition-transform hover:scale-105 active:scale-90"
                >
                  <span
                    key={isInWishlist(product.id) ? 'stage-wish-on' : 'stage-wish-off'}
                    className="ym-pop flex"
                  >
                    <Icon
                      name="HeartIcon"
                      variant={isInWishlist(product.id) ? 'solid' : 'outline'}
                      size={18}
                      className={isInWishlist(product.id) ? 'text-red-500' : ''}
                    />
                  </span>
                </button>

                {/* Real color dots — compact independent selectors floating at top center,
                    only for products with real color variants. */}
                {availableColors.length > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-start justify-center"
                    role="group"
                    aria-label="Select color"
                  >
                    {availableColors.map((color) => {
                      const colorVariants = variants.filter(
                        (variant) => variant.active && variant.color_name === color
                      );

                      const available = colorVariants.some((variant) => variant.stock_quantity > 0);

                      const selected = selectedColor === color;

                      const swatch = resolveColorValue(color, colorVariants);

                      return (
                        <button
                          key={color}
                          type="button"
                          disabled={!available}
                          aria-label={`Select ${color}`}
                          aria-pressed={selected}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleColorSelect(color);
                          }}
                          className="group pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
                        >
                          <span
                            aria-hidden="true"
                            className={`relative block h-[11px] w-[11px] rounded-full transition-all duration-200 ease-out ${
                              swatch ? '' : 'border border-slate-300 bg-white'
                            } ${
                              selected
                                ? 'scale-[1.1] ring-[1.5px] ring-slate-900/80 ring-offset-[3px] ring-offset-[#f7f4ee]'
                                : available
                                  ? 'ring-1 ring-black/10 group-hover:scale-[1.06]'
                                  : 'ring-1 ring-black/5'
                            } ${available ? '' : 'opacity-35 saturate-0'}`}
                            style={swatch ? { backgroundColor: swatch } : undefined}
                          />
                          {!available && (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute left-1/2 top-1/2 h-[13px] w-[1.5px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white mix-blend-difference"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeImage === videoIndex && hasVideo && product.videoUrl?.trim() ? (
                  <video
                    src={product.videoUrl.trim()}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  /*
                   * Premium swap stage. The previous image drifts out on the
                   * exit layer (blur -> fade -> slight downward move) while
                   * the new image enters on top (soft, blurred -> settles
                   * sharp). swapCount keys the entering layer so every swap
                   * restarts its animation; the leaving layer is keyed by its
                   * own src so rapid taps replace stale exit layers instead
                   * of queuing them.
                   */
                  <div className="absolute inset-0">
                    {leavingSrc && leavingSrc !== shownSrc && (
                      <div
                        key={`ym-exit-${leavingSrc}`}
                        className="absolute inset-0 ym-img-exit"
                        aria-hidden="true"
                      >
                        <StageImage src={leavingSrc} fallbackSrc={product.image} />
                      </div>
                    )}

                    <div
                      key={`ym-enter-${swapCount}`}
                      className={`absolute inset-0 ${reducedMotion ? '' : 'ym-img-enter'}`}
                    >
                      <StageImage
                        src={shownSrc || currentActiveSrc || product.image}
                        alt={product.alt}
                        fallbackSrc={product.image}
                        priority={activeImage === 0}
                      />
                    </div>
                  </div>
                )}

                {/* Subtle gallery/swipe affordance — only when real extra media
                    exists; never a fake control for single-image products.
                    Anchored inside the relative gallery container so the dots
                    and arrows always stay tied to the image, never over the
                    price/discount row. */}
                {(allImages.length > 1 || hasVideo) && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-20 flex justify-center">
                    <div
                      className="flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 backdrop-blur"
                      aria-hidden="true"
                    >
                      <Icon name="ChevronLeftIcon" size={12} className="text-slate-500" />
                      {allImages.map((_, index) => (
                        <span
                          key={index}
                          className={`h-1 rounded-full transition-all duration-300 ${
                            index === activeImage ? 'w-4 bg-slate-700' : 'w-1 bg-slate-300'
                          }`}
                        />
                      ))}
                      <Icon name="ChevronRightIcon" size={12} className="text-slate-500" />
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {(allImages.length > 1 || hasVideo) && (
                <div className="scrollbar-hide mt-2 flex gap-1.5 overflow-x-auto pb-1 md:mt-3">
                  {allImages.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-label={`View image ${index + 1}`}
                      className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 bg-white sm:h-14 sm:w-14 ${
                        activeImage === index ? 'border-primary' : 'border-slate-200'
                      }`}
                    >
                      <AppImage
                        src={image}
                        alt=""
                        fill
                        objectFit="contain"
                        sizes="56px"
                        className="p-0.5"
                      />
                    </button>
                  ))}

                  {hasVideo && (
                    <button
                      type="button"
                      onClick={() => setActiveImage(videoIndex)}
                      aria-label="View product video"
                      className={`relative flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-slate-900 text-white sm:h-14 sm:w-16 ${
                        activeImage === videoIndex ? 'border-primary' : 'border-slate-200'
                      }`}
                    >
                      <Icon name="PlayIcon" size={20} />
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* ===============================================
                PRODUCT INFORMATION
               =============================================== */}

            <section className="min-w-0 rounded-2xl border border-slate-200/70 bg-white p-3 sm:p-4 sm:rounded-3xl lg:p-6">
              {/* Brand/category */}
              <div className="flex min-w-0 flex-wrap items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-[10px]">
                {product.brand && <span className="text-primary">{product.brand}</span>}

                {product.category && (
                  <>
                    <span>•</span>
                    <span>{product.category}</span>
                  </>
                )}
              </div>

              {/* Name */}
              <h1 className="mt-1 break-words text-[17px] font-extrabold leading-[1.25] text-slate-950 sm:text-xl lg:text-2xl">
                {product.name}
              </h1>

              {/* Rating */}
              {showRating && (
                <Link href="#reviews" className="mt-2 inline-flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded bg-green-700 px-1.5 py-1 text-[10px] font-bold leading-none text-white">
                    {product.rating.toFixed(1)}

                    <Icon name="StarIcon" size={10} />
                  </span>

                  <span className="text-[11px] text-slate-500">
                    {product.reviews.toLocaleString()} ratings
                  </span>

                  <span className="text-[11px] font-semibold text-primary">See reviews</span>
                </Link>
              )}

              {/* Price */}
              <div className="mt-2.5 border-y border-slate-200 py-2.5">
                <div
                  key={`price-${effectivePrice}`}
                  className="ym-text-in flex flex-wrap items-baseline gap-x-2 gap-y-1"
                >
                  <span className="text-[22px] font-black leading-none text-red-500 sm:text-2xl">
                    {money(effectivePrice)}
                  </span>

                  {effectiveOriginalPrice != null && effectiveOriginalPrice > effectivePrice && (
                    <span className="text-xs text-slate-400 line-through">
                      {money(effectiveOriginalPrice)}
                    </span>
                  )}

                  {effectiveDiscount > 0 && (
                    <span className="text-xs font-bold text-green-700">
                      {effectiveDiscount}% off
                    </span>
                  )}
                </div>

                {effectiveSavings > 0 && (
                  <p className="ym-text-in mt-1 text-[11px] font-semibold text-green-700">
                    You save {money(effectiveSavings)}
                  </p>
                )}
              </div>

              {/* Stock */}
              <div className="mt-2.5">
                <p
                  key={`stock-${effectiveInStock}-${lowStock}`}
                  className={`ym-text-in inline-flex items-center gap-1.5 text-[11px] font-bold ${
                    effectiveInStock ? 'text-green-700' : 'text-red-500'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      effectiveInStock ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />

                  {effectiveInStock
                    ? lowStock != null && lowStock > 0 && lowStock <= 5
                      ? `Only ${lowStock} left in stock`
                      : 'In stock'
                    : 'Out of stock'}
                </p>
              </div>

              {/* Live color selection summary — mirrors the top-center dots so
                  the currently selected variant stays explicit above the fold. */}
              {availableColors.length > 0 && selectedColor && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-600">
                  <span
                    key={`color-${selectedColor}-${selectedSize}`}
                    className="ym-text-in inline-flex items-center gap-1"
                  >
                    Color <span className="font-extrabold text-slate-900">• {selectedColor}</span>
                  </span>

                  {availableSizes.length > 0 && selectedSize && (
                    <span
                      key={`size-${selectedColor}-${selectedSize}`}
                      className="ym-text-in inline-flex items-center gap-1"
                    >
                      Size <span className="font-extrabold text-slate-900">• {selectedSize}</span>
                    </span>
                  )}
                </div>
              )}

              {/* =============================================
                  VARIANTS
                 ============================================= */}

              {hasVariants && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  {/* Sizes */}
                  {availableSizes.length > 0 && (
                    <div>
                      <div className="mb-1.5 flex items-center gap-1 text-xs">
                        <span className="font-bold">Size</span>

                        {selectedSize && <span className="text-slate-500">• {selectedSize}</span>}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {availableSizes.map((size) => {
                          const candidates = variants.filter(
                            (variant) =>
                              variant.size === size &&
                              variant.active &&
                              (!selectedColor || variant.color_name === selectedColor)
                          );

                          const available = candidates.some(
                            (variant) => variant.stock_quantity > 0
                          );

                          const selected = selectedSize === size;

                          return (
                            <button
                              key={size}
                              type="button"
                              disabled={!available}
                              onClick={() => handleSizeSelect(size)}
                              className={`ym-chip min-w-[38px] rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${
                                selected
                                  ? 'scale-[1.05] border-primary bg-primary text-white shadow-primary/20'
                                  : available
                                    ? 'border-slate-300 bg-white text-slate-800 hover:border-primary/50'
                                    : 'cursor-not-allowed border-slate-200 text-slate-300 line-through'
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* =============================================
                  KEY FACTS
                 ============================================= */}

              {(effectiveSku || product.brand || product.category) && (
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-[10px] sm:text-[11px]">
                  {effectiveSku && (
                    <p key={`sku-${effectiveSku}`} className="ym-text-in min-w-0 text-slate-500">
                      SKU:{' '}
                      <span className="break-words font-semibold text-slate-800">
                        {effectiveSku}
                      </span>
                    </p>
                  )}

                  {product.brand && (
                    <p className="min-w-0 text-slate-500">
                      Brand:{' '}
                      <span className="break-words font-semibold text-slate-800">
                        {product.brand}
                      </span>
                    </p>
                  )}

                  {product.category && (
                    <p className="col-span-2 min-w-0 text-slate-500">
                      Category:{' '}
                      <span className="font-semibold text-slate-800">{product.category}</span>
                    </p>
                  )}
                </div>
              )}

              {/* =============================================
                  QUANTITY / WISHLIST
                 ============================================= */}

              <div className="mt-3 flex items-center gap-2">
                <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-1">
                  <button
                    type="button"
                    onClick={() => setQty((current) => Math.max(1, current - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-base font-bold disabled:text-slate-300"
                  >
                    −
                  </button>

                  <span className="w-7 text-center text-xs font-extrabold">{qty}</span>

                  <button
                    type="button"
                    onClick={() => setQty((current) => Math.min(maxQty, current + 1))}
                    disabled={qty >= maxQty}
                    aria-label="Increase quantity"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-base font-bold disabled:text-slate-300"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white transition-transform active:scale-90"
                >
                  <span
                    key={isInWishlist(product.id) ? 'wish-on' : 'wish-off'}
                    className="ym-pop flex"
                  >
                    <Icon
                      name="HeartIcon"
                      variant={isInWishlist(product.id) ? 'solid' : 'outline'}
                      size={20}
                      className={isInWishlist(product.id) ? 'text-red-500' : ''}
                    />
                  </span>
                </button>
              </div>

              {/* =============================================
                  PURCHASE ACTIONS
                 ============================================= */}

              <div
                className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2"
                ref={purchaseActionsRef}
              >
                <button
                  type="button"
                  disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
                  onClick={addToCartWithQty}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="ShoppingCartIcon" size={16} />
                  Add to Cart
                </button>

                <button
                  type="button"
                  disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
                  onClick={buyNow}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="BoltIcon" size={16} />
                  Buy Now
                </button>
              </div>

              {/* =============================================
                  TRUST
                 ============================================= */}

              <div className="mt-3 grid grid-cols-3 border-t border-slate-100 pt-2.5 text-center text-[9px] leading-3 text-slate-500">
                <div className="flex flex-col items-center gap-1 px-1">
                  <Icon name="TruckIcon" size={15} className="text-primary" />

                  <span>Doorstep delivery</span>
                </div>

                <div className="flex flex-col items-center gap-1 border-x border-slate-100 px-1">
                  <Icon name="BanknotesIcon" size={15} className="text-primary" />

                  <span>Cash on delivery</span>
                </div>

                <div className="flex flex-col items-center gap-1 px-1">
                  <Icon name="ShieldCheckIcon" size={15} className="text-primary" />

                  <span>Secure checkout</span>
                </div>
              </div>
            </section>
          </div>

          {/* =================================================
              DESCRIPTION
             ================================================= */}

          {product.description && (
            <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
              <h2 className="text-sm font-extrabold">Product Description</h2>

              <p className="mt-1.5 whitespace-pre-line text-xs leading-5 text-slate-600 sm:text-sm">
                {product.description}
              </p>
            </section>
          )}

          {/* =================================================
              ADMIN DETAILS
             ================================================= */}

          {product.details && hasProductDetails(product.details) && (
            <section className="mt-3 space-y-2.5" aria-label="Product details">
              {/* Highlights */}
              {product.details.highlights.length > 0 && (
                <DetailCard title="Highlights">
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {product.details.highlights.map((highlight, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-xs leading-5 text-slate-700"
                      >
                        <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary">
                          <Icon name="CheckIcon" size={10} />
                        </span>

                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </DetailCard>
              )}

              {/* Specs */}
              {product.details.specifications.length > 0 && (
                <DetailCard title="Specifications">
                  <div className="space-y-3">
                    {product.details.specifications.map((group, groupIndex) => (
                      <div key={groupIndex}>
                        {group.group && (
                          <h3 className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            {group.group}
                          </h3>
                        )}

                        <dl className="divide-y divide-slate-100 border-y border-slate-100">
                          {group.items.map((item, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 py-2 text-[11px] sm:text-xs"
                            >
                              <dt className="break-words text-slate-500">{item.key}</dt>

                              <dd className="break-words font-semibold text-slate-800">
                                {item.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                </DetailCard>
              )}

              {/* Box */}
              {product.details.packageContents.length > 0 && (
                <DetailCard title="What's in the Box">
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {product.details.packageContents.map((item, index) => (
                      <li key={index} className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />

                        {item}
                      </li>
                    ))}
                  </ul>
                </DetailCard>
              )}

              {/* Services */}
              {(product.details.delivery ||
                product.details.warranty ||
                product.details.returns) && (
                <DetailCard title="Services">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {product.details.delivery && (
                      <ServiceItem
                        icon="TruckIcon"
                        title="Delivery"
                        text={product.details.delivery}
                      />
                    )}

                    {product.details.warranty && (
                      <ServiceItem
                        icon="ShieldCheckIcon"
                        title="Warranty"
                        text={product.details.warranty}
                      />
                    )}

                    {product.details.returns && (
                      <ServiceItem
                        icon="ArrowPathIcon"
                        title="Returns"
                        text={product.details.returns}
                      />
                    )}
                  </div>
                </DetailCard>
              )}
            </section>
          )}

          {/* =================================================
              REVIEWS
             ================================================= */}

          <div id="reviews">
            <ReviewsSection productId={id} productName={product.name} />
          </div>

          {/* =================================================
              ALL PRODUCTS
             ================================================= */}

          {allProducts.length > 0 && (
            <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex h-11 items-center justify-between border-b border-slate-100 px-3 sm:px-4">
                <h2 className="text-sm font-extrabold text-slate-950">All Products</h2>

                <Link
                  href="/products"
                  className="flex items-center gap-1 text-[11px] font-bold text-primary"
                >
                  View all
                  <Icon name="ArrowRightIcon" size={13} />
                </Link>
              </div>

              <div className="p-2.5 sm:p-3">
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-3">
                  {allProducts.map((related) => (
                    <div key={related.id} className="min-w-0">
                      <ProductCard product={related as CardProduct} variant="compact" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/*
       * Compact sticky mobile buy bar.
       *
       * Reveals once the in-flow purchase actions
       * have scrolled past the viewport, so it never
       * duplicates what is on screen. Sits just above
       * the fixed bottom dock.
       */}
      <div
        className={`fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-0 right-0 z-40 lg:hidden transition-all duration-200 ${
          stickyBuyVisible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-md items-center gap-3 px-3">
          <div className="flex flex-1 items-center rounded-2xl border border-black/5 bg-white/95 px-3 py-2 shadow-[0_-2px_20px_-4px_rgba(0,0,0,0.15)] backdrop-blur">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-extrabold text-foreground">{money(effectivePrice)}</p>
              {effectiveOriginalPrice != null && effectiveOriginalPrice > effectivePrice && (
                <p className="text-[10px] text-slate-400 line-through">
                  {money(effectiveOriginalPrice)}
                </p>
              )}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
                onClick={addToCartWithQty}
                className="flex h-9 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="ShoppingCartIcon" size={15} />
                Add to Cart
              </button>
              <button
                type="button"
                disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
                onClick={buyNow}
                className="flex h-9 items-center justify-center gap-1 rounded-lg bg-orange-500 px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="BoltIcon" size={15} />
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />

      {/* =====================================================
          IMAGE LIGHTBOX
         ===================================================== */}

      {enlargeOpen && currentActiveSrc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3"
          onClick={() => setEnlargeOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product image viewer"
        >
          <button
            type="button"
            onClick={() => setEnlargeOpen(false)}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
            aria-label="Close image viewer"
          >
            <Icon name="XMarkIcon" size={22} />
          </button>

          {allImages.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                setActiveImage((current) => (current - 1 + allImages.length) % allImages.length);
              }}
              className="absolute left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white sm:left-4"
              aria-label="Previous image"
            >
              <Icon name="ChevronLeftIcon" size={22} />
            </button>
          )}

          <div
            className="relative h-[80vh] w-[90vw] max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <AppImage
              src={allImages[activeImage] || currentActiveSrc}
              alt={product.alt}
              fill
              objectFit="contain"
              sizes="90vw"
            />
          </div>

          {allImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();

                  setActiveImage((current) => (current + 1) % allImages.length);
                }}
                className="absolute right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white sm:right-4"
                aria-label="Next image"
              >
                <Icon name="ChevronRightIcon" size={22} />
              </button>

              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/50 px-3 py-1.5">
                {allImages.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();

                      setActiveImage(index);
                    }}
                    aria-label={`Go to image ${index + 1}`}
                    className={`h-2 w-2 rounded-full ${
                      index === activeImage ? 'bg-white' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SMALL REUSABLE DETAIL CARD
   ========================================================= */

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <h2 className="mb-2 text-sm font-extrabold text-slate-950">{title}</h2>

      {children}
    </div>
  );
}

/* =========================================================
   SERVICE ITEM
   ========================================================= */

function ServiceItem({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
        <Icon name={icon} size={15} />
      </span>

      <div className="min-w-0">
        <h3 className="text-[11px] font-extrabold text-slate-900">{title}</h3>

        <p className="mt-0.5 break-words text-[10px] leading-4 text-slate-500">{text}</p>
      </div>
    </div>
  );
}
