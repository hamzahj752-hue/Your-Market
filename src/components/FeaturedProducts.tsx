'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import ProductCard from '@/components/product/ProductCard';
import { fetchFeaturedProducts, BriefProduct } from '@/lib/homepageCms';

export default function FeaturedProducts() {
  const [products, setProducts] = useState<BriefProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchFeaturedProducts().then((cms) => {
      if (!active) return;
      setProducts(cms);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="py-2 bg-muted/30" aria-labelledby="featured-heading">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-end justify-between mb-2">
          <h2
            id="featured-heading"
            className="text-base sm:text-lg font-800 text-foreground leading-tight"
          >
            Featured Products
          </h2>
          {products.length > 0 && (
            <Link
              href="/products"
              className="hidden sm:flex items-center gap-1 text-primary font-600 text-xs hover:gap-1.5 transition-all"
            >
              See all
              <Icon name="ArrowRightIcon" size={12} />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border/60 overflow-hidden bg-card">
                <div className="aspect-[4/3] skeleton" />
                <div className="p-2 space-y-1.5">
                  <div className="h-2.5 rounded skeleton w-1/3" />
                  <div className="h-2.5 rounded skeleton w-full" />
                  <div className="h-2.5 rounded skeleton w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {products.map((p) => (
              <div key={p.id} className="min-w-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
            <Icon name="SparklesIcon" size={24} className="text-muted-foreground/40 mx-auto mb-2" />
            <h3 className="text-sm font-700 text-foreground mb-1">Featured products coming soon</h3>
            <p className="text-xs text-muted-foreground">Browse the full catalog now.</p>
            <Link href="/products" className="inline-block mt-3">
              <button className="btn-primary text-xs py-2">
                Browse Products
                <Icon name="ArrowRightIcon" size={14} />
              </button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
