-- Nepal Address Structured Fields (PREPARED — NOT APPLIED).
--
-- Purpose: give the customer address system first-class structured Nepal
-- address components instead of storing everything as one giant string.
-- The existing `addresses` table already carries the base components
-- (recipient_name, phone, address_line, city) plus GPS coordinates
-- (latitude/longitude, added by 20260907150000 and 20260909000000).
-- This migration ADDS the structured Nepal fields the one-tap
-- GPS → reverse-geocode → auto-fill flow writes:
--   district        e.g. "Kathmandu"   (Nominatim county)
--   province        e.g. "Bagmati Province" (Nominatim state)
--   ward            e.g. "Ward 8"      (Nominatim ward / city_district)
--   postal_code     e.g. "44600"       (Nominatim postcode)
--   landmark        manual fill field  (never geocoded — a human-only input)
--   formatted_address      full display_name captured from the geocoder
--   country         e.g. "Nepal"
--
-- All columns are NULLABLE text. They sit on the SAME public row, so RLS
-- policies on `addresses` already apply unchanged. The client persists these
-- only when the columns exist (guarded), so the app keeps working exactly as
-- before this migration is applied.
--
-- Forward-safe and re-runnable:
--   * `add column if not exists` only,
--   * no drops, no policy/trigger changes.

alter table public.addresses
  add column if not exists district text;
alter table public.addresses
  add column if not exists province text;
alter table public.addresses
  add column if not exists ward text;
alter table public.addresses
  add column if not exists postal_code text;
alter table public.addresses
  add column if not exists landmark text;
alter table public.addresses
  add column if not exists formatted_address text;
alter table public.addresses
  add column if not exists country text;