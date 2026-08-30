# Payment Gateway Integration Guide (Future)

This document describes what will be required to add a real online payment
gateway to YourMarket. **No provider has been selected and no credentials exist
yet.** This is guidance only — nothing here is integrated or enabled.

## Current state (Phase 8)

- **Cash on Delivery (COD)** is the only live payment method.
  - Server-validated against `store_settings.cod_enabled`.
  - Orders are created via the `place_order` SECURITY DEFINER RPC.
  - `payment_method = 'cod'`, `payment_status = 'pending'` (cash collected on
    delivery, not online). Payment is never marked `paid` at order time.
- **Online payment** is intentionally **not available**. The checkout shows
  "Online payment coming soon", and `place_order` rejects online methods
  (`card`/`wallet`/`online`/future provider names) with a clear message. No
  order is ever created as falsely "paid" from client input.

## Order payment fields

`orders` already exposes a provider-neutral tracking surface:

| Column | Purpose |
| ------ | ------- |
| `payment_method` | `cod` or a future online method |
| `payment_status` | `pending`, `paid`, `unpaid`, `failed`, `refunded` |
| `payment_provider` | Provider name once selected (e.g. the gateway id) |
| `payment_reference` | Provider transaction / reference id returned by the gateway |
| `paid_at` | Set server-side when an order transitions to `paid` |
| `refunded_at` | Set server-side when an order transitions to `refunded` |
| `payment_failure_reason` | Optional explanation on failure |

A `BEFORE UPDATE` trigger (`orders_sync_payment_fields`) records `paid_at` /
`refunded_at` from the `payment_status` transition, so those timestamps can
never be forged through a client payload.

## What a real integration will need

Prerequisites (do not proceed until the provider is chosen and official
credentials/documentation are available):

1. **Payment initiation** — a server endpoint that takes an order/cart and
   builds a signed initiation request to the provider.
2. **Provider redirect / SDK** — redirecting the customer to the provider or
   rendering the provider's SDK embed. Use the provider's official SDK.
3. **Server-to-server verification** — after the customer returns, verify the
   payment status with the provider API (never trust a browser `success=true` or
   a query parameter).
4. **Signed callback / webhook verification** — verify the provider signature on
   any server callback before trusting it.
5. **Idempotent payment processing** — order placement and any callback handler
   must be idempotent to prevent duplicate orders / duplicate confirmations
   under retries.
6. **Payment reference storage** — store the provider transaction id in
   `orders.payment_reference` and the provider name in `orders.payment_provider`.
7. **Duplicate callback protection** — callbacks must be deduplicated (e.g. by
   provider transaction id + order id).
8. **Failed payment handling** — record `failed` with `payment_failure_reason`;
   do not create a confirmed order for a failed payment.
9. **Refund workflow** — a server/verification path that marks `refunded` and
   sets `refunded_at` (admin-initiated and/or provider refund callback).
10. **Reconciliation** — periodic server-side checks of unsettled orders against
    provider transaction records.

## Security requirements

- All gateway credentials, merchant ids, API keys, and signing secrets live in
  environment variables on the **server only**. Never place them in
  `NEXT_PUBLIC_*` or in any browser bundle.
- All payment state transitions (marking `paid` / `failed` / `refunded`) must
  happen **server-side** via a SECURITY DEFINER function (with
  `SET search_path = public`, minimal `EXECUTE` grants) or an authorized
  admin action. **Never** from browser input.
- Do not store raw card numbers, CVV, or card track data. Prefer the provider's
  hosted/embedded checkout.
- Do not weaken the existing RLS: customers may only read their own orders and
  have no `UPDATE` on `orders`; admins alone can update payment status.

## Nepal providers (not yet selected)

Candidate providers the team may evaluate later include eSewa, Khalti, IME Pay,
and Fonepay. Their actual APIs, signature schemes, sandbox/credential setup and
verification flows differ. Integration should start **only** after:
- the provider is explicitly selected by the project owner, and
- official API documentation and sandbox credentials are obtained.

No test/merchant credentials from public sources should be used.
