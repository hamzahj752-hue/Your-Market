-- Product Variants: optional admin-managed size/color combinations per product.
-- Variants are PRODUCT-SPECIFIC and OPTIONAL. No variant rows exist unless an
-- admin explicitly creates them for a given product.
--
-- Rules:
--   - At least size OR color must be provided (not null).
--   - Admin controls all variant rows; customers never create/mutate variants.
--   - Customers can read active variants for public products only.
--   - The customer app MUST NOT auto-create variants from product metadata.

-- ===========================================================================
-- 1) Table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size              text,
  color_name        text,
  color_value       text,         -- hex color code e.g. #000000 (nullable)
  image_url         text,         -- optional variant-specific image URL
  sku               text,
  price             numeric(12,2), -- NULL means use base product price
  original_price    numeric(12,2), -- NULL means use base product original_price
  stock_quantity    integer NOT NULL DEFAULT 0,
  active            boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_variants IS 'Admin-managed product variants (size, color) - optional per product';

-- At least one of size or color must be present
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_must_have_size_or_color
  CHECK (size IS NOT NULL OR color_name IS NOT NULL);

-- Stock cannot be negative
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_stock_positive
  CHECK (stock_quantity >= 0);

-- Price cannot be negative when provided
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_price_positive
  CHECK (price IS NULL OR price >= 0);

-- Original price cannot be negative when provided
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_original_price_positive
  CHECK (original_price IS NULL OR original_price >= 0);

-- Unique combination: same product + same size + same color_name
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_size_color_idx
  ON public.product_variants (product_id, size, color_name)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS product_variants_product_idx
  ON public.product_variants (product_id, active);

-- ===========================================================================
-- 2) RLS
-- ===========================================================================
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Public can read active variants for active public products
CREATE POLICY "Public can view active variants"
  ON public.product_variants FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id AND p.active = true
    )
  );

-- Admin full CRUD on variants
CREATE POLICY "Admins can insert variants"
  ON public.product_variants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update variants"
  ON public.product_variants FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete variants"
  ON public.product_variants FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ===========================================================================
-- 3) Updated_at trigger
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.update_variant_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_variant_timestamp ON public.product_variants;
CREATE TRIGGER trg_update_variant_timestamp
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_variant_timestamp();

-- ===========================================================================
-- 4) Extend order_items to optionally snapshot variant details
-- ===========================================================================
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id uuid;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_size text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_color text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_sku text;

-- ===========================================================================
-- 5) Extend cart_items to support variant identity
-- ===========================================================================
-- Original cart_items had UNIQUE (user_id, product_id). With variants we need
-- one cart row per (user_id, product_id, variant_id) so two different variants
-- of the same product stay separate, while non-variant products keep exactly
-- one row per (user_id, product_id).
--
-- PostgreSQL treats NULLs as DISTINCT in UNIQUE indexes, so a plain
-- (user_id, product_id, variant_id) unique index would allow many NULL rows
-- (i.e. duplicate non-variant entries). To preserve the old guarantee for
-- non-variant items while adding per-variant uniqueness, we drop the legacy
-- table constraint and replace it with a unique index that substitutes a fixed
-- sentinel UUID for NULL variant_id. This restores the previous
-- (user_id, product_id) uniqueness for non-variant rows and adds
-- (user_id, product_id, variant_id) uniqueness for variant rows.

ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS variant_id uuid;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS variant_size text;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS variant_color text;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS variant_image text;

-- Drop the legacy UNIQUE(user_id, product_id) table constraint so that
-- multiple variants of one product can coexist. The legacy constraint was
-- created inline (unique (user_id, product_id)) so PostgreSQL auto-named it;
-- drop it by whichever auto-name exists.
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT c.conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'cart_items'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[
      (SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = t.oid AND a.attname = 'user_id'),
      (SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = t.oid AND a.attname = 'product_id')
    ]::smallint[]
  LIMIT 1;

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.cart_items DROP CONSTRAINT %I', v_con);
  END IF;
END;
$$;

-- Composite uniqueness with a sentinel for non-variant rows.
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_variant_idx
  ON public.cart_items (user_id, product_id,
                        coalesce(variant_id, '00000000-0000-0000-0000-000000000000'));
