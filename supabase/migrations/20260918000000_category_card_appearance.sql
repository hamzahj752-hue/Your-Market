-- Category Card Appearance (PREPARED, NOT APPLIED).
--
-- Adds Admin-controllable category-card appearance presets to the
-- store_settings singleton. The store owner edits these in Admin → Homepage →
-- Category Cards Appearance; the customer's category strips ("Shop by
-- Category", the "Food" row, and the Product Details Fast Foods strip, all
-- built on the shared CategoryCard component) read them via
-- src/lib/categoryCardStyle.ts and render bounded, controlled presets.
--
-- Two independent groups let each section keep its own look while sharing the
-- same safe value domain:
--   * category_card_*  -> global / "Shop by Category" (and other general strips)
--   * food_card_*      -> the homepage / Product Details "Food" strip
--
-- NO free-form CSS/code is stored — only controlled preset strings, each
-- clamped on the customer side. Safe, idempotent and forward-rerunnable:
-- `add column if not exists` only, no drops, no table/row changes.

alter table public.store_settings
  add column if not exists category_card_radius text not null default 'lg';
alter table public.store_settings
  add column if not exists category_card_image_shape text not null default 'rounded-square';
alter table public.store_settings
  add column if not exists category_card_size text not null default 'standard';
alter table public.store_settings
  add column if not exists category_card_gap text not null default 'normal';

alter table public.store_settings
  add column if not exists food_card_radius text not null default 'lg';
alter table public.store_settings
  add column if not exists food_card_image_shape text not null default 'rounded-square';
alter table public.store_settings
  add column if not exists food_card_size text not null default 'standard';
alter table public.store_settings
  add column if not exists food_card_gap text not null default 'normal';
