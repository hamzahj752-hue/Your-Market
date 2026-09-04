'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { supabase } from '@/lib/supabase';
import ReviewsSection from '@/components/product/ReviewsSection';
import { parseProductDetails, hasProductDetails, ProductDetails } from '@/lib/productDetails';

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

export default function ProductDetailsClient({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [gallery, setGallery] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);

  const [qty, setQty] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const [enlargeOpen, setEnlargeOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const router = useRouter();

  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const availableSizes = useMemo(() => {
    const sizes = [...new Set(variants.filter((v) => v.size).map((v) => v.size!))];
    return sizes.sort();
  }, [variants]);

  const availableColors = useMemo(() => {
    const colors = [...new Set(variants.filter((v) => v.color_name).map((v) => v.color_name!))];
    return colors.sort();
  }, [variants]);

  const hasVariants = variants.length > 0;

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    return (
      variants.find(
        (v) =>
          v.active &&
          v.stock_quantity > 0 &&
          v.size === selectedSize &&
          v.color_name === selectedColor
      ) || null
    );
  }, [variants, selectedSize, selectedColor, hasVariants]);

  const effectivePrice = selectedVariant
    ? Number(selectedVariant.price ?? product?.price ?? 0)
    : (product?.price ?? 0);

  const effectiveOriginalPrice = selectedVariant
    ? selectedVariant.original_price != null
      ? Number(selectedVariant.original_price)
      : (product?.originalPrice ?? undefined)
    : product?.originalPrice;

  // Discount is only ever derived from real price/original_price data.
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
    : product?.stockQuantity && product.stockQuantity > 0
      ? product.stockQuantity
      : 99;

  const maxQty = effectiveStockQty > 0 ? effectiveStockQty : 99;

  const allImages = useMemo(() => {
    const imgs: string[] = [];
    if (selectedVariant?.image_url) imgs.push(selectedVariant.image_url);
    if (product?.image && !imgs.includes(product.image)) imgs.push(product.image);
    for (const url of gallery) {
      if (url && !imgs.includes(url)) imgs.push(url);
    }
    return imgs;
  }, [product?.image, selectedVariant?.image_url, gallery]);

  const hasVideo = Boolean(product?.videoUrl);
  const videoIndex = hasVideo ? allImages.length : -1;

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setLoadError('');

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('active', true)
        .maybeSingle();

      if (error && error.code === 'PGRST116') {
        setLoadError('This product is not available.');
        setLoading(false);
        return;
      }
      if (error || !data) {
        console.error('Supabase product detail error:', error);
        setLoadError('Unable to load product. Please try again.');
        setLoading(false);
        return;
      }

      const mappedProduct: Product = {
        id: data.id,
        name: data.name,
        price: Number(data.price),
        originalPrice: data.original_price != null ? Number(data.original_price) : undefined,
        image: data.image,
        alt: data.alt,
        category: data.category,
        rating: Number(data.rating),
        reviews: Number(data.reviews),
        discount: data.discount != null ? Number(data.discount) : undefined,
        badge: data.badge ?? undefined,
        variant: data.variant ?? undefined,
        brand: data.brand,
        inStock: Boolean(data.in_stock),
        description: data.description ?? undefined,
        sku: data.sku ?? undefined,
        stockQuantity: data.stock_quantity != null ? Number(data.stock_quantity) : undefined,
        videoUrl: data.video_url ?? undefined,
        details: parseProductDetails(data.details),
      };

      setProduct(mappedProduct);
      setActiveImage(0);

      const { data: imagesData, error: imagesError } = await supabase
        .from('product_images')
        .select('url')
        .eq('product_id', id)
        .order('sort_order', { ascending: true });

      if (!imagesError && imagesData && imagesData.length > 0) {
        // Merge any admin-provided `images` jsonb array into the gallery too,
        // always preferring the dedicated product_images table.
        const fromJson: string[] = Array.isArray(data.images)
          ? (data.images as unknown[]).map((x) => String(x)).filter(Boolean)
          : [];
        const merged = [...imagesData.map((row) => row.url)];
        for (const u of fromJson) {
          if (u && !merged.includes(u)) merged.push(u);
        }
        setGallery(merged);
      }

      const { data: variantRows, error: variantErr } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', id)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (!variantErr && variantRows && variantRows.length > 0) {
        setVariants(variantRows as ProductVariant[]);
        const sizes = [
          ...new Set(
            variantRows
              .filter((v: ProductVariant) => v.size)
              .map((v: ProductVariant) => v.size as string)
          ),
        ];
        const colors = [
          ...new Set(
            variantRows
              .filter((v: ProductVariant) => v.color_name)
              .map((v: ProductVariant) => v.color_name as string)
          ),
        ];
        if (sizes.length > 0) setSelectedSize(sizes[0]);
        if (colors.length > 0) setSelectedColor(colors[0]);
        setActiveImage(0);
      }

      setLoading(false);
    }

    loadProduct();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function loadRelated() {
      if (!product) return;
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category', product.category)
        .neq('id', product.id)
        .eq('active', true)
        .limit(8);
      if (cancelled) return;
      if (!error && data) {
        const mapped: Product[] = data.map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
          image: p.image,
          alt: p.alt,
          category: p.category,
          rating: Number(p.rating),
          reviews: Number(p.reviews),
          discount: p.discount != null ? Number(p.discount) : undefined,
          badge: p.badge ?? undefined,
          variant: p.variant ?? undefined,
          brand: p.brand,
          inStock: Boolean(p.in_stock),
        }));
        setRelatedProducts(mapped);
      } else {
        setRelatedProducts([]);
      }
    }
    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category]);

  const addToCartWithQty = () => {
    if (!product) return;
    if (hasVariants && !selectedVariant) return;

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
      discount: product.discount,
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

    for (let i = 0; i < qty; i += 1) {
      addToCart(cartItem);
    }
  };

  const goToCart = () => {
    if (!product) return;
    if (hasVariants && !selectedVariant) return;
    addToCartWithQty();
    router.push('/cart');
  };

  const currentActiveSrc =
    activeImage === videoIndex
      ? ''
      : allImages[activeImage] || allImages[0] || product?.image || '';

  // Mobile swipe between gallery images.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 40;
    if (Math.abs(delta) > threshold && allImages.length > 1 && !hasVideo) {
      if (delta < 0) {
        setActiveImage((i) => (i + 1) % allImages.length);
      } else {
        setActiveImage((i) => (i - 1 + allImages.length) % allImages.length);
      }
    }
    touchStartX.current = null;
  };

  const lowStock =
    hasVariants && selectedVariant ? selectedVariant.stock_quantity : product?.stockQuantity;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">Loading product...</p>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (loadError || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-800 mb-3">Product not found</h1>
            <p className="text-muted-foreground mb-5">
              {loadError || 'This product does not exist.'}
            </p>
            <Link href="/products" className="btn-primary">
              Browse Products
            </Link>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  const showRating = product.rating > 0 && product.reviews > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 sm:pt-24 lg:pt-28 pb-44 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Breadcrumb / back */}
          <nav className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-5">
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
                <span className="text-foreground/80">{product.category}</span>
              </>
            )}
          </nav>

          <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-start">
            {/* ── Media gallery ── */}
            <div className="lg:sticky lg:top-24">
              <div
                className="relative w-full aspect-square rounded-2xl overflow-hidden bg-muted/30 border border-border cursor-zoom-in"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onClick={() => {
                  if (activeImage !== videoIndex && currentActiveSrc) setEnlargeOpen(true);
                }}
              >
                {product.badge && (
                  <span className="absolute top-3 left-3 z-10 bg-accent text-accent-foreground text-xs font-800 px-2.5 py-1 rounded-lg">
                    {product.badge}
                  </span>
                )}
                {product.discount && product.discount > 0 && (
                  <span className="absolute top-3 right-3 z-10 bg-green-600 text-white text-xs font-800 px-2.5 py-1 rounded-lg">
                    {product.discount}% off
                  </span>
                )}

                {activeImage === videoIndex && hasVideo && product?.videoUrl ? (
                  <video
                    src={product.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <AppImage
                    src={currentActiveSrc || product.image}
                    alt={product.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain"
                    objectFit="contain"
                    priority
                  />
                )}
              </div>

              {(allImages.length > 1 || hasVideo) && (
                <div className="flex gap-2.5 mt-3 overflow-x-auto scrollbar-hide pb-1">
                  {allImages.map((img, idx) => {
                    const imgUrl = allImages[idx];
                    return (
                      <button
                        key={`${idx}-${img}`}
                        type="button"
                        onClick={() => setActiveImage(idx)}
                        className={`relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden bg-muted/30 border-2 transition-colors ${
                          activeImage === idx ? 'border-primary' : 'border-transparent'
                        }`}
                        aria-label={`View image ${idx + 1}`}
                      >
                        <AppImage src={imgUrl} alt="" fill sizes="80px" className="object-cover" />
                      </button>
                    );
                  })}
                  {hasVideo && (
                    <button
                      type="button"
                      onClick={() => setActiveImage(videoIndex)}
                      className={`relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden bg-muted/30 border-2 transition-colors ${
                        activeImage === videoIndex ? 'border-primary' : 'border-transparent'
                      }`}
                      aria-label="View product video"
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <span className="absolute bottom-1 left-1 text-[9px] font-700 bg-black/60 text-white px-1.5 py-0.5 rounded">
                        Video
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Product information ── */}
            <div className="bg-card rounded-3xl p-5 md:p-8 card-shadow">
              {/* Brand / category line */}
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest font-700 text-muted-foreground">
                {product.brand && <span className="text-primary">{product.brand}</span>}
                {product.category && <span>· {product.category}</span>}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-800 text-foreground mt-2 leading-tight">
                {product.name}
              </h1>

              {showRating && (
                <Link href="#reviews" className="inline-flex items-center gap-2 mt-4 group">
                  <span className="flex items-center gap-1 bg-green-700 text-white text-xs font-800 px-2 py-0.5 rounded-md">
                    {product.rating.toFixed(1)}
                    <Icon name="StarIcon" size={12} />
                  </span>
                  <span className="text-sm text-muted-foreground group-hover:text-primary">
                    {product.reviews.toLocaleString()} ratings
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-primary group-hover:underline">
                    See all reviews
                  </span>
                </Link>
              )}

              {/* Price block */}
              <div className="mt-5 border-y border-border py-4">
                <div className="flex items-end flex-wrap gap-x-3 gap-y-1">
                  <span className="text-3xl sm:text-4xl font-900 price-deal">
                    {money(effectivePrice)}
                  </span>
                  {effectiveOriginalPrice != null && effectiveOriginalPrice > 0 && (
                    <span className="price-original text-lg">{money(effectiveOriginalPrice)}</span>
                  )}
                  {effectiveDiscount > 0 && (
                    <span className="text-green-700 font-800 text-sm">
                      {effectiveDiscount}% off
                    </span>
                  )}
                </div>
                {effectiveSavings > 0 && (
                  <p className="text-sm text-green-700 font-600 mt-2">
                    You save {money(effectiveSavings)}
                    {product.originalPrice != null ? ' on this product' : ''}
                  </p>
                )}
              </div>

              {/* Availability */}
              <p
                className={`mt-4 inline-flex items-center gap-1.5 text-sm font-700 ${
                  effectiveInStock ? 'text-green-600' : 'text-red-500'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    effectiveInStock ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                {effectiveInStock
                  ? lowStock != null && lowStock > 0 && lowStock <= 5
                    ? `Only ${lowStock} left in stock`
                    : 'In stock · Ready to order'
                  : 'Currently out of stock'}
              </p>

              {/* Variant selection */}
              {hasVariants && (
                <div className="mt-6 space-y-5">
                  {availableSizes.length > 0 && (
                    <div>
                      <p className="text-sm font-700 text-foreground mb-2">
                        Size{' '}
                        {selectedSize && (
                          <span className="text-muted-foreground font-400">— {selectedSize}</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {availableSizes.map((size) => {
                          const sizeVariants = variants.filter(
                            (v) =>
                              v.size === size &&
                              v.active &&
                              (!selectedColor || v.color_name === selectedColor)
                          );
                          const anyInStock = sizeVariants.some((v) => v.stock_quantity > 0);
                          const isSelected = selectedSize === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              disabled={!anyInStock}
                              onClick={() => {
                                setSelectedSize(size);
                                setQty(1);
                              }}
                              className={`min-w-[52px] px-4 py-2 rounded-xl border text-sm font-600 transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : anyInStock
                                    ? 'border-border hover:border-primary/50 text-foreground'
                                    : 'border-border text-muted-foreground/40 cursor-not-allowed line-through'
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {availableColors.length > 0 && (
                    <div>
                      <p className="text-sm font-700 text-foreground mb-2">
                        Color{' '}
                        {selectedColor && (
                          <span className="text-muted-foreground font-400">— {selectedColor}</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {availableColors.map((color) => {
                          const colorVariants = variants.filter(
                            (v) =>
                              v.color_name === color &&
                              v.active &&
                              (!selectedSize || v.size === selectedSize)
                          );
                          const anyInStock = colorVariants.some((v) => v.stock_quantity > 0);
                          const isSelected = selectedColor === color;
                          const colorValue = colorVariants[0]?.color_value;
                          const colorImage = colorVariants.find(
                            (v) => v.image_url && v.image_url !== product?.image
                          )?.image_url;
                          return (
                            <button
                              key={color}
                              type="button"
                              disabled={!anyInStock}
                              onClick={() => {
                                setSelectedColor(color);
                                setQty(1);
                                const img = colorVariants.find(
                                  (v) => v.image_url && v.image_url !== product?.image
                                )?.image_url;
                                if (img) setActiveImage(0);
                              }}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-600 transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : anyInStock
                                    ? 'border-border hover:border-primary/50 text-foreground'
                                    : 'border-border text-muted-foreground/40 cursor-not-allowed'
                              }`}
                            >
                              {colorImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={colorImage}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-border"
                                />
                              ) : colorValue ? (
                                <span
                                  className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                                  style={{ backgroundColor: colorValue }}
                                />
                              ) : null}
                              {color}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedVariant &&
                    selectedVariant.stock_quantity <= 5 &&
                    selectedVariant.stock_quantity > 0 && (
                      <p className="text-xs text-amber-600 font-600">
                        Only {selectedVariant.stock_quantity} left in stock — order soon.
                      </p>
                    )}
                </div>
              )}

              {/* Key facts */}
              {(effectiveSku || product.brand || product.category) && (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-1 gap-2 text-sm">
                  {effectiveSku && (
                    <p className="text-muted-foreground">
                      SKU:{' '}
                      <span className="font-600 text-foreground">
                        {effectiveSku || product.sku}
                      </span>
                    </p>
                  )}
                  {product.brand && (
                    <p className="text-muted-foreground">
                      Brand: <span className="font-600 text-foreground">{product.brand}</span>
                    </p>
                  )}
                  {product.category && (
                    <p className="text-muted-foreground">
                      Category: <span className="font-600 text-foreground">{product.category}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Buy actions */}
              <div className="flex items-center gap-3 mt-7">
                <div className="flex items-center gap-2 border border-border rounded-xl px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="quantity-btn"
                    aria-label="Decrease quantity"
                    disabled={qty <= 1}
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-800">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    className="quantity-btn"
                    aria-label="Increase quantity"
                    disabled={qty >= maxQty}
                  >
                    +
                  </button>
                </div>

                <button
                  disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
                  onClick={addToCartWithQty}
                  className="btn-primary flex-1 justify-center disabled:opacity-50 hidden sm:inline-flex"
                >
                  <Icon name="ShoppingCartIcon" size={18} />
                  Add to Cart ({qty})
                </button>

                <button
                  onClick={() => toggleWishlist(product)}
                  className="w-12 h-12 rounded-xl border border-border flex items-center justify-center hover:bg-muted"
                  aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Icon
                    name="HeartIcon"
                    variant={isInWishlist(product.id) ? 'solid' : 'outline'}
                    size={21}
                    className={isInWishlist(product.id) ? 'text-red-500' : ''}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <button
                  onClick={addToCartWithQty}
                  disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
                  className="btn-primary justify-center disabled:opacity-50 sm:hidden"
                >
                  <Icon name="ShoppingCartIcon" size={18} />
                  Add to Cart ({qty})
                </button>
                <button
                  onClick={goToCart}
                  disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
                  className="btn-primary justify-center bg-accent hover:bg-accent/90 disabled:opacity-50"
                >
                  <Icon name="BoltIcon" size={18} />
                  Buy Now
                </button>
              </div>

              {/* Trust row */}
              <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
                <div className="flex flex-col items-center gap-1.5">
                  <Icon name="TruckIcon" size={20} className="text-primary" />
                  <span>Doorstep delivery</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <Icon name="BanknotesIcon" size={20} className="text-primary" />
                  <span>Cash on delivery</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <Icon name="ShieldCheckIcon" size={20} className="text-primary" />
                  <span>Secure checkout</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Rich admin-controlled content ── */}
          {product.description && (
            <section className="mt-10">
              <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
                <h2 className="text-xl font-800 mb-3">Product Description</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            </section>
          )}

          {/* ── Structured details (products.details JSONB, backward compatible) ── */}
          {product.details && hasProductDetails(product.details) && (
            <section className="mt-10 space-y-6" aria-label="Product details">
              {product.details.highlights.length > 0 && (
                <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
                  <h2 className="text-xl font-800 mb-4">Highlights</h2>
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {product.details.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon name="CheckIcon" size={13} />
                        </span>
                        <span className="leading-relaxed">{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {product.details.specifications.length > 0 && (
                <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
                  <h2 className="text-xl font-800 mb-4">Specifications</h2>
                  {product.details.specifications.map((group, gi) => (
                    <div key={gi} className={gi > 0 ? 'mt-6' : ''}>
                      {group.group && (
                        <h3 className="text-sm font-700 uppercase tracking-wider text-muted-foreground mb-2">
                          {group.group}
                        </h3>
                      )}
                      <dl className="divide-y divide-border border-y border-border">
                        {group.items.map((item, ii) => (
                          <div
                            key={ii}
                            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-2.5 text-sm"
                          >
                            <dt className="text-muted-foreground">{item.key}</dt>
                            <dd className="text-foreground font-500">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              )}

              {product.details.packageContents.length > 0 && (
                <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
                  <h2 className="text-xl font-800 mb-4">What&apos;s in the box</h2>
                  <ul className="space-y-2">
                    {product.details.packageContents.map((c, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-foreground/90">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span className="leading-relaxed">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(product.details.delivery ||
                product.details.warranty ||
                product.details.returns) && (
                <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
                  <h2 className="text-xl font-800 mb-4">Services</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {product.details.delivery && (
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon name="TruckIcon" size={16} />
                        </span>
                        <div>
                          <h3 className="text-sm font-700 mb-0.5">Delivery</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {product.details.delivery}
                          </p>
                        </div>
                      </div>
                    )}
                    {product.details.warranty && (
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon name="ShieldCheckIcon" size={16} />
                        </span>
                        <div>
                          <h3 className="text-sm font-700 mb-0.5">Warranty</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {product.details.warranty}
                          </p>
                        </div>
                      </div>
                    )}
                    {product.details.returns && (
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon name="ArrowPathIcon" size={16} />
                        </span>
                        <div>
                          <h3 className="text-sm font-700 mb-0.5">Returns</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {product.details.returns}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Ratings & reviews ── */}
          <div id="reviews">
            <ReviewsSection productId={id} productName={product.name} />
          </div>

          {/* ── Related products ── */}
          {relatedProducts.length > 0 && (
            <section className="mt-10">
              <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-800">You may also like</h2>
                  <Link
                    href={`/products?category=${encodeURIComponent(product.category || '')}`}
                    className="text-sm font-700 text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                  {relatedProducts.map((rel) => (
                    <Link
                      key={rel.id}
                      href={`/products/${rel.id}`}
                      className="flex-shrink-0 w-44 group"
                    >
                      <div className="bg-muted/30 rounded-xl overflow-hidden product-card-hover">
                        <div className="relative h-32 overflow-hidden bg-muted/30">
                          <AppImage
                            src={rel.image}
                            alt={rel.alt}
                            fill
                            sizes="176px"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="p-2.5 bg-white">
                          <p className="text-xs font-700 text-foreground line-clamp-2 leading-snug mb-1">
                            {rel.name}
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-800 price-deal">{money(rel.price)}</span>
                            {rel.originalPrice && rel.originalPrice > rel.price && (
                              <span className="price-original text-xs">
                                {money(rel.originalPrice)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {rel.inStock ? 'In stock' : 'Out of stock'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ── Mobile sticky purchase bar ── */}
      {effectiveInStock && (
        <div className="lg:hidden fixed bottom-[54px] sm:bottom-[60px] left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-3 pt-2.5 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-border rounded-full px-1 py-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-700 hover:bg-muted transition-colors"
                aria-label="Decrease quantity"
                disabled={qty <= 1}
              >
                −
              </button>
              <span className="w-6 text-center font-800 text-sm">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-700 hover:bg-muted transition-colors"
                aria-label="Increase quantity"
                disabled={qty >= maxQty}
              >
                +
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-800 price-deal leading-tight truncate">
                {money(effectivePrice)}
              </p>
            </div>
            <button
              onClick={addToCartWithQty}
              disabled={!effectiveInStock || qty > maxQty || (hasVariants && !selectedVariant)}
              className="btn-primary flex-1 justify-center px-3 py-2.5 text-sm"
            >
              <Icon name="ShoppingCartIcon" size={16} />
              Add to Cart
            </button>
          </div>
        </div>
      )}

      <Footer />
      <BottomNav />

      {/* ── Image enlarge lightbox ── */}
      {enlargeOpen && currentActiveSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setEnlargeOpen(false)}
          role="dialog"
          aria-label="Product image viewer"
        >
          <button
            type="button"
            onClick={() => setEnlargeOpen(false)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={24} />
          </button>
          {allImages.length > 1 && !hasVideo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImage((i) => (i - 1 + allImages.length) % allImages.length);
              }}
              className="absolute left-2 sm:left-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
              aria-label="Previous image"
            >
              <Icon name="ChevronLeftIcon" size={24} />
            </button>
          )}
          <div
            className="relative max-w-[90vw] max-h-[85vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <AppImage
              src={allImages[activeImage] || currentActiveSrc}
              alt={product.alt}
              fill
              sizes="90vw"
              className="object-contain"
              objectFit="contain"
            />
          </div>
          {allImages.length > 1 && !hasVideo && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage((i) => (i + 1) % allImages.length);
                }}
                className="absolute right-2 sm:right-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
                aria-label="Next image"
              >
                <Icon name="ChevronRightIcon" size={24} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5">
                {allImages.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImage(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === activeImage ? 'bg-white' : 'bg-white/40'
                    }`}
                    aria-label={`Go to image ${idx + 1}`}
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
