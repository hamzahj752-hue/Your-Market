'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { fetchFoodCategories, foodCategoryHref, type BriefFoodCategory } from '@/lib/homepageCms';

/*
 * Food discovery hub: every active food category as a tile grid. Each tile
 * navigates to its dedicated landing page (/{slug}page/all{slug}). Fed
 * exclusively by REAL admin-configured data — an empty result shows an honest
 * empty state and never fabricates food content.
 */
export default function FoodPage() {
  const [categories, setCategories] = useState<BriefFoodCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchFoodCategories().then((cats) => {
      if (!active) return;
      setCategories(cats);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pb-24 lg:pb-0">
        <div className="bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/" className="hover:text-primary font-600">
                Home
              </Link>
              <span>/</span>
              <span className="font-700 text-foreground">Food</span>
            </nav>

            <h1 className="text-2xl font-800 text-foreground">Food</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Browse food categories and order what you crave.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-primary mr-2" />
              Loading food categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 px-4 text-center">
              <Icon name="FolderIcon" size={44} className="text-muted-foreground/30 mb-4" />
              <h2 className="text-lg font-700 text-foreground mb-2">No food categories yet</h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                Food categories will appear here as soon as they are added.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {categories.map((cat) => (
                <Link
                  key={cat.id || cat.name}
                  href={foodCategoryHref(cat)}
                  className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/40"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#f7f4ee]">
                    {cat.image ? (
                      <AppImage
                        src={cat.image}
                        alt={cat.name}
                        fill
                        className="object-cover"
                        sizes="240px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/10 text-primary">
                        <Icon name="FolderIcon" size={28} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="line-clamp-1 text-center text-[13px] font-700 text-foreground leading-tight">
                      {cat.name}
                    </span>
                    {cat.notice && (
                      <span className="mt-1 line-clamp-2 block text-center text-[11px] text-muted-foreground leading-snug">
                        {cat.notice}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
