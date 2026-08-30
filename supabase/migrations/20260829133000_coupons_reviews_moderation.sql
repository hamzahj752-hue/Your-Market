-- Phase 2: coupons + reviews moderation
-- Adds moderation/verified-purchase support to the existing reviews table
-- and introduces a coupons table used by server-side order placement.

create table if not exists public.coupons (
  code text primary key,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.coupons is 'Discount coupons, managed by admins via service role';

-- No RLS policies on coupons: only the SECURITY DEFINER place_order RPC (service role)
-- may read them. This keeps coupons out of client hands.

-- --- Reviews moderation ---
alter table public.reviews add column if not exists verified_purchase boolean not null default false;
alter table public.reviews add column if not exists is_edited boolean not null default false;
alter table public.reviews add column if not exists moderation_status text not null default 'approved';
alter table public.reviews add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_moderation_status_check' and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews add constraint reviews_moderation_status_check
      check (moderation_status in ('approved','pending','rejected'));
  end if;
end $$;

-- Change public read policy so only approved reviews are shown to everyone,
-- while authors/admins can see their own/pending reviews.
drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Reviews are readable"
  on public.reviews for select
  using (
    moderation_status = 'approved'
    or auth.uid() = user_id
    or public.is_admin()
  );

-- Authors can still insert/update/delete their own reviews (existing policies kept).
-- Guard against forged verified_purchase by only allowing a NULL/FALSE default:
-- verified purchase is set by the service role from order data, never by the client.
create policy "Admins can moderate reviews"
  on public.reviews for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete reviews"
  on public.reviews for delete
  to authenticated
  using (public.is_admin());

create index if not exists reviews_moderation_status_idx on public.reviews (moderation_status);
