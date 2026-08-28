'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const categories = [
{
  id: 'electronics',
  name: 'Electronics',
  count: '2.4M+ products',
  emoji: '📱',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1e9299168-1784116839613.png",
  alt: 'Electronic devices laptops phones tablets on white surface, bright studio lighting',
  href: '/products?category=Electronics',
  span: 'col-span-2 row-span-1',
  accent: 'from-blue-600/80 to-primary/80'
},
{
  id: 'fashion',
  name: 'Fashion',
  count: '5.1M+ products',
  emoji: '👗',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_10d410c24-1772570122974.png",
  alt: 'Fashion clothing store with colorful garments on hangers, bright airy boutique',
  href: '/products?category=Fashion',
  span: 'col-span-1 row-span-1',
  accent: 'from-pink-600/80 to-purple-700/80'
},
{
  id: 'home',
  name: 'Home & Kitchen',
  count: '1.8M+ products',
  emoji: '🏠',
  image: "https://images.unsplash.com/photo-1722603930481-6b17484a16fe",
  alt: 'Modern kitchen interior with clean white counters and natural wood accents, bright daylight',
  href: '/products?category=Home',
  span: 'col-span-1 row-span-1',
  accent: 'from-amber-600/80 to-orange-700/80'
},
{
  id: 'beauty',
  name: 'Beauty',
  count: '890K+ products',
  emoji: '✨',
  image: "https://images.unsplash.com/photo-1643123158858-eac2aabaa1ec",
  alt: 'Beauty cosmetics products flatlay on pink background, soft studio lighting',
  href: '/products?category=Beauty',
  span: 'col-span-1 row-span-1',
  accent: 'from-rose-500/80 to-pink-700/80'
},
{
  id: 'sports',
  name: 'Sports',
  count: '1.2M+ products',
  emoji: '⚽',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f7e02ef8-1772296135925.png",
  alt: 'Sports equipment gym weights running shoes on wooden floor, natural light',
  href: '/products?category=Sports',
  span: 'col-span-1 row-span-1',
  accent: 'from-green-600/80 to-teal-700/80'
},
{
  id: 'books',
  name: 'Books',
  count: '3.5M+ products',
  emoji: '📚',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1197d933b-1772841006762.png",
  alt: 'Stack of colorful books on wooden shelf in bright library, warm ambient lighting',
  href: '/products?category=Books',
  span: 'col-span-1 row-span-1',
  accent: 'from-yellow-600/80 to-amber-700/80'
},
{
  id: 'toys',
  name: 'Toys & Games',
  count: '760K+ products',
  emoji: '🎮',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_124dca8a4-1767193843888.png",
  alt: 'Colorful toys and board games on bright white table, playful children room',
  href: '/products?category=Toys',
  span: 'col-span-1 row-span-1',
  accent: 'from-violet-600/80 to-purple-800/80'
},
{
  id: 'grocery',
  name: 'Grocery & Fresh',
  count: '450K+ products',
  emoji: '🛒',
  image: "https://images.unsplash.com/photo-1697038769469-4cc8caddb8c4",
  alt: 'Fresh vegetables and fruits in grocery store, vibrant colors bright market lighting',
  href: '/products?category=Grocery',
  span: 'col-span-4 row-span-1',
  accent: 'from-emerald-600/80 to-green-800/80'
}];


export default function CategoriesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

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
            }, idx * 80);
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
  }, []);

  return (
    <section className="section-pad bg-white" ref={sectionRef} aria-labelledby="categories-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-accent font-700 text-sm uppercase tracking-widest mb-2 block">Browse</span>
            <h2 id="categories-heading" className="text-section-title font-800 text-foreground leading-tight">
              Shop by Category
            </h2>
          </div>
          <Link href="/products" className="hidden sm:flex items-center gap-1 text-primary font-600 text-sm hover:gap-2 transition-all">
            View all
            <span>→</span>
          </Link>
        </div>

        {/* Bento Grid */}
        {/* BENTO AUDIT:
           Row 1: [col-1-2: Electronics cs-2] [col-3: Fashion cs-1] [col-4: Home cs-1]
           Row 2: [col-1: Beauty cs-1] [col-2: Sports cs-1] [col-3: Books cs-1] [col-4: Toys cs-1]
           Row 3: [col-1-4: Grocery cs-4]
           Placed 8/8 ✓
          */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          {/* Electronics — col-span-2 */}
          <div data-idx="0" className="cat-card col-span-2 row-span-1 animate-on-scroll">
            <CategoryCard cat={categories[0]} heightClass="h-44 md:h-52" />
          </div>
          {/* Fashion */}
          <div data-idx="1" className="cat-card col-span-1 row-span-1 animate-on-scroll">
            <CategoryCard cat={categories[1]} heightClass="h-44 md:h-52" />
          </div>
          {/* Home & Kitchen */}
          <div data-idx="2" className="cat-card col-span-1 row-span-1 animate-on-scroll">
            <CategoryCard cat={categories[2]} heightClass="h-44 md:h-52" />
          </div>
          {/* Beauty */}
          <div data-idx="3" className="cat-card col-span-1 row-span-1 animate-on-scroll">
            <CategoryCard cat={categories[3]} heightClass="h-36 md:h-44" />
          </div>
          {/* Sports */}
          <div data-idx="4" className="cat-card col-span-1 row-span-1 animate-on-scroll">
            <CategoryCard cat={categories[4]} heightClass="h-36 md:h-44" />
          </div>
          {/* Books */}
          <div data-idx="5" className="cat-card col-span-1 row-span-1 animate-on-scroll">
            <CategoryCard cat={categories[5]} heightClass="h-36 md:h-44" />
          </div>
          {/* Toys */}
          <div data-idx="6" className="cat-card col-span-1 row-span-1 animate-on-scroll">
            <CategoryCard cat={categories[6]} heightClass="h-36 md:h-44" />
          </div>
          {/* Grocery — col-span-4 */}
          <div data-idx="7" className="cat-card col-span-2 sm:col-span-4 row-span-1 animate-on-scroll">
            <CategoryCard cat={categories[7]} heightClass="h-32 md:h-40" wide />
          </div>
        </div>
      </div>
    </section>);

}

function CategoryCard({
  cat,
  heightClass,
  wide = false




}: {cat: (typeof categories)[0];heightClass: string;wide?: boolean;}) {
  return (
    <Link href={cat.href} className="block h-full">
      <div className={`relative ${heightClass} rounded-2xl overflow-hidden category-card-hover cursor-pointer group`}>
        <AppImage
          src={cat.image}
          alt={cat.alt}
          fill
          sizes={wide ? '100vw' : '(max-width: 640px) 50vw, 25vw'}
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
        
        <div className={`absolute inset-0 bg-gradient-to-br ${cat.accent}`} />
        <div className="absolute inset-0 from-black/50 to-transparent bg-gradient-to-t" />
        <div className="absolute inset-0 p-4 flex flex-col justify-end">
          <span className="text-2xl mb-1">{cat.emoji}</span>
          <h3 className="text-white font-800 text-base md:text-lg leading-tight">{cat.name}</h3>
          <p className="text-white/70 text-xs font-500 mt-0.5">{cat.count}</p>
        </div>
      </div>
    </Link>);

}