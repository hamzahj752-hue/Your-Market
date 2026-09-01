'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { fetchHeroBanners } from '@/lib/homepageCms';

const defaultBanners = [
  {
    tag: 'Welcome to Your Market',
    headline: 'Everything you need, in one place',
    sub: 'Electronics, fashion, home, beauty & more — real products from your local marketplace.',
    cta: 'Start Shopping',
    href: '/products',
    image: '/assets/Online_shopping_choice.jpg',
    alt: 'Shopping bags and products arranged around an online shopping illustration',
  },
];

export default function HeroSection() {
  const [activeBanner, setActiveBanner] = useState(0);
  const [banners, setBanners] = useState(defaultBanners);

  useEffect(() => {
    let active = true;
    fetchHeroBanners().then((cms) => {
      if (!active) return;
      // Filter out rows with no usable image — those are not "hero-worthy" and
      // would otherwise render as an empty dark card.
      const usable = cms.filter((b) => b.image_url && String(b.image_url).trim().length > 0);
      if (usable.length > 0) {
        setBanners(
          usable.map((b) => ({
            tag: 'Featured',
            headline: String(b.title ?? '').trim(),
            sub: String(b.subtitle ?? '').trim(),
            cta: String(b.cta_text ?? '').trim(),
            href: b.cta_url && b.cta_url.startsWith('/') ? b.cta_url : '/products',
            image: b.image_url,
            alt: b.title || 'Storefront banner',
          }))
        );
        setActiveBanner(0);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const banner = banners[activeBanner];
  const image = banner.image;

  return (
    <section className="relative overflow-hidden pt-24 md:pt-28" aria-label="Hero section">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-10 md:pb-14">
        {/* Banner */}
        <div className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-card-lg bg-primary">
          {image ? (
            /* Image-backed hero: full visual background with readable text */
            <>
              <AppImage
                src={image}
                alt={banner.alt}
                fill
                sizes="100vw"
                className="object-cover"
                priority={true}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-transparent" />
              <div className="relative z-10 h-[300px] sm:h-[340px] md:h-[380px] lg:h-[420px] flex flex-col justify-center max-w-xl px-6 sm:px-10 md:px-14">
                {banner.headline && (
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-800 text-white leading-tight mb-3">
                    {banner.headline}
                  </h2>
                )}
                {banner.sub && (
                  <p className="text-white/85 text-sm md:text-base mb-5 max-w-xl line-clamp-3">
                    {banner.sub}
                  </p>
                )}
                {banner.cta && (
                  <div>
                    <Link href={banner.href}>
                      <button className="btn-accent text-sm">
                        {banner.cta}
                        <Icon name="ArrowRightIcon" size={15} />
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* No CMS image: keep the professional fallback banner */
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-blue-700 to-blue-600" />
              <div className="relative h-44 sm:h-56 md:h-64 lg:h-72 flex flex-col justify-center max-w-xl px-6 md:px-10">
                <span className="inline-block text-xs font-700 text-white/90 mb-2 bg-white/15 px-3 py-1 rounded-full w-fit">
                  {banner.tag}
                </span>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-800 text-white leading-tight mb-2">
                  {banner.headline}
                </h2>
                {banner.sub && (
                  <p className="text-white/80 text-sm md:text-base mb-4 line-clamp-2">
                    {banner.sub}
                  </p>
                )}
                <div>
                  <Link href={banner.href}>
                    <button className="btn-accent text-sm">
                      {banner.cta}
                      <Icon name="ArrowRightIcon" size={15} />
                    </button>
                  </Link>
                </div>
              </div>
            </>
          )}

          {/* Banner indicators */}
          {banners.length > 1 && (
            <div className="absolute bottom-3 right-4 flex gap-2 z-20">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveBanner(i)}
                  aria-label={`Show banner ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === activeBanner ? 'w-6 bg-white' : 'w-2 bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
