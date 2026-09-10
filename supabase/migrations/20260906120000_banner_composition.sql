-- Banner artwork composition metadata (SAFE ADDITIVE MIGRATION).
--
-- Adds optional per-banner composition controls used by the Admin banner
-- editor and consumed by the customer storefront:
--
--   image_fit             'cover' | 'contain'   (default 'cover' = current behavior)
--   image_scale           zoom multiplier       (default 1 = fit baseline)
--   image_position_x/y    position, 0-100, 50 = centered (CSS object-position model)
--   foreground_image_url  optional transparent PNG/WebP product/person layer
--   foreground_scale      foreground zoom       (default 1.5)
--   foreground_position_x/y  foreground position, 0-100, 50 = centered
--
-- Every new column is nullable or has a default that reproduces the current
-- behavior (cover, centered, scale 1, no foreground). Existing rows are NOT
-- modified and keep rendering identically. No columns are dropped or renamed.
--
-- This migration is additive and safe to apply. It is NOT auto-applied to the
-- live database; the Admin code probes for the columns and omits them from
-- saves (and uses safe defaults on render) until this is applied.

ALTER TABLE public.homepage_hero_banners
  ADD COLUMN IF NOT EXISTS image_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS image_scale real NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS image_position_x real NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_y real NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS foreground_image_url text,
  ADD COLUMN IF NOT EXISTS foreground_scale real NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS foreground_position_x real NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS foreground_position_y real NOT NULL DEFAULT 50;

ALTER TABLE public.homepage_promotional_banners
  ADD COLUMN IF NOT EXISTS image_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS image_scale real NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS image_position_x real NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_y real NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS foreground_image_url text,
  ADD COLUMN IF NOT EXISTS foreground_scale real NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS foreground_position_x real NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS foreground_position_y real NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'homepage_hero_banners_image_fit_check'
  ) THEN
    ALTER TABLE public.homepage_hero_banners
      ADD CONSTRAINT homepage_hero_banners_image_fit_check
      CHECK (image_fit IN ('cover', 'contain'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'homepage_promotional_banners_image_fit_check'
  ) THEN
    ALTER TABLE public.homepage_promotional_banners
      ADD CONSTRAINT homepage_promotional_banners_image_fit_check
      CHECK (image_fit IN ('cover', 'contain'));
  END IF;
END $$;