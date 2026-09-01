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
  inStock: boolean;
}

export default function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <Icon name="MagnifyingGlassIcon" size={44} className="text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-700 text-foreground mb-2">No products found</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Try adjusting your filters or search query.
        </p>
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
