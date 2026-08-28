'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';

const dealProducts = [
{
  id: 'd1',
  name: 'Apple AirPods Pro (2nd Gen)',
  price: 25279,
  originalPrice: 33249,
  discount: 24,
  image: "https://images.unsplash.com/photo-1631677624302-55e6178078f1",
  alt: 'White Apple AirPods Pro earbuds with charging case on white background, minimal product photo',
  rating: 4.9
},
{
  id: 'd2',
  name: 'Dyson V15 Detect Vacuum',
  price: 66499,
  originalPrice: 99749,
  discount: 33,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1ca3b27f1-1772838191303.png",
  alt: 'Modern cordless vacuum cleaner on light wooden floor, clean bright home interior',
  rating: 4.8
},
{
  id: 'd3',
  name: 'Levi\'s 501 Original Jeans',
  price: 5319,
  originalPrice: 9309,
  discount: 43,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_15ac726b7-1772212285909.png",
  alt: 'Classic blue denim jeans folded on wooden surface, natural daylight photography',
  rating: 4.5
},
{
  id: 'd4',
  name: 'Ninja Foodi 10-in-1 Air Fryer',
  price: 17289,
  originalPrice: 26599,
  discount: 35,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1597550a4-1782534001151.png",
  alt: 'Black air fryer kitchen appliance on white counter, bright kitchen lighting',
  rating: 4.7
}];


function useCountdown(targetHours: number) {
  const [time, setTime] = useState({ h: targetHours, m: 59, s: 59 });
  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => {
        if (prev.s > 0) return { ...prev, s: prev.s - 1 };
        if (prev.m > 0) return { ...prev, m: prev.m - 1, s: 59 };
        if (prev.h > 0) return { h: prev.h - 1, m: 59, s: 59 };
        return { h: 0, m: 0, s: 0 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

export default function DealsSection() {
  const time = useCountdown(5);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section className="section-pad bg-white" aria-labelledby="deals-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header with countdown */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-deal-red font-700 text-sm uppercase tracking-widest mb-2 block flex items-center gap-2">
              <Icon name="FireIcon" size={16} className="text-accent" />
              Flash Deals
            </span>
            <h2 id="deals-heading" className="text-section-title font-800 text-foreground leading-tight">
              Today&apos;s Best Offers
            </h2>
          </div>
          {/* Countdown */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-muted-foreground font-600">Ends in:</span>
            {[pad(time.h), pad(time.m), pad(time.s)].map((unit, i) =>
            <React.Fragment key={i}>
                <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-center min-w-[44px]">
                  <span className="text-lg font-800 font-mono block leading-none">{unit}</span>
                  <span className="text-[9px] font-600 opacity-70 uppercase tracking-wider">
                    {['HRS', 'MIN', 'SEC'][i]}
                  </span>
                </div>
                {i < 2 && <span className="text-primary font-800 text-lg">:</span>}
              </React.Fragment>
            )}
          </div>
        </div>

        {/* Deal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dealProducts.map((p) =>
          <Link key={p.id} href="/products" className="block group">
              <div className="bg-muted/30 rounded-2xl overflow-hidden card-shadow product-card-hover border border-border/50">
                <div className="relative h-48 overflow-hidden">
                  <AppImage
                  src={p.image}
                  alt={p.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
                
                  <div className="absolute top-3 left-3">
                    <span className="badge-deal">-{p.discount}%</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-700 text-foreground leading-snug mb-2 line-clamp-2">{p.name}</h3>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-base font-800 price-deal">रू{p.price.toLocaleString()}</span>
                    <span className="price-original">रू{p.originalPrice.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-green-600 font-600">
                    Save रू{(p.originalPrice - p.price).toLocaleString()}
                  </p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Promo Banner */}
        <div className="mt-8 rounded-3xl overflow-hidden relative h-40 md:h-52">
          <div className="absolute inset-0 gradient-deal opacity-95" />
          <div className="absolute inset-0 from-black/40 to-transparent bg-gradient-to-r" />
          <div className="relative z-10 h-full flex items-center justify-between px-8 md:px-12">
            <div>
              <p className="text-white/80 text-sm font-600 mb-1">Limited Time Offer</p>
              <h3 className="text-2xl md:text-3xl font-800 text-white leading-tight">
                Extra 15% Off with code<br />
                <span className="bg-white/20 px-3 py-1 rounded-lg text-white font-900 tracking-widest text-xl md:text-2xl">
                  SHOPALL15
                </span>
              </h3>
            </div>
            <Link href="/products?sale=true" className="hidden md:block">
              <button className="bg-white text-accent font-800 px-6 py-3 rounded-full hover:scale-105 transition-transform shadow-accent">
                Claim Deal
                <Icon name="ArrowRightIcon" size={16} className="inline ml-2" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>);

}