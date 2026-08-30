-- Phase 2: profiles + addresses
-- Profiles store account-level data keyed to the auth user.
-- Addresses store the user's saved shipping addresses (multiple per user).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  default_address_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

comment on table public.profiles is 'Account profile data, one row per auth user';

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  city text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.addresses is 'Saved shipping addresses owned by a user';

alter table public.addresses enable row level security;

create policy "Users can view their own addresses"
  on public.addresses for select
  using (auth.uid() = user_id);

create policy "Users can add their own addresses"
  on public.addresses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own addresses"
  on public.addresses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own addresses"
  on public.addresses for delete
  using (auth.uid() = user_id);

create index if not exists addresses_user_id_idx on public.addresses (user_id);
