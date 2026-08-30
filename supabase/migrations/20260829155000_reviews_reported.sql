-- Phase 3: reported reviews support
-- Adds a reported flag and report count to reviews so admins can surface
-- user-flagged content in review moderation.

alter table public.reviews add column if not exists reported boolean not null default false;
alter table public.reviews add column if not exists reports_count integer not null default 0;

create index if not exists reviews_reported_idx on public.reviews (reported);
