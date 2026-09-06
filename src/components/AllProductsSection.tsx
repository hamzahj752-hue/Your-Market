'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import ProductCard from '@/components/product/ProductCard';
import { fetchAllProducts, attachVariantPresence, BriefProduct } from '@/lib/homepageCms';

export default function AllProductsSection() {
  const [products, setProducts] = useState<BriefProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    let active = true;
    fetchAllProducts(24)
      .then((list) => attachVariantPresence(list))
      .then((list) => {
        if (!active) return;
        setProducts(list);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /*
   * Live Admin-driven categories derived from the actual product catalog —
   * never hard-coded demo data. Sorted by product count so the most relevant
   * chips lead.
   */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (!p.category) continue;
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  return (
    <section className="bg-white py-2" aria-labelledby="all-products-heading">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2
            id="all-products-heading"
            className="text-base font-800 leading-tight text-foreground sm:text-lg"
          >
            All Products
          </h2>
          <Link
            href="/products"
            className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary transition-all hover:gap-1.5"
          >
            See All
            <Icon name="ArrowRightIcon" size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border/50 bg-card">
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
            {/*
             * Category pills. The active chip eases into the dark YourMarket
             * active state while the rest stay quiet.
             */}
            <div
              className="scrollbar-hide -mx-3 mb-3 flex items-center gap-1 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 md:flex-wrap md:overflow-visible"
              aria-label="Filter products by category"
            >
              <button
                type="button"
                aria-pressed={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
                className={`ym-chip shrink-0 rounded-full border px-2 py-[2px] text-[11px] font-700 leading-none ${
                  activeCategory === 'all'
                    ? 'border-primary bg-primary text-white'
                    : 'border-border/70 bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                All
              </button>

              {categories.map((category) => {
                const active = activeCategory === category.name;

                return (
                  <button
                    key={category.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveCategory(category.name)}
                    className={`ym-chip shrink-0 rounded-full border px-2 py-[2px] text-[11px] font-700 leading-none ${
                      active
                        ? 'border-primary bg-primary text-white'
                        : 'border-border/70 bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {category.name}

                    <span
                      className={active ? 'ml-1 text-white/70' : 'ml-1 text-muted-foreground/50'}
                    >
                      · {category.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/*
             * Compact image-first marketplace grid — 3 products per row on
             * normal mobile, more columns on larger screens. Each cell uses
             * the shared compact ProductCard so Home and Product Details' bottom
             * listing stay visually identical.
             */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredProducts.map((p, index) => (
                <div
                  key={p.id}
                  className="ym-list min-w-0"
                  style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
                >
                  <ProductCard product={p} variant="compact" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <Icon
              name="ShoppingBagIcon"
              size={24}
              className="mx-auto mb-2 text-muted-foreground/40"
            />
            <h3 className="mb-1 text-sm font-700 text-foreground">No products yet</h3>
            <p className="text-xs text-muted-foreground">
              Products will appear here as soon as they&apos;re added.
            </p>
            <Link href="/products" className="mt-3 inline-block">
              <button className="btn-outline py-2 text-xs">
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
