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
    <section className="section-pad bg-white" aria-labelledby="deals-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <span className="text-deal-red font-700 text-xs sm:text-sm uppercase tracking-widest mb-1 block flex items-center gap-2">
              <Icon name="FireIcon" size={16} className="text-accent" />
              Flash Deals
            </span>
            <h2
              id="deals-heading"
              className="text-section-title font-800 text-foreground leading-tight"
            >
              Today&apos;s Best Offers
            </h2>
          </div>
          {deals.length > 0 && (
            <Link
              href="/products?sale=true"
              className="hidden sm:flex items-center gap-1 text-primary font-600 text-sm hover:gap-2 transition-all flex-shrink-0"
            >
              View all
              <Icon name="ArrowRightIcon" size={14} />
            </Link>
          )}
        </div>

        {/* Deal Cards — grid-cols-2 compact on mobile */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/60 overflow-hidden bg-card">
                <div className="aspect-[4/3] skeleton" />
                <div className="p-3 sm:p-4 space-y-2">
                  <div className="h-3 rounded skeleton w-2/3" />
                  <div className="h-3 rounded skeleton w-full" />
                  <div className="h-5 rounded skeleton w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : deals.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
            {deals.map((p) => (
              <div key={p.id} className="min-w-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <Icon name="TagIcon" size={28} className="text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-700 text-foreground mb-1">No active deals right now</h3>
            <p className="text-sm text-muted-foreground">
              Check the product catalog for the latest offers.
            </p>
            <Link href="/products" className="inline-block mt-4">
              <button className="btn-outline text-sm">
                Browse Products
                <Icon name="ArrowRightIcon" size={15} />
              </button>
            </Link>
          </div>
        )}

        {/* Mobile view all */}
        {deals.length > 0 && (
          <div className="mt-6 flex justify-center sm:hidden">
            <Link href="/products?sale=true" className="w-full max-w-xs">
              <button className="btn-outline w-full justify-center">
                View All Deals
                <Icon name="ArrowRightIcon" size={16} />
              </button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
