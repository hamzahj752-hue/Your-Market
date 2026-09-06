// Banner artwork composition model. The Admin stores these values on a banner
// row and the customer renders exactly that framing — the Admin is
// authoritative and no customer-side crop logic may override it.
//
// Defaults reproduce the pre-composition behavior (cover, centered, full view)
// so legacy banner rows keep rendering identically when metadata is missing.

export type BannerFit = 'cover' | 'contain';

export const BANNER_FIT_TYPES: BannerFit[] = ['cover', 'contain'];

export interface BannerComposition {
  image_fit: BannerFit;
  image_scale: number;
  image_position_x: number;
  image_position_y: number;
  foreground_image_url: string | null;
  foreground_scale: number;
  foreground_position_x: number;
  foreground_position_y: number;
}

export const DEFAULT_COMPOSITION: BannerComposition = {
  image_fit: 'cover',
  image_scale: 1,
  image_position_x: 50,
  image_position_y: 50,
  foreground_image_url: null,
  foreground_scale: 1.5,
  foreground_position_x: 50,
  foreground_position_y: 50,
};

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;

function finite(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeFit(v: unknown): BannerFit {
  return v === 'contain' ? 'contain' : 'cover';
}

export function normalizeBannerComposition(
  row: Record<string, unknown> | null | undefined
): BannerComposition {
  if (!row) return { ...DEFAULT_COMPOSITION };
  return {
    image_fit: normalizeFit(row.image_fit),
    image_scale: clamp(finite(row.image_scale, 1), 0, 8),
    image_position_x: clamp(finite(row.image_position_x, 50), 0, 100),
    image_position_y: clamp(finite(row.image_position_y, 50), 0, 100),
    foreground_image_url:
      typeof row.foreground_image_url === 'string' && row.foreground_image_url
        ? row.foreground_image_url
        : null,
    foreground_scale: clamp(finite(row.foreground_scale, 1.5), 0.1, 8),
    foreground_position_x: clamp(finite(row.foreground_position_x, 50), 0, 100),
    foreground_position_y: clamp(finite(row.foreground_position_y, 50), 0, 100),
  };
}

export interface LayerLayout {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function computeLayerLayout(opts: {
  viewportW: number;
  viewportH: number;
  naturalW: number;
  naturalH: number;
  fit: BannerFit;
  scale: number;
  positionX: number;
  positionY: number;
}): LayerLayout | null {
  const { viewportW, viewportH, naturalW, naturalH } = opts;
  if (viewportW <= 0 || viewportH <= 0) return null;
  if (!Number.isFinite(naturalW) || !Number.isFinite(naturalH) || naturalW <= 0 || naturalH <= 0) {
    return null;
  }
  const base =
    opts.fit === 'contain'
      ? Math.min(viewportW / naturalW, viewportH / naturalH)
      : Math.max(viewportW / naturalW, viewportH / naturalH);
  const s = Math.max(0.001, base * opts.scale);
  const width = naturalW * s;
  const height = naturalH * s;
  const overflowX = Math.max(0, width - viewportW);
  const overflowY = Math.max(0, height - viewportH);
  const offsetX = ((50 - opts.positionX) / 100) * overflowX;
  const offsetY = ((50 - opts.positionY) / 100) * overflowY;
  return { width, height, offsetX, offsetY };
}
