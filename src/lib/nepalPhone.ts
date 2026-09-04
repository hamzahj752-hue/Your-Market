// Nepal mobile phone normalization + validation helpers.
//
// UI stores the local 10-digit mobile (e.g. "9800000000") next to a fixed
// "+977" prefix. For persistence we store a single canonical form:
// "+977XXXXXXXXXX" (e.g. "+9779800000000").
//
// NOTE: A syntactically valid number is NOT a verified/owned number. OTP
// verification is out of scope; callers must never claim the number was
// verified.

export const NEPAL_COUNTRY_CODE = '+977';
export const NEPAL_MOBILE_LENGTH = 10;
export const VALID_MOBILE_PREFIXES = ['98', '97'];

// Strip formatting separators and an optional +977 / 977 country prefix, then
// return the 10-digit local mobile if it is a valid Nepal mobile number, or
// null otherwise. Accepts: "9800000000", "+977-98-0000-0000", "977 98 0000
// 0000", "98 0000 0000", "9800000000". Rejects foreign numbers, landlines,
// letters, and lengths that do not normalise to exactly 10 local digits.
export function normalizeNepalMobile(
  value: string | null | undefined
): { local: string; canonical: string } | null {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return null;

  // Remove helper formatting and whitespace but keep digits + plus.
  const compact = raw.replace(/[\s\-()]/g, '');

  let digits = compact;
  if (compact.startsWith('+977')) {
    digits = compact.slice(4);
  } else if (compact.startsWith('977')) {
    digits = compact.slice(3);
  } else if (compact.startsWith('+')) {
    // Any other country code (e.g. +91, +1) is not a Nepal number.
    return null;
  }

  if (!/^\d{1,15}$/.test(digits)) return null;
  if (digits.length !== NEPAL_MOBILE_LENGTH) return null;
  if (!VALID_MOBILE_PREFIXES.some((p) => digits.startsWith(p))) return null;

  return {
    local: digits,
    canonical: `${NEPAL_COUNTRY_CODE}${digits}`,
  };
}

export function isValidNepalMobile(value: string | null | undefined): boolean {
  return normalizeNepalMobile(value) !== null;
}

// Legacy entries in the DB may already be stored with a "+977" or "977"
// prefix or with the local 10 digits only. Best-effort upgrade to canonical
// form when the value maps to a valid Nepal mobile, otherwise return the
// original string unchanged (do not silently rewrite foreign/high-risk data).
export function toCanonicalNepalMobile(value: string | null | undefined): string | null {
  const normalized = normalizeNepalMobile(value);
  return normalized ? normalized.canonical : (value ?? null);
}
