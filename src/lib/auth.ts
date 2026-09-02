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
