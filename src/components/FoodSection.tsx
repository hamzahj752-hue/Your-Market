'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import CategoryCard from '@/components/CategoryCard';
import {
  fetchFoodSection,
  FoodSection as FoodSectionData,
  foodCategoryHref,
} from '@/lib/homepageCms';
import { fetchCategoryCardStyle, ResolvedCategoryCardStyle } from '@/lib/categoryCardStyle';

/**
 * Admin-managed "Food" tile row, placed between "Shop by Category" and the
 * "Request a Product" banner. Shares the same image-first visual language as
 * the Shop by Category row and consumes the same Admin → Homepage category-card
 * appearance configuration (food section preset).
 *
 * Deliberately differs from CategoriesSection:
 *  - Fully admin-controlled (whole-section ON/OFF + title + real categories +
 *    artwork/order/visibility per item). There is NO hard-coded fallback list —
 *    when the section is disabled or has no configured items it renders nothing
 *    rather than inventing fake food content.
 *  - Every card navigates to its real category landing page
 *    (/{slug}page/all{slug}). The customer then taps a product on that page to
 *    reach Product Details. The View All link goes to the /food discovery hub.
 */
export default function FoodSection() {
  const [section, setSection] = useState<FoodSectionData | null>(null);
  const [style, setStyle] = useState<ResolvedCategoryCardStyle | null>(null);

  useEffect(() => {
    let active = true;
    fetchFoodSection().then((s) => {
      if (!active) return;
      setSection(s);
    });
    fetchCategoryCardStyle('food').then((resolved) => {
      if (!active) return;
      setStyle(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!section || !section.enabled || section.items.length === 0) return null;

  const { title, items } = section;
  const headingId = 'food-heading';
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
    <section className="bg-white py-3" aria-labelledby={headingId}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-3 sm:px-4 mb-2">
          <h2
            id={headingId}
            className="text-base font-800 leading-tight text-foreground sm:text-lg"
          >
            {title}
          </h2>
          <Link
            href="/food"
            className="flex items-center gap-1 text-primary font-600 text-xs hover:gap-1.5 transition-all"
          >
            View all
            <Icon name="ArrowRightIcon" size={12} />
          </Link>
        </div>

        <div
          className={`flex items-stretch ${resolvedStyle.gapClass} overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1 sm:-mx-4 sm:px-4`}
          role="navigation"
          aria-label={`${title} categories`}
        >
          {items.map((c, i) => (
            <CategoryCard
              key={c.id || `${c.name}-${i}`}
              spec={{
                key: c.id || `${c.name}-${i}`,
                name: c.name,
                image: c.image,
                href: foodCategoryHref(c),
              }}
              style={resolvedStyle}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
