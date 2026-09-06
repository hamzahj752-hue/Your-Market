'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { fetchHomepageCategories, BriefCategory } from '@/lib/homepageCms';

const fallbackCategories: Pick<BriefCategory, 'id' | 'name' | 'image'>[] = [
  { id: 'electronics', name: 'Electronics', image: null },
  { id: 'fashion', name: 'Fashion', image: null },
  { id: 'home', name: 'Home & Kitchen', image: null },
  { id: 'beauty', name: 'Beauty', image: null },
  { id: 'sports', name: 'Sports', image: null },
  { id: 'books', name: 'Books', image: null },
];

/**
 * Image-first "Shop by Category" discovery tiles.
 *
 * Deliberately distinct from the compact top navigation strip — these are
 * larger, roughly-square discovery tiles led by real category imagery (or the
 * existing icon fallback; never fabricated artwork). Horizontal scrolling with
 * the next tile partially visible on mobile.
 */
export default function CategoriesSection() {
  const [catItems, setCatItems] = useState<BriefCategory[]>([]);

  useEffect(() => {
    let active = true;
    fetchHomepageCategories().then((cms) => {
      if (!active) return;
      if (cms.length > 0) setCatItems(cms);
    });
    return () => {
      active = false;
    };
  }, []);

  const items: BriefCategory[] =
    catItems.length > 0 ? catItems : (fallbackCategories as BriefCategory[]);

  return (
    <section className="bg-white py-3" aria-labelledby="categories-heading">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-3 sm:px-4 mb-2">
          <h2
            id="categories-heading"
            className="text-sm sm:text-base font-800 text-foreground leading-tight"
          >
            Shop by Category
          </h2>
          <Link
            href="/products"
            className="flex items-center gap-1 text-primary font-600 text-xs hover:gap-1.5 transition-all"
          >
            View all
            <Icon name="ArrowRightIcon" size={12} />
          </Link>
        </div>

        <div
          className="flex items-stretch gap-2 overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1 sm:-mx-4 sm:px-4"
          role="navigation"
          aria-label="Browse categories"
        >
          {items.map((c, i) => (
            <Link
              key={c.id || `${c.name}-${i}`}
              href={`/products?category=${encodeURIComponent(c.name)}`}
              className="flex w-[92px] sm:w-[104px] flex-shrink-0 flex-col gap-1.5 rounded-2xl border border-border/60 bg-card p-2 transition-colors hover:border-primary/40"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#f7f4ee]">
                {c.image ? (
                  <AppImage src={c.image} alt="" fill className="object-cover" sizes="104px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10 text-primary">
                    <Icon name="FolderIcon" size={24} />
                  </div>
                )}
              </div>
              <span className="line-clamp-1 text-center text-[11px] font-700 text-foreground leading-tight">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
