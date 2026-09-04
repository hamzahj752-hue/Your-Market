'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { fetchHomepageCategories, BriefCategory } from '@/lib/homepageCms';

const fallbackCategories: Pick<BriefCategory, 'id' | 'name' | 'image' | 'icon'>[] = [
  { id: 'electronics', name: 'Electronics', image: null, icon: 'BoltIcon' },
  { id: 'fashion', name: 'Fashion', image: null, icon: 'BoltIcon' },
  { id: 'home', name: 'Home & Kitchen', image: null, icon: 'BoltIcon' },
  { id: 'beauty', name: 'Beauty', image: null, icon: 'BoltIcon' },
  { id: 'sports', name: 'Sports', image: null, icon: 'BoltIcon' },
  { id: 'books', name: 'Books', image: null, icon: 'BoltIcon' },
  { id: 'toys', name: 'Toys & Games', image: null, icon: 'BoltIcon' },
  { id: 'grocery', name: 'Grocery & Fresh', image: null, icon: 'BoltIcon' },
];

export default function CategoryNavRow() {
  const [cats, setCats] = useState<BriefCategory[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchHomepageCategories().then((cms) => {
      if (!active) return;
      if (cms.length > 0) setCats(cms);
    });
    return () => {
      active = false;
    };
  }, []);

  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  const items: BriefCategory[] =
    cats.length > 0 ? cats : (fallbackCategories as unknown as BriefCategory[]);

  return (
    <div className="bg-white border-b border-border/60" role="navigation" aria-label="Categories">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 relative">
        {items.length > 5 && (
          <button
            onClick={() => scrollByDir(-1)}
            aria-label="Scroll categories left"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border border-border shadow-sm items-center justify-center hidden md:flex z-10"
          >
            <Icon name="ChevronLeftIcon" size={14} />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex items-center gap-2 overflow-x-auto py-2 px-1 md:px-8 scrollbar-hide"
        >
          <Link
            href="/products"
            className="flex items-center gap-1.5 flex-shrink-0 h-9 px-3.5 rounded-full border border-border bg-muted/40 text-sm font-600 text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Icon name="Squares2X2Icon" size={16} />
            All
          </Link>
          {items.map((c) => (
            <Link
              key={c.id || c.name}
              href={`/products?category=${encodeURIComponent(c.name)}`}
              className="flex items-center gap-2 flex-shrink-0 h-11 pl-1.5 pr-3 rounded-full border border-border/70 bg-card/70 hover:border-primary hover:shadow-sm transition-all"
            >
              {c.image ? (
                <span className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                  <AppImage
                    src={c.image}
                    alt=""
                    width={32}
                    height={32}
                    className="object-cover w-8 h-8"
                  />
                </span>
              ) : (
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Icon name="FolderIcon" size={15} />
                </span>
              )}
              <span className="text-sm font-600 text-foreground whitespace-nowrap max-w-[140px] truncate">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
        {items.length > 5 && (
          <button
            onClick={() => scrollByDir(1)}
            aria-label="Scroll categories right"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border border-border shadow-sm items-center justify-center hidden md:flex z-10"
          >
            <Icon name="ChevronRightIcon" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
