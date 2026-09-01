export const DEFAULT_PHONE_COUNTRY = '+977';

export interface NormalizedPhone {
  valid: boolean;
  e164: string;
  display: string;
  error?: string;
}

export function normalizePhoneToE164(input: string): NormalizedPhone {
  const raw = (input || '').trim();
  if (!raw) {
    return { valid: false, e164: '', display: '', error: 'Please enter your phone number.' };
  }

  let digits = raw.replace(/\D/g, '');
  const leadingPlus = raw.startsWith('+') || raw.startsWith('00');

  if (digits.length === 0) {
    return { valid: false, e164: '', display: '', error: 'Please enter a valid phone number.' };
  }

  if (leadingPlus) {
    if (digits.startsWith('00')) {
      digits = digits.replace(/^00/, '');
    }
  } else {
    // No country code provided. If it looks like a Nepal number (10 digits,
    // starting with 9 or 6), assume the default market country code.
    if (/^(9|6)\d{9}$/.test(digits)) {
      digits = DEFAULT_PHONE_COUNTRY.replace('+', '') + digits;
    } else if (/^0(\d{9})$/.test(digits)) {
      digits = DEFAULT_PHONE_COUNTRY.replace('+', '') + digits.replace(/^0/, '');
    }
    // Otherwise assume the number already includes a country code (e.g. leading 1 for US).
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    return {
      valid: false,
      e164: '',
      display: '',
      error: 'Please enter a valid international phone number.',
    };
  }

  const e164 = `+${digits}`;
  const display = formatE164Display(e164);

  return { valid: true, e164, display };
}

function formatE164Display(e164: string): string {
  const d = e164.replace(/\D/g, '');
  // +977XXXXXXXXX -> +977 XX XXX XXXXX
  if (d.startsWith('977') && d.length === 13) {
    return `+977 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  return e164.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d+)/, '$1 $2 $3 $4');
}

export function getSafeOAuthRedirect(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return siteUrl ? `${siteUrl}/auth/callback` : '/auth/callback';
}

export function getSafeAccountRedirect(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/account`;
  }
  return siteUrl ? `${siteUrl}/account` : '/account';
}
