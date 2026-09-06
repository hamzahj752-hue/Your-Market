'use client';

import { useEffect, useRef, useState } from 'react';
import {
  computeLayerLayout,
  type BannerComposition,
  type BannerFit,
} from '@/lib/bannerComposition';

// Reads the natural pixel size of an image URL without rendering a second
// layout node. Shared by the background artwork and the optional foreground.
// StrictMode-safe: the cleanup discards the previous load instead of a
// lastSrc guard (which would skip the re-mounted effect in dev).
function useNaturalSize(src: string | null) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!src) {
      setNat(null);
      return;
    }
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (!active) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setNat({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [src]);

  return nat;
}

function useBoxSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, box };
}

export interface BannerLayerProps {
  src: string | null;
  alt: string;
  composition: BannerComposition;
  layer?: 'image' | 'foreground';
  priority?: boolean;
}

/**
 * Renders one absolutely-positioned artwork layer inside the banner viewport.
 *
 * - layer "image":        the saved background/main artwork using the saved
 *                         fit + scale + position.
 * - layer "foreground":   the optional transparent product/person layer sized
 *                         with contain semantics (never stretched) and its own
 *                         scale + position.
 *
 * Missing metadata normalizes to safe defaults. While the layer wants to be
 * larger than the viewport it uses plain px positioning (never object-fit), so
 * foreground pop-out beyond the inner art panel is possible without clipping.
 */
export default function BannerLayer({
  src,
  alt,
  composition,
  layer = 'image',
  priority = false,
}: BannerLayerProps) {
  const nat = useNaturalSize(src);
  const { ref, box } = useBoxSize();

  const fit: BannerFit = layer === 'foreground' ? 'contain' : composition.image_fit;
  const scale = layer === 'foreground' ? composition.foreground_scale : composition.image_scale;
  const positionX =
    layer === 'foreground' ? composition.foreground_position_x : composition.image_position_x;
  const positionY =
    layer === 'foreground' ? composition.foreground_position_y : composition.image_position_y;

  const layout = nat
    ? computeLayerLayout({
        viewportW: box.w,
        viewportH: box.h,
        naturalW: nat.w,
        naturalH: nat.h,
        fit,
        scale,
        positionX,
        positionY,
      })
    : null;

  if (!src) return null;

  return (
    <div ref={ref} className="absolute inset-0">
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading={priority ? 'eager' : 'lazy'}
        className="select-none"
        style={
          layout
            ? {
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: layout.width,
                height: layout.height,
                maxWidth: 'none',
                transform: `translate(calc(-50% + ${layout.offsetX}px), calc(-50% + ${layout.offsetY}px))`,
              }
            : {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }
        }
      />
    </div>
  );
}
