'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import BannerLayer from '@/components/banner/BannerLayer';
import { getSafeInternalPath } from '@/lib/auth';
import { normalizeBannerComposition, type BannerFit } from '@/lib/bannerComposition';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface BannerCreativeData {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  image_fit?: BannerFit;
  image_scale?: number;
  image_position_x?: number;
  image_position_y?: number;
  foreground_image_url?: string | null;
  foreground_scale?: number;
  foreground_position_x?: number;
  foreground_position_y?: number;
}

export interface BannerCreativeProps {
  banner: BannerCreativeData;
  /** When provided the whole inner panel becomes a link. When null the CTA is
   *  a standalone link (if cta_url is valid). */
  href: string | null;
  isFirst?: boolean;
  /** Whether this slide is the currently visible one (controls focusability). */
  isActive?: boolean;
  /** Swipe-cancel handler passed through to the outer slide wrapper. */
  onSlideClick?: (e: React.MouseEvent) => void;
  priority?: boolean;
  headingLevel?: 'h1' | 'h2' | 'h3';
  accessibleLabel?: string;
  /** Optional max width class for the inner panel when the banner is a
   *  flattened artwork (no text overlay). Keeps very wide flat banners from
   *  growing to a huge fixed height on large screens before All Products. */
  flatArtMaxWidth?: string;
}

/* ------------------------------------------------------------------ */
/* Shared creative renderer                                            */
/* ------------------------------------------------------------------ */

/**
 * ONE unified promotional banner canvas.
 *
 * Structure per slide:
 *
 *  OUTER SLIDE (relative, allows intentional foreground breathing room)
 *    ├─ pb-4 pop-out region
 *    │  └─ INNER BANNER PANEL (rounded, overflow-hidden)
 *    │     ├─ background artwork
 *    │     ├─ subtle dark scrim for text legibility
 *    │     └─ text / CTA overlay (left-aligned)
 *    └─ FOREGROUND (absolute inset-0, overflow-visible, pointer-events-none)
 *       └─ transparent product/person PNG — may extend slightly beyond
 *          the inner rounded panel into the pop-out region
 *
 * The background ALWAYS occupies the full inner canvas.  The text and the
 * optional foreground are independently overlaid layers belonging to the same
 * composition — no "50% text / 50% image" split.
 *
 * Artwork handling:
 *  - Flattened banners (no title/subtitle/CTA/foreground): the uploaded
 *    artwork IS the complete creative, so the artwork is placed in normal flow
 *    (`block w-full h-auto`). The panel then matches the artwork's own ratio on
 *    first paint — no JS-measured fallback, no letterbox flash, nothing ever
 *    cropped or zoomed.
 *  - Artwork-led banners (flattened art + Admin text/CTA pill): the same
 *    in-flow artwork sizes the panel; text/CTA overlay absolutely on top.
 *  - Text banners (title/subtitle): keep the Admin-controlled cover framing via
 *    the saved composition metadata.
 *
 * Shared by the hero carousel and the secondary promo carousel so both
 * produce the identical premium visual language from the same Admin data
 * model (bannerComposition.ts).
 */
export default function BannerCreative({
  banner,
  href,
  isFirst = false,
  isActive = true,
  onSlideClick,
  priority,
  headingLevel = 'h2',
  accessibleLabel,
  flatArtMaxWidth,
}: BannerCreativeProps) {
  const composition = normalizeBannerComposition(banner as unknown as Record<string, unknown>);
  const fg = composition.foreground_image_url;

  // A banner with an empty title AND subtitle is "artwork-led": the uploaded
  // artwork is itself the complete creative (any copy is baked into the image).
  // When an Admin CTA exists it still overlays as a pill on top of the full
  // artwork; when there is no overlay at all the banner is fully flat
  // (artwork only).
  const hasMessage = Boolean(banner.title || banner.subtitle);
  const isFlatArt = !hasMessage && !banner.cta_text && !fg;
  const isArtworkLed = !hasMessage && !isFlatArt;
  const isIntrinsicArt = isFlatArt || isArtworkLed;

  const HeadingTag = headingLevel;

  /* ---------- artwork ---------- */

  // Flattened / artwork-led banners are shown at their own intrinsic ratio via
  // an in-flow image (exact and stable with zero JS measurement). Text banners
  // keep the composed absolute background layer so the Admin-controlled
  // fit/scale/position framing is authoritative.
  const artwork = banner.image_url ? (
    isIntrinsicArt ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={banner.image_url}
        alt={banner.title || 'Your Market'}
        draggable={false}
        loading={priority ? 'eager' : 'lazy'}
        className="block w-full h-auto select-none"
      />
    ) : (
      <div className="absolute inset-0">
        <BannerLayer
          src={banner.image_url}
          alt={banner.title || 'Your Market'}
          priority={priority ?? isFirst}
          composition={composition}
          layer="image"
        />
      </div>
    )
  ) : null;

  /* ---------- text / CTA ---------- */

  const ctaHref = !href && banner.cta_url ? getSafeInternalPath(banner.cta_url, '') : '';

  // The CTA is shown only when the banner is actually clickable (whole-panel
  // link or a valid CTA link) or an Admin-supplied CTA text exists. The label
  // is always the Admin-provided text; never a fabricated "Shop Now" — when a
  // linked banner has no text the pill renders as a bare arrow affordance.
  const showCta = Boolean(href || ctaHref || banner.cta_text);
  const ctaLabel = banner.cta_text;

  const ctaClasses = `inline-flex items-center gap-1.5 mt-3 sm:mt-4 bg-white text-foreground font-800 text-[11px] sm:text-xs md:text-sm ${
    ctaLabel ? 'px-3.5 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5' : 'px-2.5 py-2.5'
  } rounded-full shadow-sm transition-transform active:scale-95`;

  const ctaIcon = <Icon name="ArrowRightIcon" size={14} />;

  const textContent = (
    <div className="relative min-h-[168px] sm:min-h-[210px] md:min-h-[260px] flex items-center">
      <div className="px-4 sm:px-6 md:px-10 py-5 md:py-6 pr-[34%] sm:pr-[38%] md:pr-[38%] max-w-lg">
        {banner.subtitle && (
          <p className="text-white/90 text-[11px] sm:text-xs md:text-sm font-700 mb-1 sm:mb-1.5 uppercase tracking-wider">
            {banner.subtitle}
          </p>
        )}
        {banner.title && (
          <HeadingTag className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-800 text-white leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
            {banner.title}
          </HeadingTag>
        )}
        {showCta &&
          (ctaHref ? (
            <Link href={ctaHref} className={ctaClasses}>
              {ctaLabel}
              {ctaIcon}
            </Link>
          ) : (
            <span className={ctaClasses}>
              {ctaLabel}
              {ctaIcon}
            </span>
          ))}
      </div>
    </div>
  );

  // Over artwork-led panels (sized by the in-flow artwork) the text/CTA layer
  // overlays absolutely; on text banners it stays in flow and sizes the panel.
  const text = isIntrinsicArt ? <div className="absolute inset-0">{textContent}</div> : textContent;

  /* ---------- inner banner panel (rounded, clips artwork) ---------- */

  // Flat/artwork-led panels tile the artwork edge-to-edge, so the corner radius
  // stays gentler to avoid biting into full-bleed artwork. Text banners keep
  // the larger premium radius.
  const panelRadius = isIntrinsicArt
    ? 'rounded-[18px] sm:rounded-[22px]'
    : 'rounded-[26px] sm:rounded-[30px]';

  const innerPanel = (
    <div
      className={`relative overflow-hidden bg-foreground ${panelRadius} ${
        isIntrinsicArt ? 'mx-auto w-full' : ''
      } ${flatArtMaxWidth ?? ''}`}
    >
      {artwork}
      {!isFlatArt && (
        <>
          {/* soft scrim so text stays readable over any artwork — kept light and
              single-direction so it never builds a muddy multi-layer overlay over
              the artwork. Skipped for flattened banners where the artwork is
              itself the complete design. */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/15 to-transparent pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/25 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        </>
      )}
      {!isFlatArt && text}
    </div>
  );

  /* ---------- slide (outer wrapper) ---------- */

  // A flattened banner with a valid CTA URL is clickable as one whole panel
  // even though it has no separate CTA text/pill.
  const panelHref = href ?? (isFlatArt && ctaHref ? ctaHref : null);

  const linkOrDiv = panelHref ? (
    <Link
      href={panelHref}
      onClick={onSlideClick}
      className="block w-full cursor-pointer"
      tabIndex={isActive ? 0 : -1}
      aria-label={accessibleLabel}
    >
      {innerPanel}
    </Link>
  ) : (
    <div className="block w-full">{innerPanel}</div>
  );

  return (
    <div
      className="relative w-full flex-shrink-0"
      role="group"
      aria-roledescription="slide"
      aria-hidden={!isActive}
    >
      <div className="pb-4">{linkOrDiv}</div>

      {/* optional transparent foreground product/person (true pop-out layer) */}
      {fg && (
        <div
          className="absolute inset-0 overflow-visible pointer-events-none select-none"
          aria-hidden="true"
        >
          <BannerLayer
            src={fg}
            alt=""
            priority={isFirst}
            composition={composition}
            layer="foreground"
          />
        </div>
      )}
    </div>
  );
}
