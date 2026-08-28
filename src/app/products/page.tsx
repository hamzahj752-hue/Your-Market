'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CartProvider } from '@/context/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import FilterSidebar from './components/FilterSidebar';
import ProductGrid, { Product } from './components/ProductGrid';
import Icon from '@/components/ui/AppIcon';

const allProducts: Product[] = [
{
  id: 'pr1', name: 'Sony WH-1000XM5 Wireless Headphones', price: 37299, originalPrice: 46599,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12c20386e-1772727883790.png",
  alt: 'Black Sony over-ear wireless headphones on white background, product studio shot',
  category: 'Electronics', rating: 4.8, reviews: 3241, discount: 20, badge: 'Best Seller',
  variant: 'Midnight Black', brand: 'Sony', inStock: true
},
{
  id: 'pr2', name: 'Samsung 55" 4K QLED Smart TV', price: 86449, originalPrice: 119699,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1ff591244-1773153994624.png",
  alt: 'Large flat screen Samsung TV mounted on wall in modern living room, bright interior',
  category: 'Electronics', rating: 4.7, reviews: 2156, discount: 28, badge: 'Deal',
  variant: '55 inch', brand: 'Samsung', inStock: true
},
{
  id: 'pr3', name: 'Apple AirPods Pro (2nd Gen)', price: 25279, originalPrice: 33249,
  image: "https://images.unsplash.com/photo-1627475723321-c401163967d3",
  alt: 'White Apple AirPods Pro earbuds with charging case on white surface, clean product shot',
  category: 'Electronics', rating: 4.9, reviews: 8921, discount: 24, badge: 'Top Rated',
  variant: 'White', brand: 'Apple', inStock: true
},
{
  id: 'pr4', name: 'Nike Air Max 270 Running Shoes', price: 14623, originalPrice: 19943,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1ab57f281-1772754797746.png",
  alt: 'White Nike running shoe side profile on clean white surface, bright studio lighting',
  category: 'Fashion', rating: 4.6, reviews: 5678, discount: 27, badge: 'Sale',
  variant: 'White / Max Orange', brand: 'Nike', inStock: true
},
{
  id: 'pr5', name: "Levi's 501 Original Fit Jeans", price: 5319, originalPrice: 9309,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_15ac726b7-1772212285909.png",
  alt: 'Classic blue denim jeans folded on wooden surface, natural daylight photography',
  category: 'Fashion', rating: 4.5, reviews: 3892, discount: 43, badge: 'Trending',
  variant: 'Stonewash Blue / 32x30', brand: "Levi's", inStock: true
},
{
  id: 'pr6', name: 'Patagonia Better Sweater Fleece Jacket', price: 15959, originalPrice: 19949,
  image: "https://images.unsplash.com/photo-1709717747630-6aa951355c98",
  alt: 'Warm fleece jacket on clothing hanger in clean store display, bright lighting',
  category: 'Fashion', rating: 4.8, reviews: 2134, discount: 20, badge: 'New',
  variant: 'Navy Blue / M', brand: 'Patagonia', inStock: true
},
{
  id: 'pr7', name: 'Instant Pot Duo 7-in-1 Pressure Cooker', price: 10643, originalPrice: 13293,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1cdb5ce95-1784978159680.png",
  alt: 'Stainless steel electric pressure cooker on kitchen counter, bright natural light',
  category: 'Home', rating: 4.7, reviews: 8921, discount: 20, badge: 'Top Rated',
  variant: '6 Qt', brand: 'Instant Pot', inStock: true
},
{
  id: 'pr8', name: 'Dyson V15 Detect Cordless Vacuum', price: 66499, originalPrice: 99749,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1ca3b27f1-1772838191303.png",
  alt: 'Modern cordless vacuum cleaner on light wooden floor, clean bright home interior',
  category: 'Home', rating: 4.8, reviews: 1234, discount: 33, badge: 'Premium',
  variant: 'Nickel/Yellow', brand: 'Dyson', inStock: true
},
{
  id: 'pr9', name: 'Neutrogena Hydro Boost Skincare Set', price: 4653, originalPrice: 7313,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_191f10152-1764825393789.png",
  alt: 'Skincare products cosmetics bottles on white marble surface, soft beauty lighting',
  category: 'Beauty', rating: 4.5, reviews: 2109, discount: 36, badge: 'Deal',
  variant: 'Normal to Dry', brand: 'Neutrogena', inStock: true
},
{
  id: 'pr10', name: "CeraVe Moisturizing Cream 19oz", price: 2527, originalPrice: 3323,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_144dc3269-1771552474382.png",
  alt: 'White moisturizer cream jar on clean white surface, beauty product photography',
  category: 'Beauty', rating: 4.9, reviews: 15023, discount: 24, badge: 'Best Seller',
  variant: '19 oz Tub', brand: 'CeraVe', inStock: true
},
{
  id: 'pr11', name: 'Wilson NBA Official Game Basketball', price: 5983, originalPrice: 8643,
  image: "https://images.unsplash.com/photo-1554010213-f66dbc0acbe0",
  alt: 'Orange basketball on hardwood gym floor, dramatic sports lighting from above',
  category: 'Sports', rating: 4.7, reviews: 1893, discount: 31, badge: 'New',
  variant: 'Size 7', brand: 'Wilson', inStock: true
},
{
  id: 'pr12', name: 'Kindle Paperwhite 16GB Signature Edition', price: 18619, originalPrice: 21279,
  image: "https://images.unsplash.com/photo-1652717492938-82920653e04b",
  alt: 'E-reader device displaying book page on white background, minimal product shot',
  category: 'Books', rating: 4.9, reviews: 12034, discount: 13, badge: 'Amazon Choice',
  variant: 'Black', brand: 'Amazon', inStock: true
},
{
  id: 'pr13', name: 'LEGO Technic Bugatti Chiron 3599 pcs', price: 46549, originalPrice: 59849,
  image: "https://images.unsplash.com/photo-1577113397287-bbbc74776f0a",
  alt: 'Colorful LEGO building blocks scattered on white table, bright playful lighting',
  category: 'Toys', rating: 4.9, reviews: 3421, discount: 22, badge: 'Premium',
  variant: 'Multi-color', brand: 'LEGO', inStock: false
},
{
  id: 'pr14', name: "Ninja Foodi 10-in-1 Air Fryer XL", price: 17289, originalPrice: 26599,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1597550a4-1782534001151.png",
  alt: 'Black air fryer kitchen appliance on white kitchen counter, bright clean lighting',
  category: 'Home', rating: 4.6, reviews: 4521, discount: 35, badge: 'Deal',
  variant: '6 Qt Black', brand: 'Ninja', inStock: true
},
{
  id: 'pr15', name: 'Adidas Ultraboost 22 Running Shoe', price: 18619, originalPrice: 25259,
  image: "https://images.unsplash.com/photo-1575456456278-936c89ccdb7b",
  alt: 'White and grey Adidas running shoes on clean surface, athletic product photography',
  category: 'Sports', rating: 4.7, reviews: 3102, discount: 26, badge: 'Top Rated',
  variant: 'White/Black / 10', brand: 'Adidas', inStock: true
},
{
  id: 'pr16', name: 'Organic Green Tea 100 bags by Bigelow', price: 1727, originalPrice: 2525,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1298e33ac-1772696549384.png",
  alt: 'Green tea bags arranged on wooden surface with tea leaves, natural warm lighting',
  category: 'Grocery', rating: 4.6, reviews: 8234, discount: 32, badge: 'Organic',
  variant: '100 Count', brand: 'Bigelow', inStock: true
}];


const sortOptions = [
{ id: 'featured', label: 'Featured' },
{ id: 'price-asc', label: 'Price: Low to High' },
{ id: 'price-desc', label: 'Price: High to Low' },
{ id: 'rating', label: 'Avg. Customer Review' },
{ id: 'newest', label: 'Newest Arrivals' }];


export default function ProductsPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activePriceRange, setActivePriceRange] = useState('all');
  const [activeRating, setActiveRating] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('category');
      if (cat) setActiveCategory(cat);
    }
  }, []);

  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    if (activeCategory !== 'all') {
      result = result.filter((p) => p.category === activeCategory);
    }

    if (activePriceRange !== 'all') {
      const [min, max] = activePriceRange.split('-').map(Number);
      if (activePriceRange === '26500+') {
        result = result.filter((p) => p.price >= 26500);
      } else {
        result = result.filter((p) => p.price >= min && p.price <= max);
      }
    }

    if (activeRating) {
      result = result.filter((p) => p.rating >= parseInt(activeRating));
    }

    switch (sortBy) {
      case 'price-asc':result.sort((a, b) => a.price - b.price);break;
      case 'price-desc':result.sort((a, b) => b.price - a.price);break;
      case 'rating':result.sort((a, b) => b.rating - a.rating);break;
      default:break;
    }

    return result;
  }, [activeCategory, activePriceRange, activeRating, sortBy]);

  const handleClearAll = () => {
    setActiveCategory('all');
    setActivePriceRange('all');
    setActiveRating('');
    setSortBy('featured');
  };

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 pt-24 md:pt-28 pb-16 lg:pb-0">
          {/* Page Header */}
          <div className="bg-white border-b border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-800 text-foreground">
                    {activeCategory === 'all' ? 'All Products' : activeCategory}
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    {filteredProducts.length.toLocaleString()} results
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mobile Filter Toggle */}
                  <button
                    onClick={() => setFilterOpen(true)}
                    className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-sm font-600 hover:bg-muted transition-colors"
                    aria-label="Open filters">
                    
                    <Icon name="AdjustmentsHorizontalIcon" size={16} />
                    Filters
                  </button>
                  {/* Sort */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="sort-select" className="text-sm text-muted-foreground font-600 whitespace-nowrap hidden sm:block">
                      Sort by:
                    </label>
                    <select
                      id="sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-border rounded-xl px-3 py-2 text-sm font-600 text-foreground bg-white focus:outline-none focus:border-primary transition-colors"
                      aria-label="Sort products">
                      
                      {sortOptions.map((opt) =>
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Active filter chips */}
              {(activeCategory !== 'all' || activePriceRange !== 'all' || activeRating) &&
              <div className="flex flex-wrap gap-2 mt-4">
                  {activeCategory !== 'all' &&
                <button
                  onClick={() => setActiveCategory('all')}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-600 hover:bg-primary/20 transition-colors">
                  
                      {activeCategory}
                      <Icon name="XMarkIcon" size={12} />
                    </button>
                }
                  {activePriceRange !== 'all' &&
                <button
                  onClick={() => setActivePriceRange('all')}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-600 hover:bg-primary/20 transition-colors">
                  
                      {activePriceRange === '26500+' ? '$26500+' : `$${activePriceRange.replace('-', ' – $')}`}
                      <Icon name="XMarkIcon" size={12} />
                    </button>
                }
                  {activeRating &&
                <button
                  onClick={() => setActiveRating('')}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-600 hover:bg-primary/20 transition-colors">
                  
                      {activeRating}★ & up
                      <Icon name="XMarkIcon" size={12} />
                    </button>
                }
                  <button
                  onClick={handleClearAll}
                  className="text-xs text-accent font-600 hover:underline px-2">
                  
                    Clear all
                  </button>
                </div>
              }
            </div>
          </div>

          {/* Layout */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex gap-6">
              {/* Desktop Sidebar */}
              <div className="hidden lg:block w-64 flex-shrink-0">
                <FilterSidebar
                  activeCategory={activeCategory}
                  activePriceRange={activePriceRange}
                  activeRating={activeRating}
                  onCategoryChange={setActiveCategory}
                  onPriceChange={setActivePriceRange}
                  onRatingChange={setActiveRating}
                  onClearAll={handleClearAll} />
                
              </div>

              {/* Product Grid */}
              <div className="flex-1 min-w-0">
                <ProductGrid products={filteredProducts} />
              </div>
            </div>
          </div>
        </main>

        {/* Mobile Filter Drawer */}
        {filterOpen &&
        <div className="fixed inset-0 z-50 lg:hidden">
            <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setFilterOpen(false)}
            aria-hidden="true" />
          
            <div className="absolute left-0 top-0 bottom-0 w-80 bg-background overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
                <h2 className="font-800 text-foreground">Filters</h2>
                <button
                onClick={() => setFilterOpen(false)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Close filters">
                
                  <Icon name="XMarkIcon" size={20} />
                </button>
              </div>
              <div className="p-4">
                <FilterSidebar
                activeCategory={activeCategory}
                activePriceRange={activePriceRange}
                activeRating={activeRating}
                onCategoryChange={(cat) => {setActiveCategory(cat);setFilterOpen(false);}}
                onPriceChange={(range) => {setActivePriceRange(range);}}
                onRatingChange={setActiveRating}
                onClearAll={handleClearAll} />
              
              </div>
            </div>
          </div>
        }

        <Footer />
        <BottomNav />
      </div>
    </CartProvider>);

}