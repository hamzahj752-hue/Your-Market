# YourMarket — Production Final Test Checklist

Use this checklist to manually verify the storefront before and after a production deployment.
Run through **Customer**, **Admin**, **Security**, **SEO**, **Device** sections after the build is
live (staging first, then production).

---

## Customer

- [ ] **Signup** — a new email can register; a verification email is sent.
- [ ] **Email verification** — clicking the link confirms the account (an unverified user cannot log in).
- [ ] **Login / Logout** — credentials work; logging out clears session and shows guest UI.
- [ ] **Forgot / Reset password** — reset email sent; the reset link opens `/account/reset-password`; a new password can be set.
- [ ] **Profile / Address** — view and edit profile (name, phone, address, city); add/edit/delete/select default address; avatar upload/remove.
- [ ] **Product browse / search / filter** — `/products` loads; search returns results; category/price/rating filters and sort work; empty search shows a clean empty state.
- [ ] **Product detail** — image, price, description, add-to-cart, quantity, wishlist toggle, out-of-stock handling, related products, reviews (add/edit).
- [ ] **Wishlist** — add/remove; badge count in header updates; empty state shows.
- [ ] **Cart** — add/remove/quantity change; totals update; empty-state shown; checkout link.
- [ ] **Coupon** — enter a valid coupon at checkout; discount applies server-side; invalid/expired coupon shows a safe message.
- [ ] **COD checkout** — complete order via Cash on Delivery; order number, total, Payment = "Cash on Delivery", Payment Status = "pending" shown on confirmation.
- [ ] **Order confirmation** — confirmation screen appears once (no duplicate on double-click); order number accessible.
- [ ] **Orders** — list shows status, payment method and payment status; order detail shows timeline, items, totals.
- [ ] **Reviews** — leave/edit/report a review; verified-purchase badge where applicable.
- [ ] **Notifications** — customer receives Order Placed notification; bell badge counts unread; mark-as-read works; empty state shows.

## Admin

- [ ] **Login / non-admin denial** — a non-admin user is denied (Access denied); an admin succeeds.
- [ ] **Dashboard** — stat cards, orders, products, and sales chart render (chart shows an empty state if no data).
- [ ] **Products / categories** — list, search, create, edit, delete; image upload and gallery; status/active toggle.
- [ ] **Image uploads** — products store logo, homepage, category images upload to Supabase Storage (admin-only) and display.
- [ ] **Orders** — status changes fire customer notifications; payment status (pending/paid/unpaid/failed/refunded) updates; paid/refunded record timestamps.
- [ ] **Customers / block** — view customers, block/unblock; blocked user is prevented from ordering.
- [ ] **Coupons** — create/edit; discount constraints validated.
- [ ] **Reviews / moderation** — approve/reject/dismiss report/delete reviews; reported filter.
- [ ] **Homepage CMS** — each section (hero, featured, deals, categories, promo, testimonials, trust) shows an empty state or saved content.
- [ ] **Store Settings** — save shipping/tax/currency; toggles persist.
- [ ] **Maintenance mode** — enabling shows the "We'll be right back" screen to storefront users; admins can still reach `/admin` to turn it off.
- [ ] **Notifications** — admin sees New Order / Low Stock / New Customer / New Review; empty states show.

## Security

- [ ] **RLS isolation** — a customer can only see their own orders/notifications/addresses.
- [ ] **Admin isolation** — admin-only data and routes are blocked for customers (server-side `is_admin()`).
- [ ] **Disabled COD** — with `cod_enabled` off, the server rejects a COD order even if the client is tampered.
- [ ] **Online payment cannot fake success** — attempting an online payment method returns "Online payment is not available yet"; no order is created as falsely paid.
- [ ] **No secret exposure** — browser/page source contains only `NEXT_PUBLIC_*` values; no service-role key, DB password, or payment secret.
- [ ] **No raw DB errors** — simulated DB/server failures show friendly messages, never constraint names or stack traces.

## SEO

- [ ] **Metadata** — homepage `<title>` and meta description render; other public pages get `%s | Your Market` titles.
- [ ] **Product metadata** — a product page shows a unique title, description, canonical URL, and OG image.
- [ ] **sitemap.xml** — `/sitemap.xml` returns core URLs plus active products and categories; no `/admin`, `/account`, `/checkout`, or private order URLs.
- [ ] **robots.txt** — `/robots.txt` allows public storefront crawling and disallows `/admin/`, `/account/`, `/checkout`, `/wishlist`, `/api/`.
- [ ] **Canonical URLs** — product pages have a canonical pointing at the production site URL.

## Device

- [ ] **Mobile (320–390px)** — no horizontal overflow; header/search, product grids, cart, checkout, account, notifications, footer usable.
- [ ] **Tablet (768px)** — grids and nav adapt; admin tables scroll within their container.
- [ ] **Desktop (1024px+)** — full nav, sidebar filters, multi-column grids.

---

## Post-deploy smoke

- [ ] Env vars are set in the hosting provider (see `docs/deployment-prep.md`).
- [ ] Supabase Auth Site URL / redirect URLs updated to the production domain (see `docs/deployment-prep.md`).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- [ ] `/sitemap.xml` and `/robots.txt` resolve on the production domain.
