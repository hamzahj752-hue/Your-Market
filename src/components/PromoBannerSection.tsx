'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import BannerCreative from '@/components/banner/BannerCreative';
import { fetchPromoBanners, BriefPromo } from '@/lib/homepageCms';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Secondary promotional banner carousel driven entirely by Admin-managed
// homepage_promotional_banners data. Never fabricated; empty when none active.
// Reuses the SAME unified BannerCreative renderer as the hero so both carousels
// share one premium visual language from the same composition data model.
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
    <section className="bg-white py-2 px-3 sm:px-4" aria-label="Promotions">
      <div className="max-w-7xl mx-auto">
        {/* OUTER CAROUSEL: clips horizontally so the foreground never causes
            document scroll and adjacent slides never bleed in during swipe. */}
        <div
          className="relative w-full overflow-hidden select-none group"
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
            {promos.map((p, i) => (
              <BannerCreative
                key={p.id || i}
                banner={p}
                href={null}
                isFirst={i === 0}
                isActive={i === idx}
                priority={i === 0}
                headingLevel="h2"
                flatArtMaxWidth="sm:max-w-[880px]"
              />
            ))}
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
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur px-2.5 py-1.5">
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
