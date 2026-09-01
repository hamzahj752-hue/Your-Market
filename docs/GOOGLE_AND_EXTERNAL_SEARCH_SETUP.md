# YourMarket — SEO & Google Merchant Center Setup

This document explains how to make YourMarket products discoverable by Google
and connect a Google Merchant Center feed. Customer-facing search and product
listings show only YourMarket's own products (from Supabase); the external /
affiliate product discovery feature has been removed.

---

## 1. Required production `SITE_URL`

Before anything else, set the real production domain in your hosting environment:

```
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

Why this matters:
- It builds every **canonical product URL** (`/products/<id>`).
- It is used by `robots.txt` (`Sitemap:` line) and `sitemap.xml`.
- It is embedded in the **Merchant Center feed** (`g:link`, `g:id`) and in the
  product JSON-LD (`url`, Offer `url`).

It must match the live site exactly (scheme + no trailing slash + exact
subdomain, e.g. `www` vs non-`www`). Google rejects mismatched canonicals and
feed links. Set the same value in any `.env.local` / production env so
`metadataBase` and every route agree.

---

## 2. Google Search Console setup

1. Verify ownership of the domain (DNS TXT method recommended) at
   https://search.google.com/search-console.
2. Confirm `robots.txt` is reachable at `https://yourdomain.com/robots.txt`. It
   allows public pages (`/`, `/products`, `/products/`, `/api/merchant/`) and
   blocks private/admin areas (`/admin/`, `/account/`, `/checkout`, `/cart`,
   `/wishlist`, `/api/admin/`).
3. Submit `https://yourdomain.com/sitemap.xml` in Search Console → Sitemaps.
4. Product pages now expose:
   - Dynamic `<title>`/`<meta description>`.
   - Canonical `<link>` to the real `/products/<id>` URL.
   - OpenGraph + Twitter card metadata.
   - `schema.org/Product` JSON-LD with name, image, description, brand and an
     Offer (price, currency, availability) and, only when real data exists, SKU
     and an AggregateRating.
5. Verify a product page with the Rich Results Test / URL Inspection. Google
   only shows star ratings when real, positive rating data is present.

> `robots.txt` is guidance only — the real protection of `/admin/*`, `/account*`
> and checkout data comes from Supabase RLS + server-side admin authorization.

---

## 3. Google Merchant Center / feed setup

YourMarket emits a Google Shopping-compatible XML feed of real active products:

```
GET https://yourdomain.com/api/merchant/feed
```

The feed includes only items with a real `name`, `image` and valid `price`
(`g:id`, `g:title`, `g:link`, `g:image_link`, `g:description`, `g:price`,
`g:availability`, `g:condition`, and `g:sku`/`g:brand`/`g:product_type` only
when present). No ratings, GTINs or prices are invented.

To connect:

1. Create your Merchant Center account at https://www.google.com/retail/.
2. Set up the **Products → All products → Primary feed**.
3. Choose delivery method **Scheduled fetch** and supply the feed URL above
   (or download the XML and upload it as a file feed). Recommended: fetch daily.
4. Add a `g:tax` / `g:shipping` setting in Merchant Center (YourMarket does not
   emit tax/shipping per item; they should be configured in Merchant Center).
5. Keep the `NEXT_PUBLIC_SITE_URL` matching so `g:link` lands on canonical pages.
6. Optional: review the **Diagnostics** tab for item warnings (missing GTINs are
   common for small stores and can be suppressed if no real GTINs exist).

---

## 4. Security notes

- No Supabase **service-role** key is used anywhere for the feed or sitemap. All
  reads use the public anon client and rely on RLS (products/categories are
  publicly readable; private tables stay locked).
- The merchant feed endpoint never exposes secrets.

> Customer-facing search and product listings show only YourMarket's own
> products (from Supabase). The external / affiliate product search feature has
> been removed.
