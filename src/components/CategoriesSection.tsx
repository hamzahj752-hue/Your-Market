'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { fetchHomepageCategories, BriefCategory } from '@/lib/homepageCms';

// Neutral fallback categories — no fabricated product counts.
const fallbackCategories: Pick<BriefCategory, 'id' | 'name' | 'image'>[] = [
  { id: 'electronics', name: 'Electronics', image: null },
  { id: 'fashion', name: 'Fashion', image: null },
  { id: 'home', name: 'Home & Kitchen', image: null },
  { id: 'beauty', name: 'Beauty', image: null },
  { id: 'sports', name: 'Sports', image: null },
  { id: 'books', name: 'Books', image: null },
  { id: 'toys', name: 'Toys & Games', image: null },
  { id: 'grocery', name: 'Grocery & Fresh', image: null },
];

const accentFor = (name: string) => {
  const map: Record<string, string> = {
    Electronics: 'from-blue-600/80 to-primary/80',
    Fashion: 'from-pink-600/80 to-purple-700/80',
    'Home & Kitchen': 'from-amber-600/80 to-orange-700/80',
    Beauty: 'from-rose-500/80 to-pink-700/80',
    Sports: 'from-green-600/80 to-teal-700/80',
    Books: 'from-yellow-600/80 to-amber-700/80',
    'Toys & Games': 'from-violet-600/80 to-purple-800/80',
    'Grocery & Fresh': 'from-emerald-600/80 to-green-800/80',
  };
  return map[name] || 'from-primary/70 to-blue-600/70';
};

export default function CategoriesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const cards = section.querySelectorAll<HTMLElement>('.cat-card');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
            setTimeout(() => {
              el.classList.add('animate-fade-up');
              el.style.opacity = '1';
            }, idx * 60);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    cards.forEach((card) => {
      card.style.opacity = '0';
      observer.observe(card);
    });
    return () => observer.disconnect();
  }, [catItems.length]);

  const items: BriefCategory[] =
    catItems.length > 0 ? catItems : (fallbackCategories as BriefCategory[]);

  return (
    <section className="section-pad bg-white" ref={sectionRef} aria-labelledby="categories-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-4 md:mb-6">
          <div>
            <span className="text-accent font-700 text-xs sm:text-sm uppercase tracking-widest mb-1 block">
              Browse
            </span>
            <h2
              id="categories-heading"
              className="text-2xl md:text-3xl lg:text-4xl font-800 text-foreground leading-tight"
            >
              Shop by Category
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden sm:flex items-center gap-1 text-primary font-600 text-sm hover:gap-2 transition-all"
          >
            View all
            <Icon name="ArrowRightIcon" size={14} />
          </Link>
        </div>

        {/* Responsive grid: 2 compact cols on phones, more on larger screens */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
          {items.map((c, i) => {
            return (
              <div
                key={c.id || `${c.name}-${i}`}
                data-idx={i}
                className="cat-card animate-on-scroll"
              >
                <Link
                  href={`/products?category=${encodeURIComponent(c.name)}`}
                  className="block h-full"
                >
                  <div
                    className={`relative h-32 sm:h-36 md:h-40 lg:h-44 rounded-2xl overflow-hidden category-card-hover cursor-pointer group bg-primary/70`}
                  >
                    {c.image ? (
                      <AppImage
                        src={c.image}
                        alt={c.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${accentFor(c.name)}`} />
                    )}

                    {/* Consistent readable overlay */}
                    <div className="absolute inset-0 from-black/55 to-transparent bg-gradient-to-t" />

                    <div className="absolute inset-0 p-2.5 md:p-4 flex flex-col justify-end">
                      <h3 className="text-white font-800 text-sm md:text-lg leading-tight line-clamp-2">
                        {c.name}
                      </h3>
                      <p className="text-white/75 text-xs font-500 mt-0.5 inline-flex items-center gap-1">
                        Shop now
                        <Icon name="ArrowRightIcon" size={12} />
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Mobile view all */}
        <div className="mt-4 flex justify-center sm:hidden">
          <Link href="/products" className="w-full max-w-xs">
            <button className="btn-outline w-full justify-center">
              View All Categories
              <Icon name="ArrowRightIcon" size={16} />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
