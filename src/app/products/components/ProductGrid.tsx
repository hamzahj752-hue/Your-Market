'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import ProductCard, { CardProduct } from '@/components/product/ProductCard';

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
  sku?: string;
  inStock: boolean;
}

export default function ProductGrid({
  products,
  onClear,
}: {
  products: Product[];
  onClear?: () => void;
}) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <Icon name="MagnifyingGlassIcon" size={44} className="text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-700 text-foreground mb-2">No products found</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Try adjusting your filters or search query.
        </p>
        {onClear && (
          <button
            onClick={onClear}
            className="mt-5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-700 text-sm hover:bg-blue-600 transition-colors"
          >
            Clear search &amp; filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
      {products.map((p) => (
        <div key={p.id} className="min-w-0">
          <ProductCard product={p as CardProduct} />
        </div>
      ))}
    </div>
  );
}
