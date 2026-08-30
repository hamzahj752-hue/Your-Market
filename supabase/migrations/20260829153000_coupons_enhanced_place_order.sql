-- Phase 3: coupons enhancement + admin RLS + enhanced place_order RPC
-- Adds fixed-amount discounts, a minimum-order requirement and usage limits to
-- coupons, secures them behind admin-only RLS, and recreates place_order to
-- honour the new coupon rules and to set a payment_status.

-- --- Coupon schema enhancement ---
alter table public.coupons alter column discount_percent drop not null;
alter table public.coupons drop constraint if exists coupons_discount_percent_check;

alter table public.coupons add column if not exists discount_type text not null default 'percent';
alter table public.coupons add column if not exists discount_value numeric(12,2);
alter table public.coupons add column if not exists min_order numeric(12,2) not null default 0;
alter table public.coupons add column if not exists usage_limit integer;
alter table public.coupons add column if not exists used_count integer not null default 0;
alter table public.coupons add column if not exists description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coupons_discount_check' and conrelid = 'public.coupons'::regclass
  ) then
    alter table public.coupons add constraint coupons_discount_check
      check (
        (discount_type = 'percent' and discount_percent > 0 and discount_percent <= 100)
        or (discount_type = 'fixed' and discount_value is not null and discount_value > 0)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coupons_discount_type_check' and conrelid = 'public.coupons'::regclass
  ) then
    alter table public.coupons add constraint coupons_discount_type_check
      check (discount_type in ('percent','fixed'));
  end if;
end $$;

-- --- Secure coupons behind admin-only RLS (the place_order RPC is SECURITY
-- DEFINER and bypasses RLS, so normal checkout is unaffected). ---
alter table public.coupons enable row level security;

drop policy if exists "Admins can view coupons" on public.coupons;
create policy "Admins can view coupons"
  on public.coupons for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert coupons" on public.coupons;
create policy "Admins can insert coupons"
  on public.coupons for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update coupons" on public.coupons;
create policy "Admins can update coupons"
  on public.coupons for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete coupons" on public.coupons;
create policy "Admins can delete coupons"
  on public.coupons for delete
  to authenticated
  using (public.is_admin());

-- --- Enhanced place_order RPC ---
CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_address jsonb,
  p_payment_method text,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_id text;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_shipping numeric(12,2) := 200;
  v_discount numeric(12,2) := 0;
  v_coupon record;
  v_coupon_applied boolean := false;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_line_total numeric(12,2);
  v_order_row record;
  v_payment text;
  v_payment_status text := 'pending';
BEGIN
  if v_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  v_payment := coalesce(p_payment_method, 'cod');
  if v_payment = 'cod' then
    v_payment_status := 'pending';
  else
    v_payment_status := 'paid';
  end if;

  -- Validate items + compute subtotal from the database.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity for an item.';
    end if;

    select * into v_product
    from public.products
    where id = v_item->>'product_id';

    if not found then
      raise exception 'A product in your cart no longer exists.';
    end if;
    if coalesce(v_product.in_stock, false) = false then
      raise exception 'Sorry, "%" is currently out of stock.', v_product.name;
    end if;

    v_line_total := coalesce(v_product.price, 0) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- Resolve coupon after subtotal is known (needed for min-order validation).
  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon
    from public.coupons
    where code = upper(btrim(p_coupon_code));

    if v_coupon.code is null then
      raise exception 'Invalid or expired coupon code.';
    end if;
    if not v_coupon.active then
      raise exception 'This coupon is no longer active.';
    end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
      raise exception 'This coupon has expired.';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
      raise exception 'This coupon has reached its usage limit.';
    end if;

    v_coupon_applied := true;
  end if;

  if v_coupon_applied then
    if v_subtotal < coalesce(v_coupon.min_order, 0) then
      raise exception 'This coupon requires a minimum order of %', v_coupon.min_order;
    end if;

    if v_coupon.discount_type = 'fixed' then
      v_discount := least(coalesce(v_coupon.discount_value, 0), v_subtotal);
    else
      v_discount := round(v_subtotal * (coalesce(v_coupon.discount_percent, 0) / 100), 2);
      if v_discount > v_subtotal then
        v_discount := v_subtotal;
      end if;
    end if;
  end if;

  -- Shipping: free over threshold.
  if v_subtotal - v_discount >= 6500 then
    v_shipping := 0;
  end if;

  v_tax := round((v_subtotal - v_discount) * 0.13, 2);
  v_order_id := gen_random_uuid()::text;
  v_order_number := 'YM-' || to_char(now(), 'YYMMDD') || '-' ||
                    upper(substr(translate(md5(v_order_id), 'abcdef', '123456'), 1, 6));

  insert into public.orders (
    id, user_id, order_number, created_at,
    customer_name, phone, address, city,
    payment_method, payment_status, subtotal, shipping, tax, discount, coupon_code, total,
    status
  ) values (
    v_order_id, v_user_id, v_order_number, now(),
    coalesce(p_address->>'recipient_name', ''),
    coalesce(p_address->>'phone', ''),
    coalesce(p_address->>'address_line', ''),
    coalesce(p_address->>'city', ''),
    v_payment, v_payment_status,
    v_subtotal, v_shipping, v_tax, v_discount,
    case when v_coupon_applied then v_coupon.code else null end,
    v_subtotal - v_discount + v_tax + v_shipping,
    'Pending'
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;

    select * into v_product
    from public.products
    where id = v_item->>'product_id';

    insert into public.order_items (
      order_id, product_id, name, price, quantity, image
    ) values (
      v_order_id, v_product.id, v_product.name, coalesce(v_product.price, 0),
      v_qty, v_product.image
    );

    update public.reviews
      set verified_purchase = true, is_edited = is_edited, updated_at = coalesce(updated_at, now())
      where user_id = v_user_id and product_id = v_product.id;
  end loop;

  if v_coupon_applied then
    update public.coupons
      set used_count = used_count + 1
      where code = v_coupon.code;
  end if;

  select * into v_order_row from public.orders where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_row.id,
    'order_number', v_order_row.order_number,
    'status', v_order_row.status,
    'payment_status', v_order_row.payment_status,
    'total', v_order_row.total,
    'created_at', v_order_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text, text) TO authenticated;
