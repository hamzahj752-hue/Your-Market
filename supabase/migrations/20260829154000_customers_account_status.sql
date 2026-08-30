-- Phase 3: customers / account status management
-- Extends profiles so admins can manage customers and block/unblock them, and
-- enforces the block server-side by rejecting new orders from blocked users.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists blocked_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_status_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_account_status_check
      check (account_status in ('active','blocked'));
  end if;
end $$;

-- Admins can view all profiles for customer management (owner policy kept too).
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists profiles_account_status_idx on public.profiles (account_status);

-- Server-side enforcement: a blocked user cannot place new orders even though
-- the place_order RPC runs with SECURITY DEFINER (triggers still fire).
create or replace function public.prevent_orders_when_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select account_status into v_status
  from public.profiles
  where id = new.user_id;

  if v_status = 'blocked' then
    raise exception 'Your account has been blocked. Please contact support.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_orders_when_blocked on public.orders;
create trigger trg_prevent_orders_when_blocked
  before insert on public.orders
  for each row
  execute function public.prevent_orders_when_blocked();
