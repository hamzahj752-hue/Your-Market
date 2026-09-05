'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

import ReviewsSection from '@/components/product/ReviewsSection';

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
     Related products
     --------------------------------------------------------- */

  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

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

  /* =========================================================
     LOAD PRODUCT
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setLoadError('');

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
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /* =========================================================
     RELATED PRODUCTS
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadRelated() {
      if (!product?.id) {
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select(
          'id,name,price,original_price,image,alt,category,rating,reviews,discount,badge,variant,brand,in_stock'
        )
        .eq('category', product.category)
        .neq('id', product.id)
        .eq('active', true)
        .limit(10);

      if (cancelled) {
        return;
      }

      if (error || !data) {
        setRelatedProducts([]);
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

      setRelatedProducts(mapped);
    }

    void loadRelated();

    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category]);

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

  const goToCart = () => {
    if (!effectiveInStock) {
      return;
    }

    if (hasVariants && !selectedVariant) {
      return;
    }

    addToCartWithQty();
    router.push('/cart');
  };

  /* =========================================================
     MEDIA SWIPE
     ========================================================= */

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current == null) {
      return;
    }

    const end = event.changedTouches[0]?.clientX ?? touchStartX.current;

    const delta = end - touchStartX.current;

    touchStartX.current = null;

    if (Math.abs(delta) <= 40 || allImages.length <= 1) {
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

      <main className="pb-[180px] lg:pb-8">
        <div className="mx-auto max-w-7xl px-2.5 py-2.5 sm:px-4 sm:py-4">
          {/* =================================================
              BREADCRUMB
             ================================================= */}

          <nav className="mb-2 flex min-w-0 flex-wrap items-center gap-1 text-[10px] text-slate-500 sm:text-xs">
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
                className="relative aspect-[4/3] max-h-[330px] w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white sm:max-h-[430px] lg:max-h-none"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onClick={() => {
                  if (activeImage !== videoIndex && currentActiveSrc) {
                    setEnlargeOpen(true);
                  }
                }}
              >
                {product.badge && (
                  <span className="absolute left-2 top-2 z-10 rounded bg-primary px-2 py-1 text-[9px] font-extrabold text-white">
                    {product.badge}
                  </span>
                )}

                {effectiveDiscount > 0 && (
                  <span className="absolute right-2 top-2 z-10 rounded bg-green-600 px-2 py-1 text-[9px] font-extrabold text-white">
                    {effectiveDiscount}% off
                  </span>
                )}

                {activeImage === videoIndex && hasVideo && product.videoUrl ? (
                  <video
                    src={product.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <AppImage
                    src={currentActiveSrc || product.image}
                    alt={product.alt}
                    fill
                    priority
                    objectFit="contain"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="p-1 sm:p-2"
                  />
                )}
              </div>

              {/* Thumbnails */}
              {(allImages.length > 1 || hasVideo) && (
                <div className="scrollbar-hide mt-2 flex gap-1.5 overflow-x-auto pb-1">
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

            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 lg:p-5">
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
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
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
                  <p className="mt-1 text-[11px] font-semibold text-green-700">
                    You save {money(effectiveSavings)}
                  </p>
                )}
              </div>

              {/* Stock */}
              <div className="mt-2.5">
                <p
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
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
                              onClick={() => {
                                setSelectedSize(size);

                                setQty(1);
                              }}
                              className={`min-w-[38px] rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${
                                selected
                                  ? 'border-primary bg-blue-50 text-primary'
                                  : available
                                    ? 'border-slate-300 bg-white text-slate-800'
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

                  {/* Colors */}
                  {availableColors.length > 0 && (
                    <div>
                      <div className="mb-1.5 flex items-center gap-1 text-xs">
                        <span className="font-bold">Color</span>

                        {selectedColor && <span className="text-slate-500">• {selectedColor}</span>}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {availableColors.map((color) => {
                          const candidates = variants.filter(
                            (variant) =>
                              variant.color_name === color &&
                              variant.active &&
                              (!selectedSize || variant.size === selectedSize)
                          );

                          const available = candidates.some(
                            (variant) => variant.stock_quantity > 0
                          );

                          const selected = selectedColor === color;

                          const image = candidates.find((variant) => variant.image_url)?.image_url;

                          const swatch = candidates.find(
                            (variant) => variant.color_value
                          )?.color_value;

                          return (
                            <button
                              key={color}
                              type="button"
                              disabled={!available}
                              onClick={() => {
                                setSelectedColor(color);

                                setQty(1);
                              }}
                              className={`flex min-h-[36px] items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold ${
                                selected
                                  ? 'border-primary bg-blue-50 text-primary'
                                  : available
                                    ? 'border-slate-300 bg-white text-slate-800'
                                    : 'cursor-not-allowed border-slate-200 text-slate-300'
                              }`}
                            >
                              {image ? (
                                <img
                                  src={image}
                                  alt=""
                                  className="h-6 w-6 rounded-full border border-slate-200 object-cover"
                                />
                              ) : swatch ? (
                                <span
                                  className="h-4 w-4 rounded-full border border-slate-300"
                                  style={{
                                    backgroundColor: swatch,
                                  }}
                                />
                              ) : null}

                              <span>{color}</span>
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
                    <p className="min-w-0 text-slate-500">
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white"
                >
                  <Icon
                    name="HeartIcon"
                    variant={isInWishlist(product.id) ? 'solid' : 'outline'}
                    size={20}
                    className={isInWishlist(product.id) ? 'text-red-500' : ''}
                  />
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
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="ShoppingCartIcon" size={16} />
                  Add to Cart
                </button>

                <button
                  type="button"
                  disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
                  onClick={goToCart}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
              SIMILAR PRODUCTS
             ================================================= */}

          {relatedProducts.length > 0 && (
            <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex h-11 items-center justify-between border-b border-slate-100 px-3 sm:px-4">
                <h2 className="text-sm font-extrabold text-slate-950">Similar Products</h2>

                <Link
                  href={`/products?category=${encodeURIComponent(product.category || '')}`}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary"
                >
                  View all
                  <Icon name="ArrowRightIcon" size={13} />
                </Link>
              </div>

              <div className="scrollbar-hide flex gap-2 overflow-x-auto p-2.5 sm:p-3">
                {relatedProducts.map((related) => {
                  const discount =
                    related.originalPrice && related.originalPrice > related.price
                      ? Math.round(
                          ((related.originalPrice - related.price) / related.originalPrice) * 100
                        )
                      : 0;

                  return (
                    <Link
                      key={related.id}
                      href={`/products/${related.id}`}
                      className="w-[140px] min-w-[140px] overflow-hidden rounded-lg border border-slate-100 bg-white sm:w-[165px] sm:min-w-[165px]"
                    >
                      <div className="relative aspect-square bg-slate-50">
                        <AppImage
                          src={related.image}
                          alt={related.alt}
                          fill
                          objectFit="contain"
                          sizes="165px"
                          className="p-1.5"
                        />

                        {discount > 0 && (
                          <span className="absolute right-1.5 top-1.5 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                            -{discount}%
                          </span>
                        )}
                      </div>

                      <div className="p-2">
                        <p className="line-clamp-2 min-h-[32px] text-[11px] font-semibold leading-4 text-slate-900">
                          {related.name}
                        </p>

                        <div className="mt-1 flex flex-wrap items-baseline gap-x-1">
                          <span className="text-xs font-extrabold text-red-500">
                            {money(related.price)}
                          </span>

                          {related.originalPrice && related.originalPrice > related.price && (
                            <span className="text-[9px] text-slate-400 line-through">
                              {money(related.originalPrice)}
                            </span>
                          )}
                        </div>

                        {related.rating > 0 && related.reviews > 0 && (
                          <p className="mt-1 text-[9px] text-green-700">
                            {related.rating.toFixed(1)} ★
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
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
        className={`fixed bottom-[84px] left-0 right-0 z-40 lg:hidden transition-all duration-200 ${
          stickyBuyVisible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
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
                onClick={goToCart}
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
