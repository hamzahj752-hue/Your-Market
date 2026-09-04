-- Product Submissions — Admin Integration (applied AFTER the base migration
-- 20260902100000_product_submissions.sql, which already created the table,
-- its RLS, customer + admin policies, the private submission-images bucket,
-- and admin storage read/manage policies).
--
-- This migration adds ONLY what the base migration does not provide:
--   1) created_product_id — links a submission to the product admins publish
--   2) Trigger override to protect created_product_id from customer mutation
--   3) DB-level duplicate-publication protection (unique + atomic claim RPC)
--
-- It deliberately does NOT re-create any admin RLS policies on
-- product_submissions or submission-images, because the base migration already
-- provides equivalent ones:
--   - "Admins can read all submissions"
--   - "Admins can update submissions"
--   - "Admins can delete submissions"
--   - "Admins can read submission images"
--   - "Admins can manage submission images"
-- All customer RLS from the base migration is preserved unchanged.

-- ===========================================================================
-- 1) Link column: which product was created from this approved submission.
--    products.id is TEXT in this schema, so a text references is compatible.
--    ON DELETE SET NULL so deleting a product does not cascade-fail the
--    submission (and keeps the audit trail of the submission itself).
-- ===========================================================================
alter table public.product_submissions
  add column if not exists created_product_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_submissions'::regclass
      and conname = 'product_submissions_created_product_fk'
  ) then
    alter table public.product_submissions
      add constraint product_submissions_created_product_fk
      foreign key (created_product_id) references public.products(id)
      on delete set null;
  end if;
end $$;

-- Unique index: a single submission may link to at most one product, and no
-- two submissions may claim the same product. This is DB-enforced so a second
-- publication of the same submission (or the same product) violates uniqueness
-- and is rejected — duplicate publication cannot rely only on the frontend.
drop index if exists product_submissions_created_product_unique;
create unique index product_submissions_created_product_unique
  on public.product_submissions (created_product_id)
  where created_product_id is not null;

create index if not exists product_submissions_status_created_idx
  on public.product_submissions (status, created_product_id);

-- ===========================================================================
-- 2) Protect created_product_id from customer mutation.
--    The base migration's protect_submission_admin_fields() trigger covers
--    admin_note / reviewed_at but was written before created_product_id existed.
--    We override the function here so it also forces created_product_id to its
--    stored value for non-admin callers. Admin callers (link_submission_to_product
--    RPC) may set it normally. This does NOT change the existing customer update
--    behavior for legitimate pending submission fields.
-- ===========================================================================
create or replace function public.protect_submission_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.admin_note        := old.admin_note;
    new.reviewed_at       := old.reviewed_at;
    new.created_product_id := old.created_product_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ===========================================================================
-- 3) Atomic duplicate-publication guard.
--
--    Publication must be a SEPARATE, explicit admin step after approval. This
--    SECURITY DEFINER RPC atomically "claims" a submission for a product so two
--    concurrent saves can never both link (duplicate creation is prevented at
--    the DB level). It re-checks is_admin() server-side and only succeeds when
--    the submission is approved and not already published.
-- ===========================================================================
create or replace function public.link_submission_to_product(
  p_submission_id uuid,
  p_product_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.product_submissions%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;

  select * into v_submission
  from public.product_submissions
  where id = p_submission_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_submission.status <> 'approved' then
    return jsonb_build_object('ok', false, 'error', 'not_approved');
  end if;

  if v_submission.created_product_id is not null then
    return jsonb_build_object(
      'ok', false,
      'error', 'already_published',
      'created_product_id', v_submission.created_product_id
    );
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    return jsonb_build_object('ok', false, 'error', 'product_not_found');
  end if;

  update public.product_submissions
  set created_product_id = p_product_id
  where id = p_submission_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.link_submission_to_product(uuid, text) from public;
grant execute on function public.link_submission_to_product(uuid, text) to authenticated;
