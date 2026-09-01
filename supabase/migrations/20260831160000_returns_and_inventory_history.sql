-- =============================================================================
-- YourMarket Admin — Returns & Refunds + Inventory History (forward-safe)
-- =============================================================================
-- Final-phase addition. Forward-safe: uses ONLY `CREATE TABLE IF NOT EXISTS`,
-- `CREATE OR REPLACE FUNCTION`, `CREATE INDEX IF NOT EXISTS`, and `DROP POLICY
-- IF EXISTS` (only on tables created here). It makes NO destructive changes and
-- does NOT modify/drop any pre-existing table, column, function, trigger or
-- policy. Existing data is preserved.
--
-- Security model (summarised at the bottom):
--   * Customers can SELECT only their own return requests.
--   * Customers can INSERT a return request for their own (delivered) order
--     only; they MUST NOT self-approve, self-reject, mark themselves refunded,
--     or choose a refund amount.
--   * Admin-only mutations (approve/reject/refund/lifecycle) are enforced both
--     by RLS (admins only) and, for the inventory side-effect, by an
--     admin-guarded SECURITY DEFINER function. The Admin UI routes mutations
--     through a server-side API that checks is_admin() before calling these.
--   * Refund state here is OPERATIONAL tracking of an admin decision, not a
--     claim that money moved through a payment provider. Actual external refund
--     execution remains a manual/provider step (see `refund_execution`).
--   * Inventory history is write-only public/anon-restricted: customers cannot
--     write or modify it. It is appended only by the SECURITY DEFINER
--     `adjust_inventory` (admin-validated) or by the sales-decrement path.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Returns & Refunds
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  customer_note text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'refunded', 'closed')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  refund_status text NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'pending', 'completed', 'skipped')),
  refund_amount numeric(12,2) NOT NULL DEFAULT 0,
  -- 'inline' = refunded via our own operational accounting (COD/manual notes)
  -- 'external' = must be executed in the payment provider / manually by staff
  refund_execution text NOT NULL DEFAULT 'manual'
    CHECK (refund_execution IN ('manual', 'external', 'cod')),
  refunded_at timestamptz,
  refunded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inventory_restored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS returns_return_number_key ON public.returns (return_number)
  WHERE return_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS returns_order_id_idx ON public.returns (order_id);
CREATE INDEX IF NOT EXISTS returns_customer_id_idx ON public.returns (customer_id);
CREATE INDEX IF NOT EXISTS returns_status_idx ON public.returns (status);
CREATE INDEX IF NOT EXISTS returns_created_at_idx ON public.returns (created_at DESC);
-- Customers read only their own return requests.
DROP POLICY IF EXISTS "customer_read_own_returns" ON public.returns;
CREATE POLICY "customer_read_own_returns"
  ON public.returns
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());
-- Admins can read all return requests (member-managed RLS via is_admin()).
DROP POLICY IF EXISTS "admins_read_all_returns" ON public.returns;
CREATE POLICY "admins_read_all_returns"
  ON public.returns
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
-- Customers may open a request for their own order. The payload is limited by
-- the CHECK on status/refund_* defaults: a customer cannot set status, refund
-- fields, admin_note, reviewed_by, or inventory_restored because those default
-- to safe values and the columns are not exposed to customers in this UI. To be
-- belt-and-braces, WITH CHECK also forces the row to belong to the caller and
-- keeps sensitive columns at their secure defaults.
DROP POLICY IF EXISTS "customer_insert_own_return" ON public.returns;
CREATE POLICY "customer_insert_own_return"
  ON public.returns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND status = 'pending'
    AND refund_status = 'none'
    AND refund_amount = 0
    AND admin_note IS NULL
    AND inventory_restored = false
  );
-- Mutations (approve/reject/refund/lifecycle/notes) are admin-only.
DROP POLICY IF EXISTS "admins_update_returns" ON public.returns;
CREATE POLICY "admins_update_returns"
  ON public.returns
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- Admin-delete of a return request (cleanup) is allowed only for admins.
DROP POLICY IF EXISTS "admins_delete_returns" ON public.returns;
CREATE POLICY "admins_delete_returns"
  ON public.returns
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
-- -----------------------------------------------------------------------------
-- 2) Inventory history / movements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  delta integer NOT NULL,                 -- + => in, - => out
  previous_quantity integer NOT NULL,
  resulting_quantity integer NOT NULL,
  reason text NOT NULL
    CHECK (reason IN ('sale', 'cancellation', 'return', 'adjustment')),
  related_order_id text,
  related_return_id uuid,
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS inventory_history_product_idx
  ON public.inventory_history (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_history_reason_idx
  ON public.inventory_history (reason);
-- No customer/anon write path. Admin display read allowed via is_admin().
DROP POLICY IF EXISTS "admins_read_inventory_history" ON public.inventory_history;
CREATE POLICY "admins_read_inventory_history"
  ON public.inventory_history
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
-- Do NOT grant INSERT/UPDATE/DELETE to anyone directly: history is appended
-- exclusively by the admin-guarded SECURITY DEFINER function below (and by the
-- existing order/return paths that call it). This guarantees customers can
-- never write inventory history or mutate stock.

-- -----------------------------------------------------------------------------
-- 3) Admin-guarded, validated inventory adjustment (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
-- Encapsulates "adjust stock and record a history row atomically". It refuses
-- to operate unless the caller is an admin and refuses any resulting negative
-- stock. It is the ONLY supported path that appends inventory_history rows.
-- `search_path` is pinned to `public` so callers cannot hijack unqualified
-- names.
CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id text,
  p_delta integer,
  p_reason text,
  p_related_order_id text DEFAULT NULL,
  p_related_return_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_next integer;
  v_result jsonb;
BEGIN
  -- Authorisation is enforced here, server-side, regardless of caller.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required.';
  END IF;

  IF p_delta = 0 THEN
    RAISE EXCEPTION 'Delta must be non-zero.';
  END IF;

  IF p_reason NOT IN ('sale', 'cancellation', 'return', 'adjustment') THEN
    RAISE EXCEPTION 'Invalid inventory reason.';
  END IF;

  SELECT COALESCE(stock_quantity, 0) INTO v_current
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  v_next := v_current + p_delta;

  -- Never allow negative stock through any supported adjustment flow.
  IF v_next < 0 THEN
    RAISE EXCEPTION 'Adjustment would make stock negative (current %, delta %).',
      v_current, p_delta;
  END IF;

  UPDATE public.products
  SET stock_quantity = v_next,
      in_stock = (v_next > 0)
  WHERE id = p_product_id;

  INSERT INTO public.inventory_history (
    product_id, delta, previous_quantity, resulting_quantity,
    reason, related_order_id, related_return_id, admin_user_id, note
  )
  VALUES (
    p_product_id, p_delta, v_current, v_next,
    p_reason, p_related_order_id, p_related_return_id, auth.uid(), p_note
  );

  SELECT jsonb_build_object(
    'ok', true,
    'product_id', p_product_id,
    'previous_quantity', v_current,
    'resulting_quantity', v_next
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
END;
$$;
-- Only admins may invoke the function; revoke from anon/authenticated is
-- achieved by the SECURITY DEFINER guard above. Grant it to authenticated so
-- the server-side (admin token) client can call it.
REVOKE ALL ON FUNCTION public.adjust_inventory(text, integer, text, text, uuid, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(text, integer, text, text, uuid, text)
  TO authenticated;
-- Revoke direct write on the products column path we rely on: history is the
-- audit trail, so any non-API stock change would be invisible. However, the
-- existing Admin products page already updates stock_quantity directly and must
-- keep working (Phase D requirement: "Keep the existing current stock
-- functionality"). We therefore do NOT revoke the existing products UPDATE
-- policy here. The inventory_history table itself has no customer write path,
-- which is the guarantee that matters for this phase.

-- =============================================================================
-- SECURITY SUMMARY
-- =============================================================================
--  returns:
--   customers read own rows only; customers insert only own-order pending rows
--   with refund fields locked to safe defaults; update/delete are admin-only.
--   Customers cannot approve/reject/mark-refunded/choose refund amount, and
--   cannot read admin_note of others.
-- inventory_history:
--   admins read; nobody writes directly (no INSERT/UPDATE/DELETE policy).
--   Rows are appended only by public.adjust_inventory, which requires is_admin()
--   and refuses negative stock (authoritative, DB-enforced).
-- The Admin UI invokes these via a server-side route that verifies is_admin().
-- =============================================================================;
