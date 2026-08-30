-- Phase 3: order status workflow + payment status
-- Extends the existing orders_status_check to add 'Processing' and 'Refunded'
-- while preserving legacy 'Placed'. Adds a payment_status column.

-- Replace the status check constraint with the full workflow set.
alter table public.orders drop constraint if exists orders_status_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_status_check' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_status_check
      check (status in (
        'Pending','Confirmed','Processing','Shipped','Delivered',
        'Cancelled','Refunded','Placed'
      ));
  end if;
end $$;

alter table public.orders add column if not exists payment_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_status_check' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('pending','paid','unpaid','refunded'));
  end if;
end $$;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
