'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import CategoryCard from '@/components/CategoryCard';
import { fetchHomepageCategories, BriefCategory } from '@/lib/homepageCms';
import { fetchCategoryCardStyle, ResolvedCategoryCardStyle } from '@/lib/categoryCardStyle';

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
  const [style, setStyle] = useState<ResolvedCategoryCardStyle | null>(null);

  useEffect(() => {
    let active = true;
    fetchHomepageCategories().then((cms) => {
      if (!active) return;
      if (cms.length > 0) setCatItems(cms);
    });
    fetchCategoryCardStyle('categories').then((resolved) => {
      if (!active) return;
      setStyle(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  const items: BriefCategory[] =
    catItems.length > 0 ? catItems : (fallbackCategories as BriefCategory[]);

  const resolvedStyle = style ?? {
    cardClass: 'rounded-2xl',
    imageClass: 'rounded-lg',
    widthClass: 'w-[92px] sm:w-[104px]',
    gapClass: 'gap-2',
    paddingClass: 'p-2',
    labelClass: 'text-[11px]',
    iconSize: 24,
  };

  return (
    <section className="bg-white py-3" aria-labelledby="categories-heading">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-3 sm:px-4 mb-2">
          <h2
            id="categories-heading"
            className="text-base font-800 leading-tight text-foreground sm:text-lg"
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
          className={`flex items-stretch ${resolvedStyle.gapClass} overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1 sm:-mx-4 sm:px-4`}
          role="navigation"
          aria-label="Browse categories"
        >
          {items.map((c, i) => (
            <CategoryCard
              key={c.id || `${c.name}-${i}`}
              spec={{
                key: c.id || `${c.name}-${i}`,
                name: c.name,
                image: c.image,
                href: `/products?category=${encodeURIComponent(c.name)}`,
              }}
              style={resolvedStyle}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
