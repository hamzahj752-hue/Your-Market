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
    <section className="section-pad bg-muted/40" aria-labelledby="featured-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-accent font-700 text-sm uppercase tracking-widest mb-2 block">
              Curated for You
            </span>
            <h2
              id="featured-heading"
              className="text-section-title font-800 text-foreground leading-tight"
            >
              Featured Products
            </h2>
          </div>
          {products.length > 0 && (
            <Link
              href="/products"
              className="hidden sm:flex items-center gap-1 text-primary font-600 text-sm hover:gap-2 transition-all"
            >
              See all
              <Icon name="ArrowRightIcon" size={14} />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl border border-border/60 overflow-hidden bg-card">
                <div className="aspect-[4/3] skeleton" />
                <div className="p-3 sm:p-4 space-y-2">
                  <div className="h-3 rounded skeleton w-1/3" />
                  <div className="h-3 rounded skeleton w-full" />
                  <div className="h-3 rounded skeleton w-2/3" />
                  <div className="h-9 rounded-xl skeleton mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
            {products.map((p) => (
              <div key={p.id} className="min-w-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-background px-6 py-12 text-center">
            <Icon name="SparklesIcon" size={28} className="text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-700 text-foreground mb-1">
              Featured products coming soon
            </h3>
            <p className="text-sm text-muted-foreground">
              We&apos;re showcasing our latest products here. Browse the full catalog now.
            </p>
            <Link href="/products" className="inline-block mt-4">
              <button className="btn-primary text-sm">
                Browse Products
                <Icon name="ArrowRightIcon" size={15} />
              </button>
            </Link>
          </div>
        )}

        {/* Mobile see all */}
        {products.length > 0 && (
          <div className="mt-6 flex justify-center sm:hidden">
            <Link href="/products" className="w-full max-w-xs">
              <button className="btn-outline w-full justify-center">
                See All Products
                <Icon name="ArrowRightIcon" size={16} />
              </button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
