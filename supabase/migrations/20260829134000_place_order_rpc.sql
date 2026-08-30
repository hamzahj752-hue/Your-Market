-- Phase 2: place_order RPC
-- Server-side ordering that:
--   * validates the caller is authenticated
--   * recomputes every price from the products table (never trusts the client)
--   * rejects out-of-stock / unknown products
--   * generates a unique order number
--   * applies coupons server-side
--   * writes the order + order_items atomically
--   * marks verified purchases on the user's reviews
-- Runs with SECURITY DEFINER so it can write orders/order_items regardless of RLS
-- while enforcing row ownership inside the function.

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
  -- public.orders.id is TEXT (existing schema), so the generated order id
  -- must be TEXT to reference orders.id and order_items.order_id.
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
BEGIN
  if v_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  v_payment := coalesce(p_payment_method, 'cod');

  -- Resolve coupon first (admin-managed table, service-role readable here).
  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon
    from public.coupons
    where code = upper(btrim(p_coupon_code));

    if v_coupon.code is not null
       and v_coupon.active
       and (v_coupon.expires_at is null or v_coupon.expires_at > now()) then
      v_coupon_applied := true;
    else
      raise exception 'Invalid or expired coupon code.';
    end if;
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

  -- Apply coupon discount once subtotal is known.
  if v_coupon_applied then
    v_discount := round(v_subtotal * (v_coupon.discount_percent / 100), 2);
    if v_discount > v_subtotal then
      v_discount := v_subtotal;
    end if;
  end if;

  -- Shipping: free over threshold.
  if v_subtotal - v_discount >= 6500 then
    v_shipping := 0;
  end if;

  v_tax := round((v_subtotal - v_discount) * 0.13, 2);
  -- Generate a UUID-formatted string id for the TEXT orders.id column.
  v_order_id := gen_random_uuid()::text;
  v_order_number := 'YM-' || to_char(now(), 'YYMMDD') || '-' ||
                    upper(substr(translate(md5(v_order_id), 'abcdef', '123456'), 1, 6));

  insert into public.orders (
    id, user_id, order_number, created_at,
    customer_name, phone, address, city,
    payment_method, subtotal, shipping, tax, discount, coupon_code, total,
    status
  ) values (
    v_order_id, v_user_id, v_order_number, now(),
    coalesce(p_address->>'recipient_name', ''),
    coalesce(p_address->>'phone', ''),
    coalesce(p_address->>'address_line', ''),
    coalesce(p_address->>'city', ''),
    v_payment,
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

    -- Mark any of this user's reviews for the purchased product as verified.
    update public.reviews
      set verified_purchase = true, is_edited = is_edited, updated_at = coalesce(updated_at, now())
      where user_id = v_user_id and product_id = v_product.id;
  end loop;

  select * into v_order_row from public.orders where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_row.id,
    'order_number', v_order_row.order_number,
    'status', v_order_row.status,
    'total', v_order_row.total,
    'created_at', v_order_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text, text) TO authenticated;
