-- Account phone uniqueness (NO OTP / NO SMS).
--
-- Goal: ONE normalized Nepal mobile number -> ONE Google-authenticated
-- YourMarket account. Physical ownership is NOT proven (no OTP/SMS by
-- design); this only guarantees that a number cannot be associated with more
-- than one account.
--
-- What this migration adds:
--   1. public.normalize_nepal_phone(text) - a SQL mirror of the storefront's
--      src/lib/nepalPhone.ts rule so Account / Checkout / Request a Product
--      all converge on ONE canonical form ("+97798XXXXXXXX").
--   2. public.account_phones - the authorized phone-claim registry. A DB
--      UNIQUE index on phone_norm is the authoritative, race-safe uniqueness
--      rule. Customers may only read their OWN row (RLS) and cannot write the
--      table directly; all claims go through set_account_phone().
--   3. public.set_account_phone(text) - SECURITY DEFINER RPC used by the
--      account profile save. Normalizes, rejects claims already held by
--      ANOTHER account with a safe generic message, and upserts the claim.
--   4. Orders: BEFORE INSERT/UPDATE trigger - prevents placing a NEW order
--      with a delivery phone claimed by another account (checkout bypass
--      guard). Historical order rows are never rewritten.
--   5. product_submissions: BEFORE INSERT/UPDATE trigger - prevents a Request
--      a Product from associating another account's phone and forces the
--      canonical form for new submissions. Existing rows are untouched.
--
-- Admins (public.is_admin()) are deliberately exempt: admin order /
-- submission creation is trusted.
--
-- IMPORTANT - NOT auto-applied, reviewed manually. See repository workflow:
--   CODE READY / MIGRATION READY / LIVE ENFORCEMENT BLOCKED UNTIL APPLIED.
--
-- Legacy duplicate review (read-only, run by the reviewer before applying):
--   -- auth metadata phone duplicates:
--   select count(*) as duplicate_groups
--   from (
--     select (raw_user_meta_data->>'phone') as p, count(*)
--     from auth.users
--     where raw_user_meta_data->>'phone' is not null
--       and raw_user_meta_data->>'phone' <> ''
--     group by (raw_user_meta_data->>'phone')
--     having count(*) > 1
--   ) d;
--
-- This migration starts the registry EMPTY on purpose: demanding a backfill
-- of the legacy/duplicate-prone phone storage (auth metadata + profiles.phone
-- + addresses.phone) at apply time would make the UNIQUE index creation fail
-- or silently pick owners. No customer data is overwritten. The first account
-- to save each number claims it; any account that already had a duplicate
-- number will see the generic conflict message on its next profile save.

-- ===========================================================================
-- 1) Canonical Nepal mobile normalizer (SQL parity with src/lib/nepalPhone.ts)
-- ===========================================================================
create or replace function public.normalize_nepal_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text;
  v_clean text;
begin
  if p_value is null then
    return null;
  end if;

  v_digits := regexp_replace(p_value, '[^0-9]', '', 'g');
  if v_digits = '' then
    return null;
  end if;

  -- Remove an optional Nepal country prefix (mirrors the JS util accepting
  -- both '977...' and '+977...' after stripping punctuation).
  v_clean := v_digits;
  if v_clean like '977%' then
    v_clean := substr(v_clean, 4);
  end if;

  -- Exactly 10 local digits, starting with a valid Nepal mobile prefix.
  if length(v_clean) <> 10 then
    return null;
  end if;
  if v_clean not like '98%' and v_clean not like '97%' then
    return null;
  end if;

  return '+977' || v_clean;
end;
$$;

revoke all on function public.normalize_nepal_phone(text) from public;
grant execute on function public.normalize_nepal_phone(text) to authenticated;

-- ===========================================================================
-- 2) Phone-claim registry
-- ===========================================================================
create table if not exists public.account_phones (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  phone      text not null,
  phone_norm text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.account_phones is
  'Authoritative registry mapping one canonical Nepal mobile to exactly one account (no OTP/SMS).';

-- The database-level uniqueness rule: the same normalized number can never be
-- claimed by two accounts, even under concurrent requests.
create unique index if not exists account_phones_phone_norm_unique
  on public.account_phones (phone_norm);

create index if not exists account_phones_user_idx
  on public.account_phones (user_id);

alter table public.account_phones enable row level security;

-- Owner read of their OWN claim only. There are deliberately NO customer
-- INSERT/UPDATE/DELETE policies: direct table writes are denied; every claim
-- must go through set_account_phone() so normalization and the safe conflict
-- message are guaranteed. Admins may read the registry for support/admin.
drop policy if exists "Users can view their own account phone" on public.account_phones;
create policy "Users can view their own account phone"
  on public.account_phones for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can view account phones" on public.account_phones;
create policy "Admins can view account phones"
  on public.account_phones for select
  to authenticated
  using (public.is_admin());

-- ===========================================================================
-- 3) SECURITY DEFINER RPC: claim / update the signed-in account's phone
-- ===========================================================================
create or replace function public.set_account_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_canonical text;
  v_norm      text;
begin
  if v_uid is null then
    raise exception 'You must be signed in to update your phone.';
  end if;

  v_canonical := public.normalize_nepal_phone(p_phone);
  if v_canonical is null then
    raise exception 'Enter a valid 10-digit Nepal mobile number.';
  end if;

  v_norm := substring(v_canonical from 5); -- the 10 local digits

  -- Reject when ANOTHER account already owns this normalized number. The
  -- current account may keep / re-claim its own number.
  if exists (
    select 1 from public.account_phones
    where phone_norm = v_norm
      and user_id <> v_uid
  ) then
    raise exception 'This phone number is already linked to another account.';
  end if;

  begin
    insert into public.account_phones (user_id, phone, phone_norm, updated_at)
    values (v_uid, v_canonical, v_norm, now())
    on conflict (user_id) do update
      set phone      = excluded.phone,
          phone_norm = excluded.phone_norm,
          updated_at = now();
  exception when unique_violation then
    -- Raised only when two requests race for the same number at the same
    -- moment; surface the same safe, non-identifying message.
    raise exception 'This phone number is already linked to another account.';
  end;

  return v_canonical;
end;
$$;

revoke all on function public.set_account_phone(text) from public, anon;
grant execute on function public.set_account_phone(text) to authenticated;

-- ===========================================================================
-- 4) Orders: block checkout bypass (delivery phone claimed by another account)
-- ===========================================================================
create or replace function public.enforce_account_phone_unique_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical text;
  v_norm      text;
begin
  -- Trusted admin order creation is exempt.
  if public.is_admin() then
    return new;
  end if;

  v_canonical := public.normalize_nepal_phone(new.phone);
  if v_canonical is null then
    return new; -- not a typed Nepal mobile; historical/other formats untouched
  end if;

  v_norm := substring(v_canonical from 5);

  if exists (
    select 1 from public.account_phones
    where phone_norm = v_norm
      and user_id <> new.user_id
  ) then
    raise exception 'This phone number is already linked to another account.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_account_phone_unique_on_order on public.orders;
create trigger trg_enforce_account_phone_unique_on_order
  before insert or update of phone on public.orders
  for each row
  execute function public.enforce_account_phone_unique_on_order();

-- ===========================================================================
-- 5) Request a Product: submissions must not claim another account's phone
-- ===========================================================================
create or replace function public.enforce_account_phone_unique_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical text;
  v_norm      text;
begin
  if public.is_admin() then
    return new;
  end if;

  v_canonical := public.normalize_nepal_phone(new.customer_phone);
  if v_canonical is null then
    return new; -- keep whatever non-Nepal value is provided; not an identity
  end if;

  v_norm := substring(v_canonical from 5);

  if exists (
    select 1 from public.account_phones
    where phone_norm = v_norm
      and user_id <> new.user_id
  ) then
    raise exception 'This phone number is already linked to another account.';
  end if;

  -- Store the canonical form for new submissions (single canonical rule).
  new.customer_phone := v_canonical;
  return new;
end;
$$;

drop trigger if exists trg_enforce_account_phone_unique_on_submission on public.product_submissions;
create trigger trg_enforce_account_phone_unique_on_submission
  before insert or update of customer_phone on public.product_submissions
  for each row
  execute function public.enforce_account_phone_unique_on_submission();