'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import ProductCard from '@/components/product/ProductCard';
import { fetchDeals, BriefDeal } from '@/lib/homepageCms';

export default function DealsSection() {
  const [deals, setDeals] = useState<BriefDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchDeals().then((cmsDeals) => {
      if (!active) return;
      setDeals(cmsDeals);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="py-2 bg-white" aria-labelledby="deals-heading">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-end justify-between gap-3 mb-2">
          <h2
            id="deals-heading"
            className="text-base sm:text-lg font-800 text-foreground leading-tight flex items-center gap-1.5"
          >
            <Icon name="FireIcon" size={16} className="text-accent" />
            Flash Deals
          </h2>
          {deals.length > 0 && (
            <Link
              href="/products?sale=true"
              className="hidden sm:flex items-center gap-1 text-primary font-600 text-xs hover:gap-1.5 transition-all flex-shrink-0"
            >
              View all
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
                  <div className="h-2.5 rounded skeleton w-2/3" />
                  <div className="h-2.5 rounded skeleton w-full" />
                  <div className="h-3.5 rounded skeleton w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : deals.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {deals.map((p) => (
              <div key={p.id} className="min-w-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <Icon name="TagIcon" size={24} className="text-muted-foreground/40 mx-auto mb-2" />
            <h3 className="text-sm font-700 text-foreground mb-1">No active deals right now</h3>
            <p className="text-xs text-muted-foreground">
              Check the product catalog for the latest offers.
            </p>
            <Link href="/products" className="inline-block mt-3">
              <button className="btn-outline text-xs py-2">
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
