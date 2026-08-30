'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

const categories = [
  { id: 'all', label: 'All Categories', count: 15800000 },
  { id: 'Electronics', label: 'Electronics', count: 2400000 },
  { id: 'Fashion', label: 'Fashion', count: 5100000 },
  { id: 'Home', label: 'Home & Kitchen', count: 1800000 },
  { id: 'Beauty', label: 'Beauty', count: 890000 },
  { id: 'Sports', label: 'Sports', count: 1200000 },
  { id: 'Books', label: 'Books', count: 3500000 },
  { id: 'Toys', label: 'Toys & Games', count: 760000 },
  { id: 'Grocery', label: 'Grocery', count: 450000 },
];

const priceRanges = [
  { id: 'all', label: 'Any Price' },
  { id: '0-3500', label: 'Under रू3,500' },
  { id: '3500-6500', label: 'रू3,500 to रू6,500' },
  { id: '6500-13000', label: 'रू6,500 to रू13,000' },
  { id: '13000-26500', label: 'रू13,000 to रू26,500' },
  { id: '26500+', label: 'रू26,500 & Above' },
];

const ratingOptions = [
  { id: '4', label: '4★ & up' },
  { id: '3', label: '3★ & up' },
  { id: '2', label: '2★ & up' },
];

interface FilterSidebarProps {
  activeCategory: string;
  activePriceRange: string;
  activeRating: string;
  onCategoryChange: (cat: string) => void;
  onPriceChange: (range: string) => void;
  onRatingChange: (rating: string) => void;
  onClearAll: () => void;
}

export default function FilterSidebar({
  activeCategory,
  activePriceRange,
  activeRating,
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
                  {cat.count >= 1000000
                    ? `${(cat.count / 1000000).toFixed(1)}M`
                    : `${(cat.count / 1000).toFixed(0)}K`}
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
