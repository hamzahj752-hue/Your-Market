'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useWishlist } from '@/context/WishlistContext';
import {
  normalizeCardImageComposition,
  cardImageStageStyle,
  type CardImageComposition,
  type CardImageFit,
} from '@/lib/cardImageComposition';

export interface CardProduct {
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
  soldOut?: boolean;
  hasVariants?: boolean;
  /** True for Food products (products.food_category_id set). Food items Buy Now
      through the SEPARATE Food checkout — never the normal one. */
  isFood?: boolean;
  /** Per-product Card Image Appearance (admin-managed). Fall back to the safe
      canonical default (contain, 100%, centered) when absent. Only affects the
      card thumbnail — never the Product Details image. */
  cardImageFit?: CardImageFit;
  cardImageScale?: number;
  cardImageX?: number;
  cardImageY?: number;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="StarIcon"
          variant={i <= Math.floor(rating) ? 'solid' : 'outline'}
          size={10}
          className={i <= Math.floor(rating) ? 'star-filled' : 'text-muted-foreground/30'}
        />
      ))}
    </div>
  );
}

function PriceBlock({ p }: { p: CardProduct }) {
  const hasRealMrp = p.originalPrice != null && p.originalPrice > p.price;
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span className="text-[15px] font-extrabold text-foreground">
        रू{p.price.toLocaleString('en-IN')}
      </span>
      {hasRealMrp && (
        <span className="text-[10px] text-muted-foreground line-through">
          रू{p.originalPrice.toLocaleString('en-IN')}
        </span>
      )}
    </div>
  );
}

/** Buy-Now intent for a product shown on Home. Ordering a wrong variant is
 *  worse than asking for a selection, so products with real active variants go
 *  to Product Details while simple products go straight to the safe
 *  server-resolved `/checkout?buyNow=1` intent. */
function useBuyNow() {
  const router = useRouter();
  return (p: CardProduct) => {
    if (p.hasVariants) {
      router.push(`/products/${encodeURIComponent(p.id)}?buyNow=need-selection`);
      return;
    }
    if (p.isFood) {
      // Food products order through the dedicated Food checkout flow — they are
      // never allowed into the normal product checkout or cart.
      router.push(`/food-checkout?buyNow=1&product=${encodeURIComponent(p.id)}&qty=1`);
      return;
    }
    router.push(`/checkout?buyNow=1&product=${encodeURIComponent(p.id)}&qty=1`);
  };
}

/**
 * The image stage inside a card media box. Scales and pans the MAIN image
 * per the saved per-product framing while the parent media box (overflow
 * hidden) keeps everything clipped to the card. objectFit is passed through
 * the AppImage `objectFit` prop (not a className) so external URLs — which
 * AppImage renders with an inline style — honor the same fit as internal ones.
 */
function FramedCardImage({
  product,
  comp,
  sizes,
  imageClassName,
}: {
  product: CardProduct;
  comp: CardImageComposition;
  sizes: string;
  imageClassName?: string;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={cardImageStageStyle({ zoom: comp.zoom, x: comp.x, y: comp.y })}
    >
      <div className="absolute inset-0 overflow-hidden">
        <AppImage
          src={product.image}
          alt={product.alt || product.name}
          fill
          sizes={sizes}
          objectFit={comp.fit}
          className={imageClassName}
        />
      </div>
    </div>
  );
}

/**
 * Product presentation card.
 *
 * `grid` — the compact vertical card for dense catalog browsing on /products.
 *
 * `wide` — the premium Home presentation: strong image left, minimal
 * product information right, real price and a dark Buy Now pill.
 *
 * `compact` — the shared image-first marketplace cell used by Home "All
 * Products" and the Product Details bottom "All Products" listing. Prioritizes
 * IMAGE -> NAME -> PRICE with a tiny wishlist heart; no in-card Buy Now pill
 * (Buy Now lives inside Product Details). Whole card links to Product Details.
 */
export default function ProductCard({
  product,
  variant = 'grid',
}: {
  product: CardProduct;
  variant?: 'grid' | 'wide' | 'compact';
}) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const buyNow = useBuyNow();

  // Saved per-product Card Image Appearance, normalized to safe defaults so
  // legacy products (and products on databases without the migration) render
  // exactly as before: contain, 100%, centered.
  const comp = normalizeCardImageComposition({
    cardImageFit: product.cardImageFit,
    cardImageScale: product.cardImageScale,
    cardImageX: product.cardImageX,
    cardImageY: product.cardImageY,
  });

  if (variant === 'wide') {
    return (
      <div className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-2">
        {/* Overlay card link covering the whole card (thumbnail + text). The
            interactive buttons below sit above it at z-20 and stop the click
            from navigating. */}
        <Link
          href={`/products/${encodeURIComponent(product.id)}`}
          className="absolute inset-0 z-10 rounded-2xl"
          aria-label={`View ${product.name}`}
          tabIndex={0}
        />

        {/* Thumbnail */}
        <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-xl bg-[#f7f4ee] sm:h-[104px] sm:w-[104px]">
          <FramedCardImage product={product} comp={comp} sizes="104px" />

          {/* Out of stock */}
          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-[1px]">
              <span className="rounded-full bg-foreground/90 px-2 py-0.5 text-[8px] font-bold text-background">
                {product.soldOut ? 'Sold Out' : 'Out of Stock'}
              </span>
            </div>
          )}

          {/* Wishlist — over the thumbnail corner, above the card link */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product);
            }}
            className="absolute right-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110 active:scale-95"
            aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Icon
              name="HeartIcon"
              variant={isInWishlist(product.id) ? 'solid' : 'outline'}
              size={13}
              className={isInWishlist(product.id) ? 'text-red-500' : 'text-foreground'}
            />
          </button>
        </div>

        {/* Info fills the remaining width. Name reserves two lines and the
            rating row always holds its slot so every wide card (Home, food
            category pages) renders the exact same height regardless of how
            long the product name is or whether it has reviews. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1 pr-1">
          {product.category && (
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
              {product.category}
            </span>
          )}

          <h3 className="line-clamp-2 min-h-[2.75em] text-[13px] font-bold leading-snug text-foreground">
            {product.name}
          </h3>

          <div className="flex min-h-[16px] items-center gap-1">
            {product.rating > 0 && product.reviews > 0 && (
              <>
                <Icon name="StarIcon" variant="solid" size={10} className="star-filled" />
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {product.rating}
                </span>
              </>
            )}
          </div>

          <PriceBlock p={product} />

          <div className="mt-1 flex justify-end">
            <button
              type="button"
              disabled={!product.inStock}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                buyNow(product);
              }}
              className="relative z-20 inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2 text-[11px] font-extrabold text-background transition-all hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Buy ${product.name} now`}
            >
              Buy Now
              <Icon name="ArrowRightIcon" size={11} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card">
        {/* Whole-card link to Product Details (heart sits above it). */}
        <Link
          href={`/products/${encodeURIComponent(product.id)}`}
          className="absolute inset-0 z-10 rounded-xl"
          aria-label={`View ${product.name}`}
          tabIndex={0}
        />

        {/* Image — the visual focus. Missing/errored images render the same
            full block so the 3-column layout never collapses. Framed by the
            per-product Card Image Appearance (default: contain, 100%, centered). */}
        <div className="relative aspect-square overflow-hidden bg-[#f7f4ee]">
          <FramedCardImage
            product={product}
            comp={comp}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
          />

          {/* Tiny wishlist heart — above the card link */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product);
            }}
            className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110 active:scale-95"
            aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Icon
              name="HeartIcon"
              variant={isInWishlist(product.id) ? 'solid' : 'outline'}
              size={11}
              className={isInWishlist(product.id) ? 'text-red-500' : 'text-foreground'}
            />
          </button>

          {/* Tiny discount chip — only when real */}
          {product.discount != null && product.discount > 0 && (
            <div className="absolute left-1 top-1">
              <span className="rounded-full bg-foreground/90 px-1 py-0.5 text-[7px] font-extrabold text-background">
                -{product.discount}%
              </span>
            </div>
          )}

          {/* Out of stock overlay */}
          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-[1px]">
              <span className="rounded-full bg-foreground/90 px-1.5 py-0.5 text-[7px] font-bold text-background">
                {product.soldOut ? 'Sold Out' : 'Out of Stock'}
              </span>
            </div>
          )}
        </div>

        {/* Content — compact name + real price. The name reserves two lines and
            the rating slot always holds its height so every 3-column cell in
            the All Products grid stays the same visual height even when a
            product has a short name or no reviews yet. */}
        <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-1">
          <h3 className="line-clamp-2 min-h-[2.5em] text-[10px] font-bold leading-tight text-foreground">
            {product.name}
          </h3>

          <div className="mt-0.5 flex min-h-[16px] items-center gap-0.5">
            {product.rating > 0 && product.reviews > 0 && (
              <>
                <Icon name="StarIcon" variant="solid" size={8} className="star-filled" />
                <span className="text-[8.5px] font-semibold text-muted-foreground">
                  {product.rating}
                </span>
              </>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-baseline gap-x-1">
            <span className="text-[11px] font-extrabold text-foreground">
              रू{product.price.toLocaleString('en-IN')}
            </span>
            {product.originalPrice != null && product.originalPrice > product.price && (
              <span className="text-[8px] text-muted-foreground line-through">
                रू{product.originalPrice.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card">
      {/* Overlay card link covering the whole card (image + text). */}
      <Link
        href={`/products/${encodeURIComponent(product.id)}`}
        className="absolute inset-0 z-10 rounded-2xl"
        aria-label={`View ${product.name}`}
        tabIndex={0}
      />

      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[#f7f4ee]">
        <FramedCardImage
          product={product}
          comp={comp}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          imageClassName="transition-transform duration-500 group-hover:scale-105"
        />

        {/* Wishlist — above the card link */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
          }}
          className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 shadow-sm transition-transform hover:scale-110 active:scale-95"
          aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Icon
            name="HeartIcon"
            variant={isInWishlist(product.id) ? 'solid' : 'outline'}
            size={13}
            className={isInWishlist(product.id) ? 'text-red-500' : 'text-foreground'}
          />
        </button>

        {/* Discount chip — subtle, only when real */}
        {product.discount != null && product.discount > 0 && (
          <div className="absolute left-2 top-2">
            <span className="rounded-full bg-foreground/90 px-2 py-1 text-[9px] font-extrabold text-background">
              -{product.discount}%
            </span>
          </div>
        )}

        {/* Out of stock overlay */}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-[1px]">
            <span className="rounded-full bg-foreground/90 px-2.5 py-1 text-[9px] font-bold text-background">
              {product.soldOut ? 'Sold Out' : 'Out of Stock'}
            </span>
          </div>
        )}
      </div>

      {/* Content. The category line is always present, the name reserves two
          lines and the rating slot keeps its height, so every catalog card in
          a row renders the same visual height. */}
      <div className="flex flex-1 flex-col p-2">
        <span className="mb-0.5 text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground/80">
          {product.category || product.brand}
        </span>

        <h3 className="mb-1 line-clamp-2 min-h-[2.75em] text-[11.5px] font-bold leading-snug text-foreground">
          {product.name}
        </h3>

        <div className="mb-1 flex min-h-[18px] items-center gap-1">
          {product.rating > 0 && product.reviews > 0 && (
            <>
              <StarRating rating={product.rating} />
              <span className="text-[9.5px] font-medium text-muted-foreground">
                {product.rating}
                {product.reviews > 0 && <span> ({product.reviews})</span>}
              </span>
            </>
          )}
        </div>

        <div className="mt-auto flex items-baseline gap-1">
          <span className="text-[12.5px] font-extrabold text-foreground">
            रू{product.price.toLocaleString('en-IN')}
          </span>
          {product.originalPrice != null && product.originalPrice > product.price && (
            <span className="text-[9.5px] text-muted-foreground line-through">
              रू{product.originalPrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        <div className="mt-1.5">
          <button
            type="button"
            disabled={!product.inStock}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              buyNow(product);
            }}
            className="relative z-20 inline-flex w-full items-center justify-center gap-1 rounded-full bg-foreground px-3 py-2 text-[11px] font-extrabold text-background transition-all hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Buy ${product.name} now`}
          >
            Buy Now
            <Icon name="ArrowRightIcon" size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
