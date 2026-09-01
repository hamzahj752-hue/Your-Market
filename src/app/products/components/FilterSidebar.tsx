'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

export interface CategoryOption {
  id: string;
  label: string;
  count: number;
}

export interface PriceRangeOption {
  id: string;
  label: string;
}

const ratingOptions = [
  { id: '4', label: '4★ & up' },
  { id: '3', label: '3★ & up' },
  { id: '2', label: '2★ & up' },
];

interface FilterSidebarProps {
  activeCategory: string;
  activePriceRange: string;
  activeRating: string;
  categories: CategoryOption[];
  priceRanges: PriceRangeOption[];
  onCategoryChange: (cat: string) => void;
  onPriceChange: (range: string) => void;
  onRatingChange: (rating: string) => void;
  onClearAll: () => void;
}

const formatCount = (count: number) =>
  count >= 1000000
    ? `${(count / 1000000).toFixed(1)}M`
    : count >= 1000
      ? `${Math.round(count / 1000)}K`
      : `${count}`;

export default function FilterSidebar({
  activeCategory,
  activePriceRange,
  activeRating,
  categories,
  priceRanges,
  onCategoryChange,
  onPriceChange,
  onRatingChange,
  onClearAll,
}: FilterSidebarProps) {
  const hasFilters = activeCategory !== 'all' || activePriceRange !== 'all' || activeRating !== '';

  return (
    <aside className="w-full" aria-label="Product filters">
      <div className="bg-white rounded-2xl p-5 card-shadow sticky top-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-800 text-foreground flex items-center gap-2">
            <Icon name="AdjustmentsHorizontalIcon" size={18} className="text-primary" />
            Filters
          </h2>
          {hasFilters && (
            <button onClick={onClearAll} className="text-xs text-accent font-600 hover:underline">
              Clear All
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="mb-6">
          <h3 className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3">
            Category
          </h3>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${
                  activeCategory === cat.id
                    ? 'bg-primary text-primary-foreground font-700'
                    : 'hover:bg-muted text-foreground font-500'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-xs ${activeCategory === cat.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                >
                  {formatCount(cat.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="mb-6">
          <h3 className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3">
            Price Range
          </h3>
          <div className="space-y-1">
            {priceRanges.map((range) => (
              <button
                key={range.id}
                onClick={() => onPriceChange(range.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all text-left ${
                  activePriceRange === range.id
                    ? 'bg-primary text-primary-foreground font-700'
                    : 'hover:bg-muted text-foreground font-500'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    activePriceRange === range.id
                      ? 'border-primary-foreground bg-primary-foreground'
                      : 'border-muted-foreground'
                  }`}
                >
                  {activePriceRange === range.id && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </span>
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div>
          <h3 className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3">
            Customer Rating
          </h3>
          <div className="space-y-1">
            {ratingOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onRatingChange(activeRating === opt.id ? '' : opt.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                  activeRating === opt.id
                    ? 'bg-primary text-primary-foreground font-700'
                    : 'hover:bg-muted text-foreground font-500'
                }`}
              >
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Icon
                      key={i}
                      name="StarIcon"
                      variant={i <= parseInt(opt.id) ? 'solid' : 'outline'}
                      size={12}
                      className={i <= parseInt(opt.id) ? 'star-filled' : 'text-muted-foreground/30'}
                    />
                  ))}
                </div>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
