'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { fetchPromoBanners, BriefPromo } from '@/lib/homepageCms';
import { getSafeInternalPath } from '@/lib/auth';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Secondary promotional banner carousel driven entirely by Admin-managed
// homepage_promotional_banners data. Never fabricated; empty when none active.
export default function PromoBannerSection() {
  const [promos, setPromos] = useState<BriefPromo[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    fetchPromoBanners().then((data) => {
      if (active) setPromos(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const count = promos.length;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIdx(((next % count) + count) % count);
    },
    [count]
  );

  const next = useCallback(() => goTo(idx + 1), [goTo, idx]);
  const prev = useCallback(() => goTo(idx - 1), [goTo, idx]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (count <= 1 || prefersReducedMotion() || paused) return;
    timerRef.current = setTimeout(next, 5000);
    return () => clearTimer();
  }, [idx, count, paused, next, clearTimer]);

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

  if (count === 0) return null;

  return (
    <section className="px-2 sm:px-4 pt-1" aria-label="Promotions">
      <div className="max-w-7xl mx-auto">
        <div
          className="relative w-full overflow-hidden rounded-xl md:rounded-2xl bg-muted/40 select-none group"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          role="region"
          aria-roledescription="carousel"
          aria-label="Promotional banners"
        >
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {promos.map((p, i) => {
              const isActive = i === idx;
              const safePath = getSafeInternalPath(p.cta_url, '');
              const content = (
                <>
                  <div className="relative h-20 sm:h-28 md:h-36 w-full">
                    {p.image_url ? (
                      <AppImage
                        src={p.image_url}
                        alt={p.title || 'Promotion'}
                        fill
                        sizes="100vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center" />
                    )}
                    <div className="absolute inset-0 from-black/60 via-black/25 to-transparent bg-gradient-to-r" />
                  </div>

                  {(p.title || p.subtitle || p.cta_text) && (
                    <div className="absolute inset-0 flex items-center">
                      <div className="px-5 sm:px-8 md:px-12 max-w-md">
                        {p.subtitle && (
                          <p className="text-white/85 text-xs sm:text-sm font-600 mb-1">
                            {p.subtitle}
                          </p>
                        )}
                        {p.title && (
                          <h2 className="text-lg sm:text-2xl md:text-3xl font-800 text-white leading-tight">
                            {p.title}
                          </h2>
                        )}
                        {p.cta_text && safePath && (
                          <Link
                            href={safePath}
                            className="inline-flex items-center gap-1.5 mt-3 sm:mt-4 bg-white text-accent font-800 text-xs sm:text-sm px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {p.cta_text}
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
                  key={p.id || i}
                  className="relative w-full flex-shrink-0"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Promotion ${i + 1} of ${count}`}
                  aria-hidden={!isActive}
                >
                  {content}
                </div>
              );
            })}
          </div>

          {count > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous promotion"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/70 hover:bg-white text-foreground flex items-center justify-center transition-all shadow-sm opacity-0 group-hover:opacity-100 md:opacity-100"
              >
                <Icon name="ChevronLeftIcon" size={18} />
              </button>
              <button
                onClick={next}
                aria-label="Next promotion"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/70 hover:bg-white text-foreground flex items-center justify-center transition-all shadow-sm opacity-0 group-hover:opacity-100 md:opacity-100"
              >
                <Icon name="ChevronRightIcon" size={18} />
              </button>
              <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {promos.map((p, i) => (
                  <button
                    key={p.id || i}
                    onClick={() => goTo(i)}
                    aria-label={`Go to promotion ${i + 1}`}
                    aria-current={i === idx}
                    className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                      i === idx
                        ? 'w-5 sm:w-6 bg-white'
                        : 'w-1.5 sm:w-2 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
