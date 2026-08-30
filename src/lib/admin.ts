'use client';

import { supabase } from '@/lib/supabase';

export interface AdminCheckResult {
  authorized: boolean;
  userEmail?: string | null;
  message?: string;
}

/**
 * Verifies the current user is an admin.
 *
 * The canonical check runs on the SERVER via /api/admin/check (which validates
 * the user's token and evaluates the database's SECURITY DEFINER is_admin()
 * RPC), so authorization is enforced server-side, not by client state. If the
 * server endpoint is unavailable (e.g. offline), it falls back to the direct
 * is_admin() RPC — which is itself a server-side database check. Returns
 * `{ authorized: false, message }` when the user is not signed in or not an
 * admin so admin pages can render an access-denied screen.
 */
export async function requireAdmin(): Promise<AdminCheckResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      message: 'Please login with your admin account.',
    };
  }

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  try {
    const res = await fetch('/api/admin/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (res.ok) {
      const body = (await res.json()) as AdminCheckResult;
      return {
        authorized: body.authorized,
        userEmail: body.userEmail ?? user.email ?? null,
        message: body.message,
      };
    }

    if (res.status === 401) {
      return { authorized: false, message: 'Please login with your admin account.' };
    }
    if (res.status === 403) {
      return { authorized: false, message: 'Access denied. Admin account required.' };
    }
    // Surface 500/server errors as an explicit failure instead of silently
    // granting access; do not fall through to authorized.
    return { authorized: false, message: 'Unable to verify admin access. Please try again.' };
  } catch {
    // Endpoint unreachable — fall back to the direct server-side RPC. This is
    // still a database-enforced check (never a client-side role claim).
    const { data, error } = await supabase.rpc('is_admin');
    if (error || !data) {
      return { authorized: false, message: 'Access denied. Admin account required.' };
    }
    return { authorized: true, userEmail: user.email ?? null };
  }
}
