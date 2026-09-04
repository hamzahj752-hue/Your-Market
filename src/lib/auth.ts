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

// Validate a same-site internal path for safe post-login redirection.
// Accepts only internal paths that:
//  - begin with exactly one "/"
//  - contain no "//", no backslash, no scheme (e.g. https:, javascript:, data:)
// On any invalid/empty/malformed value, returns the safe fallback "/account".
export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = '/account'
): string {
  const raw = typeof value === 'string' ? value.trim() : '';

  if (!raw || !raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  if (raw.includes('://')) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return fallback;
  if (raw.includes('%') || raw.includes('#')) return fallback;

  return raw;
}
