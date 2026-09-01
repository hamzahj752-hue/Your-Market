-- =============================================================================
-- YourMarket Admin — Shipping, Tracking & Order Operations (forward-safe)
-- =============================================================================
-- This migration is safe to review and apply via `supabase db push`.
-- It uses ONLY `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`, so it
-- can be applied without breaking existing data and without colliding with
-- prior migrations. It makes NO destructive changes and does NOT modify/drop
-- existing columns, tables, functions, triggers or policies.
--
-- Purpose:
--   1. Add shipping / tracking / fulfilment timestamps to the orders table.
--   2. Add cancellation fields (cancelled_at, cancellation_reason) if absent.
--   3. Add a private admin-only internal-note table (order_notes) with strict RLS.
--
-- Customer notification on shipped/delivered/cancelled is intentionally NOT
-- duplicated here: the existing notifications migration already provides the
-- SECURITY DEFINER `public.notify()` helper (execution revoked from clients)
-- and the `trg_notify_order_status` AFTER UPDATE trigger which auto-emits a
-- customer notification whenever `orders.status` changes to Shipped, Delivered
-- or Cancelled. When the admin marks an order shipped/delivered the server-side
-- order-fulfillment API simply updates `status`; that trigger sends the notice.
-- No new SECURITY DEFINER helper is introduced to avoid a redundant (and
-- potentially client-abusable) notification write path.
--
-- NOTE: reviewed separately — NOT auto-applied by the admin website.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Shipping / tracking fields on the orders table
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
-- Useful index for admin filtering/search on tracking number when present.
CREATE INDEX IF NOT EXISTS orders_tracking_number_idx ON public.orders (tracking_number)
  WHERE tracking_number IS NOT NULL;
-- -----------------------------------------------------------------------------
-- 2) Cancellation fields (added only if absent)
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;
CREATE INDEX IF NOT EXISTS orders_cancelled_at_idx ON public.orders (cancelled_at)
  WHERE cancelled_at IS NOT NULL;
-- -----------------------------------------------------------------------------
-- 3) Private admin-only internal order notes
-- -----------------------------------------------------------------------------
-- Customers must NEVER read these. RLS grants SELECT/INSERT only to admins
-- (via public.is_admin()). No customer policy exists, so customers get zero
-- rows even though they own the order. order_id is TEXT to match the existing
-- schema (public.orders.id is TEXT — see place_order / notifications migrations).
CREATE TABLE IF NOT EXISTS public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text NOT NULL CHECK (char_length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_notes_order_id_idx ON public.order_notes (order_id, created_at DESC);
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
-- RLS: admin-only read.
DROP POLICY IF EXISTS "admins_read_order_notes" ON public.order_notes;
CREATE POLICY "admins_read_order_notes"
  ON public.order_notes
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
-- RLS: admin-only insert (author must be the acting admin).
DROP POLICY IF EXISTS "admins_insert_order_notes" ON public.order_notes;
CREATE POLICY "admins_insert_order_notes"
  ON public.order_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND author_id = auth.uid());
-- RLS: admins may delete only their own internal notes (or rely on cascade).
DROP POLICY IF EXISTS "admins_delete_own_order_notes" ON public.order_notes;
CREATE POLICY "admins_delete_own_order_notes"
  ON public.order_notes
  FOR DELETE
  TO authenticated
  USING (public.is_admin() AND author_id = auth.uid());
-- -----------------------------------------------------------------------------
-- 4) Security note on the newly added orders columns.
-- -----------------------------------------------------------------------------
-- The new columns (carrier, tracking_number, tracking_url, shipped_at,
-- delivered_at, cancelled_at, cancellation_reason) sit on the existing `orders`
-- table and are therefore governed by the EXISTING orders RLS. That existing
-- model already:
--   * lets customers SELECT only their own order rows; and
--   * lets UPDATE only admins ("Admins can update orders": USING is_admin()
--     WITH CHECK is_admin()).
-- Consequences (no changes required here):
--   * Customers can read tracking/shipping info ONLY for their own order rows.
--   * Customers have NO UPDATE path on any order column (shipping/tracking/
--     fulfilment included) — only the admin API (which requires is_admin())
--     can mutate these, so customers can never self-assign a carrier/tracking
--     number or mark their own order shipped/delivered.
-- No redundant UPDATE policy is created because doing so would be unnecessary
-- and could introduce confusion; the existing policy already covers the new
-- columns.
-- =============================================================================;
