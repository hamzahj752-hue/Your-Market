'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
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
          size={10}
          className={i <= Math.floor(rating) ? 'star-filled' : 'text-muted-foreground/30'}
        />
      ))}
    </div>
  );
}

export default function ProductCard({ product }: { product: CardProduct }) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const p = product;

  const hasRealRating = p.rating > 0 && p.reviews > 0;
  const hasRealMrp = p.originalPrice != null && p.originalPrice > p.price;

  return (
    <Link
      href={`/products/${encodeURIComponent(p.id)}`}
      className="group relative flex flex-col h-full bg-card rounded-lg overflow-hidden border border-border/50"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted/40">
        <AppImage
          src={p.image}
          alt={p.alt || p.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-contain w-full h-full transition-transform duration-500 group-hover:scale-105"
        />

        {/* Wishlist */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(p);
          }}
          className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:scale-110 transition-transform active:scale-95"
          aria-label={isInWishlist(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Icon
            name="HeartIcon"
            variant={isInWishlist(p.id) ? 'solid' : 'outline'}
            size={12}
            className={isInWishlist(p.id) ? 'text-red-500' : 'text-foreground'}
          />
        </button>

        {/* Discount badge */}
        {p.discount != null && p.discount > 0 && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <span className="badge-deal text-[8px] px-1 py-0.5">-{p.discount}%</span>
          </div>
        )}

        {/* Out of stock overlay */}
        {!p.inStock && (
          <div className="absolute inset-0 bg-white/55 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-foreground/90 text-background text-[10px] font-700 px-2.5 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-1.5 flex flex-col flex-1 min-w-0">
        <span className="text-[9px] text-muted-foreground font-600 uppercase tracking-wider truncate block mb-0.5">
          {p.category || p.brand}
        </span>

        <h3 className="text-[11px] font-600 text-foreground leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {p.name}
        </h3>

        {hasRealRating && (
          <div className="flex items-center gap-1 mb-1">
            <StarRating rating={p.rating} />
            <span className="text-[10px] text-muted-foreground font-500">
              {p.rating}
              {p.reviews > 0 && <span> ({p.reviews})</span>}
            </span>
          </div>
        )}

        <div className="flex items-baseline gap-1 mb-1.5 min-w-0">
          <span className="text-[12px] sm:text-[13px] font-800 text-foreground whitespace-nowrap">
            <span className="price-deal">रू{p.price.toLocaleString()}</span>
          </span>
          {hasRealMrp && (
            <span className="price-original text-[10px] whitespace-nowrap">
              रू{p.originalPrice.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
