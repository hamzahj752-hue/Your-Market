-- Phase 6: Homepage hero carousel autoplay configuration
-- Adds forward-safe hero autoplay controls to the store_settings singleton so the
-- admin can enable/disable auto-scroll and tune the interval without touching
-- source code. Defaults keep the current autoplay-on (~4500ms) behaviour.
--
-- Safe & idempotent: no DROP TABLE, no TRUNCATE, no DELETE FROM, no reset.
-- Existing tables/rows are untouched. Statements use IF NOT EXISTS guards.
-- FORWARD-SAFE: this migration is deliberately NOT applied in this session
-- (per working constraints) so the frontend reads these columns defensively and
-- falls back to sensible defaults when they do not exist yet.

-- Add hero_autoplay_enabled (default on) to store_settings if not present.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'store_settings'
      and column_name = 'hero_autoplay_enabled'
  ) then
    alter table public.store_settings
      add column hero_autoplay_enabled boolean not null default true;
  end if;
end $$;

-- Add hero_autoplay_interval_ms (default 4500, clamped 2500-10000 by the UI) if
-- not present.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'store_settings'
      and column_name = 'hero_autoplay_interval_ms'
  ) then
    alter table public.store_settings
      add column hero_autoplay_interval_ms integer not null default 4500;
  end if;
end $$;

-- Constrain the interval to a sane range (forward-compatible).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'store_settings'
      and column_name = 'hero_autoplay_interval_ms'
  ) then
    -- noop guard: column may not exist yet if the add above raced; nothing to do.
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'store_settings'
      and column_name = 'hero_autoplay_interval_ms'
  ) and not exists (
    select 1 from pg_constraint
    where conname = 'store_settings_hero_autoplay_interval_check'
      and conrelid = 'public.store_settings'::regclass
  ) then
    alter table public.store_settings
      add constraint store_settings_hero_autoplay_interval_check
      check (hero_autoplay_interval_ms between 2500 and 10000);
  end if;
end $$;

-- Admin can already update store_settings via the existing RLS update policy and
-- column-level grants (authenticated), so no new grants are required. Public read
-- is likewise covered by the existing select policy/grants on store_settings.
