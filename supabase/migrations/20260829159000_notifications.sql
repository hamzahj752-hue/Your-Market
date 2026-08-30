-- Phase 6: In-app Notifications (Customer & Admin)
--
-- Adds a single notifications table plus server-side triggers that generate
-- notifications from the existing order/review flow without modifying any
-- existing client code paths:
--
--   CUSTOMER notifications (recipient_type = 'customer', recipient_id = user):
--     - Order Placed      -> AFTER INSERT on orders
--     - Order Confirmed   -> AFTER UPDATE OF status on orders
--     - Order Shipped     -> AFTER UPDATE OF status on orders
--     - Order Delivered   -> AFTER UPDATE OF status on orders
--     - Order Cancelled   -> AFTER UPDATE OF status on orders
--
--   ADMIN notifications (recipient_type = 'admin', broadcast to all admins via RLS):
--     - New Order Received    -> AFTER INSERT on orders
--     - Low Stock Alert       -> AFTER INSERT/UPDATE on products (stock_quantity < 5)
--     - New Customer Registered -> AFTER INSERT on auth.users
--     - New Review Submitted  -> AFTER INSERT on reviews
--
-- All notification writes happen inside SECURITY DEFINER trigger functions so
-- RLS stays tight: clients can only SELECT/UPDATE their own rows via policies,
-- and cannot insert/delete notifications directly.
--
-- NOTE: orders.id is TEXT (existing schema), so order_id is TEXT so the FK
-- reference public.orders(id) is valid. Uses only additive/idempotent SQL;
-- no destructive statements. Migration is left UNPUSHED for manual review.

-- --- Table ---
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null check (recipient_type in ('customer','admin')),
  recipient_id uuid,
  type text not null,
  title text not null,
  message text not null,
  link text,
  order_id text references public.orders(id) on delete set null,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications for customers (recipient_id set) and admins (broadcast).';

-- --- Indexes ---
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_type, recipient_id, is_read);
create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);
create index if not exists notifications_order_id_idx
  on public.notifications (order_id);

-- --- RLS ---
alter table public.notifications enable row level security;

-- Customers can read their own notifications.
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_type = 'customer' and recipient_id = auth.uid());

-- Customers can mark their own notifications read/unread.
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (recipient_type = 'customer' and recipient_id = auth.uid())
  with check (recipient_type = 'customer' and recipient_id = auth.uid());

-- Admins can read ADMIN notifications (broadcast to any admin via is_admin()).
drop policy if exists "Admins can view admin notifications" on public.notifications;
create policy "Admins can view admin notifications"
  on public.notifications for select
  to authenticated
  using (recipient_type = 'admin' and public.is_admin());

-- Admins can mark ADMIN notifications read/unread.
drop policy if exists "Admins can update admin notifications" on public.notifications;
create policy "Admins can update admin notifications"
  on public.notifications for update
  to authenticated
  using (recipient_type = 'admin' and public.is_admin())
  with check (recipient_type = 'admin' and public.is_admin());

-- --- Shared write helper (SECURITY DEFINER, trigger-only; not granted to clients) ---

create or replace function public.notify(
  p_recipient_type text,
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text default null,
  p_order_id text default null,
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications
    (recipient_type, recipient_id, type, title, message, link, order_id, metadata)
  values
    (p_recipient_type, p_recipient_id, p_type, p_title, p_message, p_link, p_order_id, p_metadata);
end;
$$;

-- --- Trigger 1: Order placed (customer notification + admin notification) ---

create or replace function public.notify_order_placed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  v_label := coalesce(new.order_number, new.id);

  if new.user_id is not null then
    perform public.notify(
      'customer', new.user_id, 'order_placed', 'Order Placed',
      'Your order ' || v_label || ' has been placed successfully.',
      '/account/orders/' || new.id, new.id,
      jsonb_build_object('order_number', new.order_number, 'order_id', new.id)
    );
  end if;

  perform public.notify(
    'admin', null, 'new_order', 'New Order Received',
    'A new order ' || v_label || ' has been placed and is awaiting processing.',
    '/admin/orders', new.id,
    jsonb_build_object('order_number', new.order_number, 'order_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_order_placed on public.orders;
create trigger trg_notify_order_placed
  after insert on public.orders
  for each row
  execute function public.notify_order_placed();

-- --- Trigger 2: Order status change (customer notifications) ---
-- Covers Confirmed, Shipped, Delivered, Cancelled (and any future text status).

create or replace function public.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
  v_type text;
begin
  if new.status is distinct from old.status and new.user_id is not null then
    v_label := coalesce(new.order_number, new.id);
    v_type := 'order_' || lower(regexp_replace(new.status, '[^a-zA-Z0-9]', '_', 'g'));
    perform public.notify(
      'customer', new.user_id, v_type, 'Order ' || new.status,
      'Your order ' || v_label || ' is now ' || new.status || '.',
      '/account/orders/' || new.id, new.id,
      jsonb_build_object('order_number', new.order_number, 'order_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_order_status on public.orders;
create trigger trg_notify_order_status
  after update of status on public.orders
  for each row
  execute function public.notify_order_status();

-- --- Trigger 3: Low stock alert (admin notification) ---
-- Fires only when a product transitions INTO low stock (stock_quantity < 5),
-- matching the admin dashboard's low-stock threshold.

create or replace function public.notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_low boolean;
  v_now_low boolean;
begin
  v_now_low := coalesce(new.stock_quantity, 0) < 5;
  if tg_op = 'INSERT' then
    v_was_low := false;
  else
    v_was_low := coalesce(old.stock_quantity, 0) < 5;
  end if;

  if v_now_low and not v_was_low then
    perform public.notify(
      'admin', null, 'low_stock', 'Low Stock Alert',
      'Product "' || new.name || '" is running low (' || new.stock_quantity || ' left).',
      '/admin/products', null,
      jsonb_build_object('product_id', new.id, 'stock_quantity', new.stock_quantity)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_low_stock on public.products;
create trigger trg_notify_low_stock
  after insert or update of stock_quantity on public.products
  for each row
  execute function public.notify_low_stock();

-- --- Trigger 4: New customer registered (admin notification) ---
-- Hooks auth.users INSERT (most reliable registration signal; profiles are not
-- auto-created on signup so they cannot be relied on). Accounts created via
-- the customer signup flow all fire this. No PII is written to the row.

create or replace function public.notify_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify(
    'admin', null, 'new_customer', 'New Customer Registered',
    'A new customer account was created.',
    '/admin/customers', null,
    jsonb_build_object('user_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_customer on auth.users;
create trigger trg_notify_new_customer
  after insert on auth.users
  for each row
  execute function public.notify_new_customer();

-- --- Trigger 5: New review submitted (admin notification) ---

create or replace function public.notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify(
    'admin', null, 'new_review', 'New Review Submitted',
    'A new ' || new.rating || '-star review was submitted for moderation.',
    '/admin/reviews', null,
    jsonb_build_object('review_id', new.id, 'product_id', new.product_id, 'rating', new.rating)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_review on public.reviews;
create trigger trg_notify_new_review
  after insert on public.reviews
  for each row
  execute function public.notify_new_review();
