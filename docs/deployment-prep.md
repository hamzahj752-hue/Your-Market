# YourMarket — Deployment & Custom Domain Preparation

This document is a **guide only** — do **not** deploy, configure DNS, or modify a domain
automatically. All steps here are manual operator actions.

The project is a Next.js 15 App Router app. The scaffold ships with `@netlify/plugin-nextjs`
and was built on **Netlify** (Rocket.new). Netlify is the primary target below; Vercel is given
as the common alternative.

---

## 1. Required production environment variables

Set these in the hosting provider's environment. **Never commit real values.** Use the anon
key (public/browser-safe) — never the service-role key.

| Variable | Purpose | Notes |
| -------- | ------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser + server reads | Public; never the service-role key |
| `NEXT_PUBLIC_SITE_URL` | Canonical production origin | e.g. `https://yourdomain.com` — drives `metadataBase`, `sitemap.xml`, `robots.txt`, canonical URLs |

Also see `.env.example` for placeholders.

> Do **not** set the Supabase service-role key or any payment/API secret as a
> `NEXT_PUBLIC_*` variable, and do not expose them to the browser bundle.

## 2. Supabase Dashboard manual configuration

These must be set in the Supabase Dashboard (Auth → URL Configuration):

- **Site URL**: your production origin, e.g. `https://yourdomain.com`.
- **Redirect URLs (Additional)**: add `https://yourdomain.com/**` and the local dev origins
  you use (`http://localhost:4028/**`).
- **Email → Redirect URLs**: for password-reset / email-confirmation callbacks, ensure
  `https://yourdomain.com/account/reset-password` is reachable (it is resolved from the
  current origin; update the Site/Redirect URLs after the domain is live).
- **Storage / Public URLs**: product/category images are served from Supabase Storage; no
  change is needed beyond confirming the production origin is allowed for any redirected
  media.

No new Supabase project is required. Do not reset or push schema.

## 3. Build command & output

```bash
npm install
npm run build        # outputs .next
```

Expected: `next build` completes successfully. `next.config.mjs` enforces TypeScript and
ESLint during the build (the `ignoreBuildErrors`/`ignoreDuringBuilds` flags were removed in
Phase 9), so `tsc`/lint errors fail the build rather than being hidden.

- **Netlify**: connect repo → build command `npm run build`, publish directory `.next`
  (Netlify's Next.js runtime handles it via `@netlify/plugin-nextjs`).
- **Vercel**: framework preset `Next.js` auto-detects the build command and output.

## 4. Custom domain

Identify the intended platform (Netlify primary). Do **not** configure DNS yourself.

1. **Add the custom domain** on the hosting platform (Netlify: Site settings → Domain
   management → Add custom domain).
2. **DNS records** (typical):
   - `A` record → the host's IP (Netlify/Load Balancer), **or**
   - `CNAME` record → the platform host (e.g. `yourdomain.netlify.app`) for the `www`
     subdomain, plus an apex alias record your provider supports.
3. **HTTPS / certificates** — the platform provisions a TLS certificate automatically
   (Let's Encrypt managed).

### After the domain is active

4. **Supabase Auth Site URL** → set to `https://yourdomain.com`.
5. **Supabase Redirect URLs** → add `https://yourdomain.com/**` (keep `/**` wide open for
   the SPA auth routes).
6. **`NEXT_PUBLIC_SITE_URL`** → set to `https://yourdomain.com` in the hosting environment.
7. **Rebuild / redeploy** so `metadataBase`, `sitemap.xml`, `robots.txt`, and canonical URLs
   use the new domain, then re-run the production checklist.

Replace `https://yourdomain.com` with the real domain once it is decided.

---

## Not covered here (see separate docs / phases)

- Real online payment gateway integration — **not implemented**; COD is the live method.
- Order-placement idempotency key (cross-request) — Phase 8/9 note: recommended before heavy
  traffic (see the storefront Phase 9 report).
- Platform rate limiting — rely on Supabase Auth rate limiting and the hosting provider;
  the app does not ship an in-memory limiter.
