import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * eSewa (Nepal) payment — SERVER-ONLY module.
 *
 * Secret credentials (merchant secret key) are read from server environment
 * variables ONLY. They are NEVER exposed to the browser, stored in a public
 * Supabase table, or shipped in the client bundle. The merchant/product code
 * is public-ish (used in the eSewa form) but is still read from the server so
 * the browser never needs to know the gateway secret.
 *
 * eSewa gateway (v2):
 *   Payment form : <base>/api/epay/main/v2/form
 *   Status API   : <base>/api/epay/transaction/status/
 *   Test base    : rc-epay.esewa.com.np (pay: rc-pay.esewa.com.np)
 *   Prod base    : epay.esewa.com.np    (pay: pay.esewa.com.np)
 *
 * The integration is gated on real credentials: if ESEWA_MERCHANT_ID or
 * ESEWA_SECRET_KEY are absent, `esewaConfig().configured === false` and no
 * real transaction can be started. This prevents fake payment success.
 */

export interface EsewaServerConfig {
  productCode: string; // merchant/product code (public merchant identifier)
  secretKey: string; // server-only secret — never exposed
  environment: 'test' | 'production';
  configured: boolean;
  displayName: 'eSewa';
}

export function esewaServerConfig(): EsewaServerConfig {
  const productCode = (
    process.env.ESEWA_MERCHANT_ID ||
    process.env.ESEWA_MERCHANT_CODE ||
    ''
  ).trim();
  const secretKey = (process.env.ESEWA_SECRET_KEY || '').trim();
  const environment = process.env.ESEWA_ENVIRONMENT === 'production' ? 'production' : 'test';
  const configured = Boolean(productCode && secretKey);
  return { productCode, secretKey, environment, configured, displayName: 'eSewa' };
}

export function esewaFormBase(cfg: EsewaServerConfig): string {
  return cfg.environment === 'production'
    ? 'https://epay.esewa.com.np'
    : 'https://rc-epay.esewa.com.np';
}

export function esewaStatusBase(cfg: EsewaServerConfig): string {
  return cfg.environment === 'production'
    ? 'https://pay.esewa.com.np'
    : 'https://rc-pay.esewa.com.np';
}

/** Signs the canonical eSewa field string with HMAC-SHA256 (base64). */
export function esewaSign(secretKey: string, fieldString: string): string {
  return crypto.createHmac('sha256', secretKey).update(fieldString).digest('base64');
}

export interface EsewaInitiateParams {
  totalAmount: number; // includes tax + service + delivery (final charge)
  taxAmount: number;
  productServiceCharge: number;
  productDeliveryCharge: number;
  transactionUuid: string; // stable unique reference tied to the order
  productCode: string;
  successUrl: string;
  failureUrl: string;
}

/** Builds the signed query parameters for the eSewa payment form. */
export function buildEsewaFormData(
  cfg: EsewaServerConfig,
  p: EsewaInitiateParams
): Record<string, string> {
  const fields = ['total_amount', 'transaction_uuid', 'product_code'];
  const data: Record<string, string> = {
    amount: String(p.totalAmount),
    tax_amount: String(p.taxAmount),
    total_amount: String(p.totalAmount),
    transaction_uuid: p.transactionUuid,
    product_code: p.productCode,
    product_service_charge: String(p.productServiceCharge || 0),
    product_delivery_charge: String(p.productDeliveryCharge || 0),
    success_url: p.successUrl,
    failure_url: p.failureUrl,
    signed_field_names: fields.join(','),
  };
  const fieldString = fields.map((f) => data[f]).join(',');
  data.signature = esewaSign(cfg.secretKey, fieldString);
  return data;
}

export interface EsewaVerifyParams {
  totalAmount: number;
  transactionUuid: string;
  productCode: string;
  transactionDate: string; // from eSewa status response
}

/**
 * Verifies a transaction status with eSewa. Returns the raw JSON when the
 * HTTP call succeeds (caller checks `resp.status === 'COMPLETE'`), or throws
 * on transport/network failure so the caller can treat it as an unverified
 * transaction.
 */
export async function esewaVerifyStatus(
  cfg: EsewaServerConfig,
  p: EsewaVerifyParams
): Promise<Record<string, unknown>> {
  const fields = ['total_amount', 'transaction_uuid', 'product_code', 'transaction_date'];
  const fieldString = [p.totalAmount, p.transactionUuid, p.productCode, p.transactionDate].join(
    ','
  );
  const signature = esewaSign(cfg.secretKey, fieldString);

  const url = `${esewaStatusBase(cfg)}/api/epay/transaction/status/`;
  const body = new URLSearchParams({
    product_code: p.productCode,
    total_amount: String(p.totalAmount),
    transaction_uuid: p.transactionUuid,
    signed_field_names: fields.join(','),
    signature,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`eSewa status API returned HTTP ${res.status}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Convenience: builds a server-side admin client using the anon key + a bearer
 * JWT (matching the project's existing server-route pattern) or, when no JWT is
 * provided, the service role is NOT used. Callers pass the authenticated user's
 * token so RLS still applies.
 */
export function esewaSupabase(anonKey: string, jwt?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const headers: Record<string, string> = { apikey: anonKey };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  return createClient(url, anonKey, { global: { headers } });
}
