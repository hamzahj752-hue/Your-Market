'use client';

import React, { useEffect, useRef, useState } from 'react';
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

const accentFor = (name: string) => {
  const map: Record<string, string> = {
    Electronics: 'from-blue-600/80 to-primary/80',
    Fashion: 'from-pink-600/80 to-purple-700/80',
    'Home & Kitchen': 'from-amber-600/80 to-orange-700/80',
    Beauty: 'from-rose-500/80 to-pink-700/80',
    Sports: 'from-green-600/80 to-teal-700/80',
    Books: 'from-yellow-600/80 to-amber-700/80',
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
            }, idx * 40);
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
    <section className="py-2 bg-white" ref={sectionRef} aria-labelledby="categories-heading">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-end justify-between mb-2">
          <h2
            id="categories-heading"
            className="text-sm sm:text-base font-800 text-foreground leading-tight"
          >
            Shop by Category
          </h2>
          <Link
            href="/products"
            className="hidden sm:flex items-center gap-1 text-primary font-600 text-xs hover:gap-1.5 transition-all"
          >
            View all
            <Icon name="ArrowRightIcon" size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
          {items.map((c, i) => (
            <div key={c.id || `${c.name}-${i}`} data-idx={i} className="cat-card animate-on-scroll">
              <Link href={`/products?category=${encodeURIComponent(c.name)}`} className="block">
                <div className="relative h-16 sm:h-20 md:h-24 rounded-xl overflow-hidden bg-primary/70 group">
                  {c.image ? (
                    <AppImage
                      src={c.image}
                      alt={c.name}
                      fill
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${accentFor(c.name)}`} />
                  )}

                  <div className="absolute inset-0 from-black/55 to-transparent bg-gradient-to-t" />

                  <div className="absolute inset-0 p-2 flex flex-col justify-end">
                    <h3 className="text-white font-800 text-[11px] sm:text-xs leading-tight line-clamp-2">
                      {c.name}
                    </h3>
                    <p className="text-white/70 text-[9px] font-500 mt-0.5 inline-flex items-center gap-0.5">
                      Shop
                      <Icon name="ArrowRightIcon" size={10} />
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-center sm:hidden">
          <Link href="/products" className="w-full max-w-xs">
            <button className="btn-outline w-full justify-center text-xs py-2">
              View All Categories
              <Icon name="ArrowRightIcon" size={14} />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
