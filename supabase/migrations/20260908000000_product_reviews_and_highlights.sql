-- Per-product "Customer Reviews" control (manually prepared; NOT yet applied).
--
-- Adds a boolean products.reviews_enabled flag:
--   ON  -> the customer Product Details page renders the Ratings & Reviews
--          section (default; every existing product keeps showing reviews).
--   OFF -> the whole Reviews section unmounts on the storefront — no review
--          form controls exist in the DOM at all, so they cannot be reached by
--          keyboard or assistive tech (not merely hidden). REVIEWS ARE NEVER
--          DELETED; they simply reappear if the control is turned back ON.
--
-- Additive and idempotent. Defaults to TRUE so pre-existing rows (and rows
-- created before this migration is applied) behave exactly as before.
--
-- Product highlights remain stored in the existing products.details JSONB as
-- { text, icon } objects — the storefront parser accepts both that shape and
-- the legacy plain-string list — so NO schema change is needed for highlights.

alter table public.products add column if not exists reviews_enabled boolean not null default true;