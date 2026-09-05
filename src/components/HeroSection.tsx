'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { fetchHeroBanners, fetchHeroAutoplay, BriefHero } from '@/lib/homepageCms';
import { getSafeInternalPath } from '@/lib/auth';

// Fallback slide preserves the original single-brand banner when no active CMS
// hero banners are configured. Never fabricated advertising — the artwork is the
// on-brand YourMarket banner already shipped in the repo.
const FALLBACK_HERO: BriefHero = {
  id: 'fallback-brand',
  title: null,
  subtitle: null,
  image_url: '/assets/yourmarket-main-banner.png',
  cta_text: null,
  cta_url: null,
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function HeroSection() {
  const [banners, setBanners] = useState<BriefHero[]>([]);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [intervalMs, setIntervalMs] = useState(4500);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchHeroBanners(), fetchHeroAutoplay()]).then(([cmsBanners, cfg]) => {
      if (!active) return;
      setBanners(cmsBanners.length > 0 ? cmsBanners : [FALLBACK_HERO]);
      setAutoplayEnabled(cfg.enabled && !prefersReducedMotion());
      setIntervalMs(cfg.intervalMs);
    });
    return () => {
      active = false;
    };
  }, []);

  const slideCount = banners.length;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (slideCount === 0) return;
      setIdx(((next % slideCount) + slideCount) % slideCount);
    },
    [slideCount]
  );

  const next = useCallback(() => goTo(idx + 1), [goTo, idx]);
  const prev = useCallback(() => goTo(idx - 1), [goTo, idx]);

  useEffect(() => {
    clearTimer();
    if (!autoplayEnabled || paused || slideCount <= 1) return;
    timerRef.current = setTimeout(next, intervalMs);
    return () => clearTimer();
  }, [idx, autoplayEnabled, paused, slideCount, intervalMs, next, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
  };

  if (slideCount === 0) return null;

  return (
    <section className="pt-1" aria-label="Featured banners">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div
          className="relative w-full overflow-hidden rounded-xl md:rounded-2xl bg-muted/40 shadow-sm select-none group"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          role="region"
          aria-roledescription="carousel"
          aria-label="Homepage highlights"
        >
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {banners.map((b, i) => {
              const isActive = i === idx;
              const content = (
                <>
                  <div className="relative h-32 sm:h-48 md:h-64 lg:h-80 w-full">
                    <AppImage
                      src={b.image_url}
                      alt={b.title || 'Your Market'}
                      fill
                      priority={i === 0}
                      sizes="100vw"
                      className="object-contain bg-muted/40"
                    />
                    <div className="absolute inset-0 from-black/45 via-transparent to-transparent bg-gradient-to-r" />
                  </div>

                  {(b.title || b.subtitle || b.cta_text) && (
                    <div className="absolute inset-0 flex items-center">
                      <div className="px-5 sm:px-8 md:px-12 max-w-xl">
                        {b.subtitle && (
                          <p className="text-white/85 text-xs sm:text-sm font-600 mb-1.5">
                            {b.subtitle}
                          </p>
                        )}
                        {b.title && (
                          <h1 className="text-xl sm:text-3xl md:text-4xl font-800 text-white leading-tight drop-shadow-md">
                            {b.title}
                          </h1>
                        )}
                        {b.cta_text && b.cta_url && getSafeInternalPath(b.cta_url, '') !== '' && (
                          <Link
                            href={getSafeInternalPath(b.cta_url, '/')}
                            className="inline-flex items-center gap-1.5 mt-3 sm:mt-4 bg-white text-accent font-800 text-xs sm:text-sm px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {b.cta_text}
                            <Icon name="ArrowRightIcon" size={15} />
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );

              return (
                <div
                  key={b.id || i}
                  className="relative w-full flex-shrink-0"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Slide ${i + 1} of ${slideCount}`}
                  aria-hidden={!isActive}
                >
                  {content}
                </div>
              );
            })}
          </div>

          {/* Prev / Next */}
          {slideCount > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous banner"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/70 hover:bg-white text-foreground flex items-center justify-center transition-all shadow-sm opacity-0 group-hover:opacity-100 md:opacity-100"
              >
                <Icon name="ChevronLeftIcon" size={18} />
              </button>
              <button
                onClick={next}
                aria-label="Next banner"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/70 hover:bg-white text-foreground flex items-center justify-center transition-all shadow-sm opacity-0 group-hover:opacity-100 md:opacity-100"
              >
                <Icon name="ChevronRightIcon" size={18} />
              </button>
            </>
          )}

          {/* Dots */}
          {slideCount > 1 && (
            <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id || i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to banner ${i + 1}`}
                  aria-current={i === idx}
                  className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                    i === idx ? 'w-5 sm:w-6 bg-white' : 'w-1.5 sm:w-2 bg-white/50 hover:bg-white/80'
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
