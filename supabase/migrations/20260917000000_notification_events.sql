-- Notification events + SMS consent (PREPARED ONLY — NOT APPLIED).
--
-- Extends the existing notifications pipeline (20260829159000_notifications.sql)
-- with the admin realtime/desktop + customer SMS events:
--
--   1. orders gains food-aware admin notifications: a FOOD order emits
--      `new_food_order` (link /admin/food-orders) instead of `new_order`
--      (link /admin/orders), so the admin desktop notifier routes correctly.
--      Customer notifications are unchanged.
--   2. product_submissions gains an admin `new_submission` notification
--      (link /admin/submissions) so a newly submitted product is surfaced in
--      the admin desktop notifier and the sidebar badge.
--   3. profiles gains `sms_enabled` (default false = explicit opt-in) so the
--      admin "customer SMS" broadcast only ever reaches consented customers.
--
-- Additive + idempotent only: `add column if not exists`, `drop policy if
-- exists`, and `CREATE OR REPLACE FUNCTION` / `drop trigger if exists`. No
-- destructive statements. Leave UNPUSHED for manual review.

-- ===========================================================================
-- 1) SMS consent column on profiles (explicit opt-in, never defaulted on).
-- ===========================================================================
alter table public.profiles
  add column if not exists sms_enabled boolean not null default false;

comment on column public.profiles.sms_enabled is
  'Customer consent for promotional SMS. Defaults to OFF; admins never broadcast to un-opted-in users.';

-- ===========================================================================
-- 2) Food-aware ORDER notifications.
--    notify_order_placed() is replaced so that order_type = 'food' drives an
--    admin `new_food_order` notification pointing at /admin/food-orders.
--    The customer notification stays unaffected.
-- ===========================================================================

create or replace function public.notify_order_placed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
  v_is_food boolean;
begin
  v_label := coalesce(new.order_number, new.id);
  v_is_food := coalesce(new.order_type, 'product') = 'food';

  if new.user_id is not null then
    perform public.notify(
      'customer', new.user_id, 'order_placed', 'Order Placed',
      'Your order ' || v_label || ' has been placed successfully.',
      '/account/orders/' || new.id, new.id,
      jsonb_build_object('order_number', new.order_number, 'order_id', new.id, 'order_type', new.order_type)
    );
  end if;

  if v_is_food then
    perform public.notify(
      'admin', null, 'new_food_order', 'New Food Order',
      'A new food order ' || v_label || ' is awaiting preparation.',
      '/admin/food-orders', new.id,
      jsonb_build_object('order_number', new.order_number, 'order_id', new.id)
    );
  else
    perform public.notify(
      'admin', null, 'new_order', 'New Order Received',
      'A new order ' || v_label || ' has been placed and is awaiting processing.',
      '/admin/orders', new.id,
      jsonb_build_object('order_number', new.order_number, 'order_id', new.id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_order_placed on public.orders;
create trigger trg_notify_order_placed
  after insert on public.orders
  for each row
  execute function public.notify_order_placed();

-- ===========================================================================
-- 3) New product submission (admin notification).
-- ~product_submissions is the table created by 20260902100000_product_submissions.sql.
-- ===========================================================================

create or replace function public.notify_new_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  v_label := coalesce(new.product_name, new.id);
  perform public.notify(
    'admin', null, 'new_submission', 'New Product Submission',
    'A customer submitted a product for approval: "' || v_label || '".',
    '/admin/submissions', null,
    jsonb_build_object('submission_id', new.id, 'product_name', v_label)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_submission on public.product_submissions;
create trigger trg_notify_new_submission
  after insert on public.product_submissions
  for each row
  execute function public.notify_new_submission();