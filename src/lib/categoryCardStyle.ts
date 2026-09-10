'use client';

import { supabase } from '@/lib/supabase';

/*
 * Admin-controllable appearance for the reusable category-card strips that
 * appear in "Shop by Category", the homepage "Food" row, and the Product
 * Details Fast Foods strip (all three render via the shared CategoryCard
 * component). The store owner edits these presets in Admin → Homepage →
 * Category Cards Appearance, which persist to the store_settings singleton
 * (columns added by migration 20260918000000_category_card_appearance.sql).
 *
 * Values are STRICTLY bounded to controlled presets — there is no free-form
 * CSS/code injection possible, and every value is clamped back to a safe
 * preset on the customer side so a bad/missing row can never break the layout
 * or the horizontal scroll.
 */

export type CardRadius = 'sm' | 'md' | 'lg' | 'xl';
export type CardImageShape = 'rounded-square' | 'extra-rounded' | 'circle';
export type CardSize = 'compact' | 'standard' | 'large';
export type CardGap = 'tight' | 'normal' | 'spacious';

export interface CategoryCardStyle {
  radius: CardRadius;
  imageShape: CardImageShape;
  size: CardSize;
  gap: CardGap;
}

export interface ResolvedCategoryCardStyle {
  cardClass: string;
  imageClass: string;
  widthClass: string;
  gapClass: string;
  paddingClass: string;
  labelClass: string;
  iconSize: number;
}

export const DEFAULT_CATEGORY_CARD_STYLE: CategoryCardStyle = {
  radius: 'lg',
  imageShape: 'rounded-square',
  size: 'standard',
  gap: 'normal',
};

// Controlled preset → static Tailwind class map. Classes are written out
// literally so Tailwind's content scanner picks them up at build time.
const CARD_RADIUS: Record<CardRadius, string> = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
};

const IMAGE_SHAPE: Record<CardImageShape, string> = {
  'rounded-square': 'rounded-lg',
  'extra-rounded': 'rounded-2xl',
  circle: 'rounded-full',
};

const SIZE_WIDTH: Record<CardSize, string> = {
  compact: 'w-[76px] sm:w-[84px]',
  standard: 'w-[92px] sm:w-[104px]',
  large: 'w-[116px] sm:w-[130px]',
};

const SIZE_PADDING: Record<CardSize, string> = {
  compact: 'p-1.5',
  standard: 'p-2',
  large: 'p-2.5',
};

const SIZE_LABEL: Record<CardSize, string> = {
  compact: 'text-[10px]',
  standard: 'text-[11px]',
  large: 'text-[12px]',
};

const SIZE_ICON: Record<CardSize, number> = {
  compact: 20,
  standard: 24,
  large: 28,
};

const GAP: Record<CardGap, string> = {
  tight: 'gap-1.5',
  normal: 'gap-2',
  spacious: 'gap-3',
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function resolveCategoryCardStyle(style: CategoryCardStyle): ResolvedCategoryCardStyle {
  const size = style.size || 'standard';
  return {
    cardClass: CARD_RADIUS[style.radius] || CARD_RADIUS.lg,
    imageClass: IMAGE_SHAPE[style.imageShape] || IMAGE_SHAPE['rounded-square'],
    widthClass: SIZE_WIDTH[size],
    gapClass: GAP[style.gap] || GAP.normal,
    paddingClass: SIZE_PADDING[size],
    labelClass: SIZE_LABEL[size],
    iconSize: SIZE_ICON[size],
  };
}

// Reads the admin-configured card appearance for a section from store_settings.
// If the appearance columns don't exist yet (migration not applied) or the row
// is missing, safe defaults are returned so the strip never breaks.
// section: 'categories' (Shop by Category / global) or 'food' (Food row).
export async function fetchCategoryCardStyle(
  section: 'categories' | 'food'
): Promise<ResolvedCategoryCardStyle> {
  const base: CategoryCardStyle = { ...DEFAULT_CATEGORY_CARD_STYLE };
  try {
    const prefix = section === 'food' ? 'food_card_' : 'category_card_';
    const { data, error } = await supabase
      .from('store_settings')
      .select(`${prefix}radius, ${prefix}image_shape, ${prefix}size, ${prefix}gap`)
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      base.radius = pick(data[`${prefix}radius`], ['sm', 'md', 'lg', 'xl'] as const, base.radius);
      base.imageShape = pick(
        data[`${prefix}image_shape`],
        ['rounded-square', 'extra-rounded', 'circle'] as const,
        base.imageShape
      );
      base.size = pick(data[`${prefix}size`], ['compact', 'standard', 'large'] as const, base.size);
      base.gap = pick(data[`${prefix}gap`], ['tight', 'normal', 'spacious'] as const, base.gap);
    }
  } catch {
    /* appearance migration not applied — keep safe defaults */
  }
  return resolveCategoryCardStyle(base);
}
