'use client';

import React from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';

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
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1,2,3,4,5].map(i => (
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

export default function ProductGrid({ products }: { products: Product[] }) {
  const { addToCart } = useCart();
  const [addedIds, setAddedIds] = React.useState<Set<string>>(new Set());

  const handleAdd = (p: Product) => {
    addToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      image: p.image,
      category: p.category,
      rating: p.rating,
      discount: p.discount,
      variant: p.variant,
    });
    setAddedIds(prev => new Set([...prev, p.id]));
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }, 1800);
  };

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Icon name="MagnifyingGlassIcon" size={48} className="text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-700 text-foreground mb-2">No products found</h3>
        <p className="text-muted-foreground text-sm">Try adjusting your filters or search query.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {products.map(p => (
        <div key={p.id} className="bg-card rounded-2xl overflow-hidden card-shadow product-card-hover group flex flex-col">
          {/* Image */}
          <div className="relative h-52 overflow-hidden bg-muted/30">
            <AppImage
              src={p.image}
              alt={p.alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
            {p.discount && (
              <div className="absolute top-3 left-3">
                <span className="badge-deal">-{p.discount}%</span>
              </div>
            )}
            {p.badge && (
              <div className="absolute top-3 right-3">
                <span className="bg-white/90 backdrop-blur-sm text-primary text-[10px] font-700 px-2 py-1 rounded-full">
                  {p.badge}
                </span>
              </div>
            )}
            {!p.inStock && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                <span className="bg-foreground/90 text-background text-xs font-700 px-3 py-1.5 rounded-full">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-600 uppercase tracking-wider">
                {p.category}
              </span>
              <span className="text-xs text-muted-foreground font-500">{p.brand}</span>
            </div>
            <h3 className="text-sm font-700 text-foreground leading-snug mb-2 line-clamp-2 flex-1">
              {p.name}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <StarRating rating={p.rating} />
              <span className="text-xs text-muted-foreground">
                {p.rating} ({p.reviews.toLocaleString()})
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-lg font-800 price-deal">रू{p.price.toLocaleString()}</span>
              {p.originalPrice && (
                <span className="price-original">रू{p.originalPrice.toLocaleString()}</span>
              )}
            </div>
            <button
              onClick={() => handleAdd(p)}
              disabled={!p.inStock}
              className={`w-full py-2.5 rounded-xl font-700 text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                !p.inStock
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : addedIds.has(p.id)
                  ? 'bg-green-500 text-white' :'bg-primary text-primary-foreground hover:bg-blue-600 active:scale-95'
              }`}
              aria-label={`Add ${p.name} to cart`}
            >
              {addedIds.has(p.id) ? (
                <>
                  <Icon name="CheckIcon" size={16} />
                  Added!
                </>
              ) : (
                <>
                  <Icon name="ShoppingCartIcon" size={16} />
                  {p.inStock ? 'Add to Cart' : 'Out of Stock'}
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}