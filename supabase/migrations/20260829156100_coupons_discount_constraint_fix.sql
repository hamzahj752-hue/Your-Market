-- Phase 3 fix: defensively remove any legacy discount_percent-only check.
--
-- The enhanced coupons migration (20260829153000) drops the auto-named constraint
-- `coupons_discount_percent_check` so that fixed-amount coupons can store
-- discount_percent = NULL. That drop relies on PostgreSQL's standard auto-naming
-- for the Phase 2 inline check. This migration makes the removal bulletproof:
-- it scans pg_constraint for ANY check on public.coupons that references only
-- discount_percent (not discount_type/discount_value) and drops it, regardless
-- of how the constraint was named in the live database.

-- Re-assert that discount_percent is nullable (idempotent; required so that
-- fixed coupons can have discount_percent = NULL).
alter table public.coupons alter column discount_percent drop not null;

-- Remove any legacy percent-only check that might still exist under a
-- non-standard name. The combined coupons_discount_check (added in
-- 20260829153000) is preserved because it references discount_type/disount_value.
-- The constraint definition (pg_get_constraintdef) is captured inside the SELECT
-- while the pg_constraint alias `c` is still in scope, then evaluated in the loop.
do $$
declare
  r record;
begin
  for r in
    select
      c.conname,
      pg_get_constraintdef(c.oid) as cdef
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'coupons'
      and c.contype = 'c'
      and c.conname <> 'coupons_discount_check'
  loop
    if r.cdef like '%discount_percent%'
       and r.cdef not like '%discount_type%'
       and r.cdef not like '%discount_value%'
    then
      execute format('ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS %I', r.conname);
    end if;
  end loop;
end $$;
