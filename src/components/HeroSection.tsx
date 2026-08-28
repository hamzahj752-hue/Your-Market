'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const heroStats = [
{ label: 'Products Listed', value: '50M+', icon: 'TagIcon' },
{ label: 'Happy Shoppers', value: '8.2M', icon: 'HeartIcon' },
{ label: 'Avg. Delivery', value: '2 Days', icon: 'TruckIcon' }];


const heroBanners = [
{
  tag: '🔥 Deal of the Day',
  headline: 'Up to 60% off Electronics',
  sub: 'Sony, Samsung, Apple & more',
  cta: 'Shop Now',
  href: '/products?category=Electronics',
  bg: 'from-primary to-blue-600',
  image: "https://images.unsplash.com/photo-1656454300703-889c028be15e",
  alt: 'Electronics products on dark circuit board background, dramatic blue tech lighting, deep shadows'
},
{
  tag: '⚡ Flash Sale',
  headline: 'Fashion from रू999',
  sub: 'New arrivals, trending styles',
  cta: 'Browse Fashion',
  href: '/products?category=Fashion',
  bg: 'from-purple-700 to-pink-600',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_112c5aa06-1783950067960.png",
  alt: 'Fashion clothing rack with colorful garments, bright studio lighting, clean white background'
}];


export default function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [activeBanner, setActiveBanner] = React.useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % heroBanners.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width - 0.5;
      const my = (e.clientY - rect.top) / rect.height - 0.5;
      const blob1 = el.querySelector<HTMLElement>('.hero-blob-1');
      const blob2 = el.querySelector<HTMLElement>('.hero-blob-2');
      if (blob1) blob1.style.transform = `translate(${mx * 30}px, ${my * 20}px)`;
      if (blob2) blob2.style.transform = `translate(${mx * -20}px, ${my * -15}px)`;
    };
    el.addEventListener('mousemove', handleMouseMove);
    return () => el.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const banner = heroBanners[activeBanner];

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen overflow-hidden gradient-hero-bg pt-24 md:pt-28 flex flex-col"
      aria-label="Hero section">
      
      {/* Atmospheric blobs */}
      <div className="hero-blob-1 absolute top-20 left-0 w-[600px] h-[600px] blob-primary opacity-60 pointer-events-none transition-transform duration-300 ease-out" />
      <div className="hero-blob-2 absolute bottom-20 right-0 w-[500px] h-[500px] blob-accent opacity-50 pointer-events-none transition-transform duration-300 ease-out" />
      {/* Grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black 50%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black 50%, transparent 100%)',
          opacity: 0.35
        }} />
      

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 flex-1 flex flex-col">
        {/* Eyebrow */}
        <div className="flex justify-center mt-6 mb-6 animate-on-scroll animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-border shadow-card text-sm font-600 text-primary">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Free shipping on orders over रू6,500 · 30-day returns
          </div>
        </div>

        {/* Massive Headline */}
        <div className="text-center mb-8">
          <h1
            className="text-hero-xl font-800 text-primary leading-none tracking-tight mb-4 animate-on-scroll animate-fade-up"
            style={{ animationDelay: '0.1s' }}>
            
            SHOP
            <span className="gradient-accent bg-clip-text text-transparent"> ALL</span>
          </h1>
          <p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-on-scroll animate-fade-up"
            style={{ animationDelay: '0.2s' }}>
            
            Millions of products across every category. Electronics, fashion, home, beauty, sports — one trusted destination.
          </p>
        </div>

        {/* CTAs */}
        <div
          className="flex flex-wrap items-center justify-center gap-4 mb-12 animate-on-scroll animate-fade-up"
          style={{ animationDelay: '0.3s' }}>
          
          <Link href="/products">
            <button className="btn-primary text-base px-8 py-4">
              Shop Now
              <Icon name="ArrowRightIcon" size={18} />
            </button>
          </Link>
          <Link href="/products?sale=true">
            <button className="btn-outline text-base px-8 py-4">
              View Deals
              <Icon name="TagIcon" size={18} />
            </button>
          </Link>
        </div>

        {/* Hero Banner Card + Floating Badges */}
        <div
          className="relative max-w-5xl mx-auto w-full animate-on-scroll animate-fade-up"
          style={{ animationDelay: '0.4s' }}>
          
          {/* Floating stat badge — top left */}
          <div className="absolute -top-6 -left-4 md:left-0 z-20 floating-badge">
            <div className="glass-card rounded-2xl px-4 py-3 shadow-card-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Icon name="TruckIcon" size={20} className="text-accent" />
              </div>
              <div>
                <p className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">Free Delivery</p>
                <p className="text-base font-800 text-foreground">Orders रू6,500+</p>
              </div>
            </div>
          </div>

          {/* Floating stat badge — top right */}
          <div className="absolute -top-6 -right-4 md:right-0 z-20 floating-badge-delayed">
            <div className="glass-card rounded-2xl px-4 py-3 shadow-card-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Icon name="ShieldCheckIcon" size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-700 uppercase tracking-widest text-muted-foreground">Buyer Protection</p>
                <p className="text-base font-800 text-foreground">100% Safe</p>
              </div>
            </div>
          </div>

          {/* Banner */}
          <div className="rounded-3xl overflow-hidden shadow-card-lg relative h-[280px] md:h-[360px]">
            <div className={`absolute inset-0 bg-gradient-to-r ${banner.bg} opacity-90`} />
            <div className="absolute inset-0 from-black/60 via-black/30 to-transparent bg-gradient-to-r" />
            <img
              src={banner.image}
              alt={banner.alt}
              className="absolute inset-0 w-full h-full object-cover opacity-30" />
            
            <div className="relative z-10 p-8 md:p-12 h-full flex flex-col justify-center max-w-md">
              <span className="inline-block text-sm font-700 text-white/90 mb-3 bg-white/15 px-3 py-1 rounded-full w-fit">
                {banner.tag}
              </span>
              <h2 className="text-2xl md:text-4xl font-800 text-white leading-tight mb-2">
                {banner.headline}
              </h2>
              <p className="text-white/80 text-sm md:text-base mb-6">{banner.sub}</p>
              <Link href={banner.href}>
                <button className="btn-accent w-fit">
                  {banner.cta}
                  <Icon name="ArrowRightIcon" size={16} />
                </button>
              </Link>
            </div>

            {/* Banner indicators */}
            <div className="absolute bottom-4 right-6 flex gap-2 z-10">
              {heroBanners.map((_, i) =>
              <button
                key={i}
                onClick={() => setActiveBanner(i)}
                aria-label={`Banner ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                i === activeBanner ? 'w-6 bg-white' : 'w-2 bg-white/40'}`
                } />

              )}
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div
          className="grid grid-cols-3 gap-4 mt-8 mb-8 animate-on-scroll animate-fade-up"
          style={{ animationDelay: '0.5s' }}>
          
          {heroStats.map((stat, i) =>
          <div
            key={stat.label}
            className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 text-center border border-border/50 shadow-card">
            
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={20} className="text-accent mx-auto mb-1" />
              <p className="text-xl md:text-2xl font-800 text-primary">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-500">{stat.label}</p>
            </div>
          )}
        </div>
      </div>
    </section>);

}