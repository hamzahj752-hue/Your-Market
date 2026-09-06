'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import BannerCreative from '@/components/banner/BannerCreative';
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

// Returns a safe internal destination for a banner, or null when the banner is
// not clickable. Uses the storefront's existing safe-internal-path rule so an
// unsafe/empty value falls back to null (no navigation) instead of producing a
// malformed link. A linked-but-deleted product still resolves to the product
// route where the storefront's product-not-found handling takes over gracefully
// — it never silently points at a different product.
function bannerDestination(banner: BriefHero): string | null {
  if (!banner.cta_url) return null;
  const safe = getSafeInternalPath(banner.cta_url, '');
  return safe === '' ? null : safe;
}

export default function HeroSection() {
  const [banners, setBanners] = useState<BriefHero[]>([]);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [intervalMs, setIntervalMs] = useState(4500);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set true when a swipe/drag occurred so a subsequent synthetic click on a
  // clickable slide is ignored — prevents accidental navigation while swiping.
  const swipedRef = useRef(false);

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
    swipedRef.current = false;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const isSwipe = Math.abs(dx) > 40;
    if (isSwipe) {
      swipedRef.current = true;
      if (dx < 0) next();
      else prev();
    }
  };

  // Called on the slide link onClick. A touch swipe sets swipedRef before the
  // synthetic click arrives, so we cancel navigation for that gesture.
  const onSlideClick = (e: React.MouseEvent) => {
    if (swipedRef.current) {
      e.preventDefault();
      swipedRef.current = false;
    }
  };

  if (slideCount === 0) return null;

  return (
    <section className="pt-2" aria-label="Featured banners">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
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
          aria-label="Homepage highlights"
        >
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {banners.map((b, i) => {
              const isActive = i === idx;
              const dest = bannerDestination(b);
              return (
                <BannerCreative
                  key={b.id || i}
                  banner={b}
                  href={dest}
                  isFirst={i === 0}
                  isActive={isActive}
                  onSlideClick={onSlideClick}
                  priority={i === 0}
                  headingLevel="h1"
                  accessibleLabel={
                    b.title ? `${b.title}${b.cta_text ? ` — ${b.cta_text}` : ''}` : 'View banner'
                  }
                />
              );
            })}
          </div>

          {/* Prev / Next */}
          {slideCount > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous banner"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/70 hover:bg-white text-foreground flex items-center justify-center transition-all shadow-sm opacity-0 group-hover:opacity-100 md:opacity-100"
              >
                <Icon name="ChevronLeftIcon" size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next banner"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/70 hover:bg-white text-foreground flex items-center justify-center transition-all shadow-sm opacity-0 group-hover:opacity-100 md:opacity-100"
              >
                <Icon name="ChevronRightIcon" size={18} />
              </button>
            </>
          )}

          {/* Dots — sit on the lower edge of the inner panel, above the
              foreground pop-out region */}
          {slideCount > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur px-2.5 py-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id || i}
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(i);
                  }}
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
