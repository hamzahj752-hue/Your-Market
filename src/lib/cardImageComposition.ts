// Product Card Image Appearance — customer-side counterpart of the Admin model
// (see D:\yourmarket-admin-copy\src\lib\cardImageComposition.ts). The Admin
// stores these values on a products row and the customer Product Card renders
// exactly that framing for the card thumbnail.
//
// Semantics:
//   - fit 'cover' fills the card media area (may crop), 'contain' shows the
//     whole MAIN image (letterboxed against the cream card background).
//   - zoom multiplies the fit baseline. 1 = fit baseline (the current Product
//     Card behavior), >1 zooms in, <1 zooms out. Safe range 50%-200%.
//   - x/y follow the 0-100 '%' model (50 = centered), like CSS object-position.
//
// Defaults reproduce the existing Product Card behavior (contain, centered,
// zoom 1), so legacy products with no saved values keep rendering identically
// and no manual backfill is required.
//
// This ONLY affects the customer PRODUCT CARD thumbnail. The Product Details
// gallery image rendering is intentionally untouched.

export type CardImageFit = 'cover' | 'contain';

export interface CardImageComposition {
  fit: CardImageFit;
  zoom: number;
  x: number;
  y: number;
}

export const DEFAULT_CARD_IMAGE_COMPOSITION: CardImageComposition = {
  fit: 'contain',
  zoom: 1,
  x: 50,
  y: 50,
};

export const CARD_ZOOM_MIN = 0.5;
export const CARD_ZOOM_MAX = 2;

function finite(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeFit(v: unknown): CardImageFit {
  return v === 'cover' ? 'cover' : 'contain';
}

/**
 * Maps a raw DB row (snake_case card_image_* columns) OR a plain card-ish object
 * to a safe, clamped composition. Every field falls back to the canonical
 * default when missing, so products created before the columns existed (or
 * before this feature shipped) render exactly as they always did.
 */
export function normalizeCardImageComposition(
  value:
    | {
        cardImageFit?: unknown;
        cardImageScale?: unknown;
        cardImageZoom?: unknown;
        cardImageX?: unknown;
        cardImageY?: unknown;
        card_image_fit?: unknown;
        card_image_scale?: unknown;
        card_image_position_x?: unknown;
        card_image_position_y?: unknown;
        image_fit?: unknown;
        image_scale?: unknown;
        image_position_x?: unknown;
        image_position_y?: unknown;
      }
    | null
    | undefined
): CardImageComposition {
  if (!value) return { ...DEFAULT_CARD_IMAGE_COMPOSITION };
  return {
    fit: normalizeFit(value.cardImageFit ?? value.card_image_fit ?? value.image_fit),
    zoom: clamp(
      finite(
        value.cardImageScale ?? value.cardImageZoom ?? value.card_image_scale ?? value.image_scale,
        1
      ),
      CARD_ZOOM_MIN,
      CARD_ZOOM_MAX
    ),
    x: clamp(
      finite(value.cardImageX ?? value.card_image_position_x ?? value.image_position_x, 50),
      0,
      100
    ),
    y: clamp(
      finite(value.cardImageY ?? value.card_image_position_y ?? value.image_position_y, 50),
      0,
      100
    ),
  };
}

/**
 * CSS style for the scaled, pannable image stage inside a card media box.
 *
 * The stage starts at the same size as the media box and is scaled about the
 * box center by `zoom`. x/y pan it so 50 = centered, 0 = shows the left/top
 * side and 100 = shows the right/bottom side (CSS object-position model). All
 * offsets are percentages of the STAGE itself, so the math is independent of
 * the absolute box size. This is the single source of truth shared by the Admin
 * LIVE preview and this customer renderer.
 *
 * The media box must keep `overflow: hidden` so the scaled stage can never
 * cover surrounding card content or neighboring cards.
 */
export function cardImageStageStyle(opts: {
  zoom: number;
  x: number;
  y: number;
}): React.CSSProperties {
  const z = Math.min(CARD_ZOOM_MAX, Math.max(CARD_ZOOM_MIN, opts.zoom));
  const offX = ((50 - opts.x) / 100) * ((z - 1) / z) * 100;
  const offY = ((50 - opts.y) / 100) * ((z - 1) / z) * 100;
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: `${z * 100}%`,
    height: `${z * 100}%`,
    transform: `translate(calc(-50% + ${offX}%), calc(-50% + ${offY}%))`,
  };
}
