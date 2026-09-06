'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import ProductCard from '@/components/product/ProductCard';
import { fetchFeaturedProducts, attachVariantPresence, BriefProduct } from '@/lib/homepageCms';

export default function FeaturedProducts() {
  const [products, setProducts] = useState<BriefProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchFeaturedProducts()
      .then((cms) => attachVariantPresence(cms))
      .then((list) => {
        if (!active) return;
        setProducts(list);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="bg-white py-2" aria-labelledby="featured-heading">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2
            id="featured-heading"
            className="text-base font-800 leading-tight text-foreground sm:text-lg"
          >
            Featured Products
          </h2>
          {products.length > 0 && (
            <Link
              href="/products"
              className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary transition-all hover:gap-1.5"
            >
              See All
              <Icon name="ArrowRightIcon" size={12} />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex gap-2 overflow-hidden">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="w-[42%] shrink-0 overflow-hidden rounded-xl border border-border/50 bg-card sm:w-[190px]"
              >
                <div className="aspect-square skeleton" />
                <div className="space-y-1 p-1.5">
                  <div className="h-2 w-full skeleton" />
                  <div className="h-2 w-2/3 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="scrollbar-hide -mx-3 flex gap-2 overflow-x-auto snap-x snap-mandatory px-3 pb-1 sm:-mx-4 sm:px-4 md:hidden">
              {products.map((p) => (
                <div key={p.id} className="w-[42%] shrink-0 snap-start sm:w-[190px]">
                  <ProductCard product={p} variant="compact" />
                </div>
              ))}
            </div>
            <div className="hidden gap-2 md:grid md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <div key={p.id} className="min-w-0">
                  <ProductCard product={p} variant="compact" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <Icon name="SparklesIcon" size={24} className="mx-auto mb-2 text-muted-foreground/40" />
            <h3 className="mb-1 text-sm font-700 text-foreground">Featured products coming soon</h3>
            <p className="text-xs text-muted-foreground">Browse the full catalog now.</p>
            <Link href="/products" className="mt-3 inline-block">
              <button className="btn-primary py-2 text-xs">
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
