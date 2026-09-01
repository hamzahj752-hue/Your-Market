'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

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
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="StarIcon"
          variant={i <= Math.floor(rating) ? 'solid' : 'outline'}
          size={12}
          className={i <= Math.floor(rating) ? 'star-filled' : 'text-muted-foreground/30'}
        />
      ))}
    </div>
  );
}

export default function ProductCard({ product }: { product: CardProduct }) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [added, setAdded] = useState(false);
  const p = product;

  const hasRealRating = p.rating > 0 && p.reviews > 0;
  const hasRealMrp = p.originalPrice != null && p.originalPrice > p.price;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: hasRealMrp ? p.originalPrice : undefined,
      image: p.image,
      category: p.category,
      rating: p.rating,
      discount: p.discount,
      variant: p.variant,
      inStock: p.inStock,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <Link
      href={`/products/${encodeURIComponent(p.id)}`}
      className="group relative flex flex-col h-full bg-card rounded-2xl overflow-hidden border border-border/60 card-shadow product-card-hover"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/40">
        <AppImage
          src={p.image}
          alt={p.alt || p.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
        />

        {/* Wishlist */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            toggleWishlist(p);
          }}
          className="absolute top-2 left-2 z-10 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform active:scale-95"
          aria-label={isInWishlist(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Icon
            name="HeartIcon"
            variant={isInWishlist(p.id) ? 'solid' : 'outline'}
            size={18}
            className={isInWishlist(p.id) ? 'text-red-500' : 'text-foreground'}
          />
        </button>

        {/* Discount badge */}
        {p.discount != null && p.discount > 0 && (
          <div className="absolute top-2 right-2 z-10">
            <span className="badge-deal">-{p.discount}%</span>
          </div>
        )}

        {/* Promo badge */}
        {p.badge && (
          <div className="absolute bottom-2 left-2 z-10">
            <span className="bg-white/95 backdrop-blur-sm text-primary text-[10px] font-700 px-2 py-1 rounded-full shadow-sm">
              {p.badge}
            </span>
          </div>
        )}

        {/* Out of stock overlay */}
        {!p.inStock && (
          <div className="absolute inset-0 bg-white/55 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-foreground/90 text-background text-[11px] font-700 px-3 py-1.5 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] sm:text-xs text-muted-foreground font-600 uppercase tracking-wider truncate">
            {p.category || p.brand}
          </span>
          {p.brand && p.category && (
            <span className="text-[10px] sm:text-xs text-muted-foreground font-500 truncate hidden sm:block">
              {p.brand}
            </span>
          )}
        </div>

        <h3 className="text-[13px] sm:text-sm font-700 text-foreground leading-snug mb-2 line-clamp-2 flex-1 min-h-[2.25rem] group-hover:text-primary transition-colors">
          {p.name}
        </h3>

        {hasRealRating && (
          <div className="flex items-center gap-1.5 mb-2">
            <StarRating rating={p.rating} />
            <span className="text-xs text-muted-foreground font-500">
              {p.rating}
              {p.reviews > 0 && <span> ({p.reviews.toLocaleString()})</span>}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 mb-3 min-w-0">
          <span className="text-[15px] sm:text-lg font-800 text-foreground whitespace-nowrap">
            <span className="price-deal">रू{p.price.toLocaleString()}</span>
          </span>
          {hasRealMrp && (
            <span className="price-original whitespace-nowrap">
              रू{p.originalPrice.toLocaleString()}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!p.inStock}
          className={`w-full py-2 sm:py-2.5 rounded-xl font-700 text-[13px] sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[42px] ${
            !p.inStock
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : added
                ? 'bg-green-500 text-white'
                : 'bg-primary text-primary-foreground hover:bg-blue-600 active:scale-[0.98]'
          }`}
          aria-label={added ? `${p.name} added to cart` : `Add ${p.name} to cart`}
        >
          {added ? (
            <>
              <Icon name="CheckIcon" size={16} />
              Added
            </>
          ) : (
            <>
              <Icon name="ShoppingCartIcon" size={16} />
              {p.inStock ? 'Add to Cart' : 'Out of Stock'}
            </>
          )}
        </button>
      </div>
    </Link>
  );
}
