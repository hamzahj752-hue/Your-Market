-- Phase 3 fix: allow admins to create a missing profile row for a customer.
--
-- Background: the Phase 2 policy "Users can insert their own profile" uses
-- WITH CHECK (auth.uid() = id), so a user may only insert their OWN profile row.
-- That blocks the admin Customers flow from creating a profile row for a customer
-- who has no row yet (which is required before the block/unblock status can be
-- persisted). This policy adds an admin-only INSERT path. It does NOT remove the
-- existing owner INSERT policy and does NOT touch profiles.id (it stays uuid).

-- The owner INSERT policy from Phase 2 remains intact; we only ADD an admin path.
drop policy if exists "Admins can create profiles" on public.profiles;
create policy "Admins can create profiles"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_admin());
