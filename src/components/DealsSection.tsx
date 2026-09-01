'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import ProductCard from '@/components/product/ProductCard';
import { fetchDeals, fetchPromoBanners, BriefDeal, BriefPromo } from '@/lib/homepageCms';

export default function DealsSection() {
  const [deals, setDeals] = useState<BriefDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [promos, setPromos] = useState<BriefPromo[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchDeals(), fetchPromoBanners()]).then(([cmsDeals, cmsPromos]) => {
      if (!active) return;
      setDeals(cmsDeals);
      setPromos(cmsPromos);
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
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-deal-red font-700 text-sm uppercase tracking-widest mb-2 block flex items-center gap-2">
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

        {/* Promo Banner (only from CMS — never fabricated) */}
        {promos.length > 0 && (
          <div className="mt-10 space-y-5">
            {promos.map((promo) => (
              <div
                key={promo.id}
                className="rounded-2xl md:rounded-3xl overflow-hidden relative h-40 md:h-56"
              >
                {promo.image_url && (
                  <AppImage
                    src={promo.image_url}
                    alt={promo.title || 'Promotion'}
                    fill
                    sizes="100vw"
                    className="object-cover w-full h-full"
                  />
                )}
                <div className="absolute inset-0 from-black/60 via-black/30 to-transparent bg-gradient-to-r" />
                <div className="relative z-10 h-full flex items-center justify-between px-6 md:px-12">
                  <div className="max-w-xs">
                    {promo.subtitle && (
                      <p className="text-white/80 text-sm font-600 mb-1">{promo.subtitle}</p>
                    )}
                    <h3 className="text-xl md:text-3xl font-800 text-white leading-tight">
                      {promo.title || 'Limited Time Offer'}
                    </h3>
                  </div>
                  {promo.cta_text && promo.cta_url && promo.cta_url.startsWith('/') && (
                    <Link href={promo.cta_url} className="flex-shrink-0">
                      <button className="bg-white text-accent font-800 px-4 md:px-6 py-2.5 md:py-3 rounded-full shadow-accent">
                        <span className="hidden sm:inline">{promo.cta_text}</span>
                        <span className="sm:hidden">Shop</span>
                        <Icon name="ArrowRightIcon" size={16} className="inline ml-2" />
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
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
