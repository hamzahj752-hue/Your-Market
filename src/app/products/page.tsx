'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import FilterSidebar from './components/FilterSidebar';
import ProductGrid, { Product } from './components/ProductGrid';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';

const sortOptions = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'rating', label: 'Avg. Customer Review' },
  { id: 'newest', label: 'Newest Arrivals' },
];

export default function ProductsPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePriceRange, setActivePriceRange] = useState('all');
  const [activeRating, setActiveRating] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setLoadError('');

      const { data, error } = await supabase.from('products').select('*').eq('active', true);

      if (error) {
        console.error('Supabase product error:', error);
        setLoadError('Unable to load products. Please try again.');
        setLoading(false);
        return;
      }

      const mappedProducts: Product[] = (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
        image: p.image,
        alt: p.alt,
        category: p.category,
        rating: Number(p.rating),
        reviews: Number(p.reviews),
        discount: p.discount != null ? Number(p.discount) : undefined,
        badge: p.badge ?? undefined,
        variant: p.variant ?? undefined,
        brand: p.brand,
        inStock: Boolean(p.in_stock),
      }));

      setAllProducts(mappedProducts);
      setLoading(false);
    }

    loadProducts();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    const search = params.get('search');

    if (cat) setActiveCategory(cat);
    if (search) setSearchQuery(search);
  }, []);

  const money = (value: number) => `रू${Math.round(value).toLocaleString('en-IN')}`;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allProducts) {
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    }
    const list = [...counts.entries()]
      .map(([name, count]) => ({ id: name, label: name, count }))
      .sort((a, b) => b.count - a.count);
    return [{ id: 'all', label: 'All Categories', count: allProducts.length }, ...list];
  }, [allProducts]);

  const priceRanges = useMemo(() => {
    const prices = allProducts.map((p) => p.price).filter((n) => Number.isFinite(n));
    if (prices.length === 0) return [];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const ranges: { id: string; label: string }[] = [{ id: 'all', label: 'Any Price' }];
    if (max <= min) {
      ranges.push({ id: `${min}-${max}`, label: money(min) });
      return ranges;
    }
    const step = max === min ? 0 : (max - min) / 4;
    for (let i = 0; i < 4; i += 1) {
      const lo = Math.round(min + i * step);
      const hi = i === 3 ? max : Math.round(min + (i + 1) * step);
      ranges.push({ id: `${lo}-${hi}`, label: `${money(lo)} – ${money(hi)}` });
    }
    return ranges;
  }, [allProducts]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== 'all') params.set('category', activeCategory);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname);
  }, [activeCategory, searchQuery]);

  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    if (activeCategory !== 'all') {
      result = result.filter((p) => p.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();

      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.variant?.toLowerCase().includes(query)
      );
    }

    if (activePriceRange !== 'all') {
      const [min, max] = activePriceRange.split('-').map(Number);
      result = result.filter((p) => p.price >= min && p.price <= max);
    }

    if (activeRating) {
      result = result.filter((p) => p.rating >= parseInt(activeRating));
    }

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
    }

    return result;
  }, [allProducts, activeCategory, activePriceRange, activeRating, sortBy, searchQuery]);

  const handleClearAll = () => {
    setActiveCategory('all');
    setActivePriceRange('all');
    setActiveRating('');
    setSortBy('featured');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pt-24 md:pt-28 pb-16 lg:pb-0">
        <div className="bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-800 text-foreground">
                  {searchQuery
                    ? `Search: ${searchQuery}`
                    : activeCategory === 'all'
                      ? 'All Products'
                      : activeCategory}
                </h1>

                <p className="text-muted-foreground text-sm mt-1">
                  {loading
                    ? 'Loading products...'
                    : `${filteredProducts.length.toLocaleString()} results`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFilterOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-sm font-600 hover:bg-muted transition-colors"
                >
                  <Icon name="AdjustmentsHorizontalIcon" size={16} />
                  Filters
                </button>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="sort-select"
                    className="text-sm text-muted-foreground font-600 whitespace-nowrap hidden sm:block"
                  >
                    Sort by:
                  </label>

                  <select
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border border-border rounded-xl px-3 py-2 text-sm font-600 text-foreground bg-white"
                  >
                    {sortOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {(activeCategory !== 'all' || activePriceRange !== 'all' || activeRating) && (
              <div className="flex flex-wrap gap-2 mt-4">
                {activeCategory !== 'all' && (
                  <button
                    onClick={() => setActiveCategory('all')}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-600"
                  >
                    {activeCategory}
                    <Icon name="XMarkIcon" size={12} />
                  </button>
                )}

                {activePriceRange !== 'all' && (
                  <button
                    onClick={() => setActivePriceRange('all')}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-600"
                  >
                    {priceRanges.find((r) => r.id === activePriceRange)?.label || activePriceRange}
                    <Icon name="XMarkIcon" size={12} />
                  </button>
                )}

                {activeRating && (
                  <button
                    onClick={() => setActiveRating('')}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-600"
                  >
                    {activeRating}★ & up
                    <Icon name="XMarkIcon" size={12} />
                  </button>
                )}

                <button
                  onClick={handleClearAll}
                  className="text-xs text-accent font-600 hover:underline px-2"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex gap-6">
            <div className="hidden lg:block w-64 flex-shrink-0">
              <FilterSidebar
                activeCategory={activeCategory}
                activePriceRange={activePriceRange}
                activeRating={activeRating}
                categories={categories}
                priceRanges={priceRanges}
                onCategoryChange={setActiveCategory}
                onPriceChange={setActivePriceRange}
                onRatingChange={setActiveRating}
                onClearAll={handleClearAll}
              />
            </div>

            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground text-sm">Loading products...</p>
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Icon name="ExclamationTriangleIcon" size={48} className="text-red-500/60 mb-4" />
                  <h3 className="text-xl font-700 text-foreground mb-2">Something went wrong</h3>
                  <p className="text-muted-foreground text-sm">{loadError}</p>
                </div>
              ) : (
                <ProductGrid products={filteredProducts} />
              )}
            </div>
          </div>
        </div>
      </main>

      {filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setFilterOpen(false)}
          />

          <div className="absolute left-0 top-0 bottom-0 w-80 bg-background overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
              <h2 className="font-800 text-foreground">Filters</h2>

              <button
                onClick={() => setFilterOpen(false)}
                className="p-2 rounded-full hover:bg-muted"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            <div className="p-4">
              <FilterSidebar
                activeCategory={activeCategory}
                activePriceRange={activePriceRange}
                activeRating={activeRating}
                categories={categories}
                priceRanges={priceRanges}
                onCategoryChange={(cat) => {
                  setActiveCategory(cat);
                  setFilterOpen(false);
                }}
                onPriceChange={setActivePriceRange}
                onRatingChange={setActiveRating}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        </div>
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
