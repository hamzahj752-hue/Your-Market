import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side admin authorization gate.
 *
 * The client sends its current Supabase access token in the Authorization
 * header. On the server we construct a Supabase client bound to that token
 * (browser-safe anon key ONLY — never any service-role secret) and evaluate the
 * database's SECURITY DEFINER public.is_admin() RPC. The JWT is verified by
 * Supabase and the admin membership is read from the DB, so a caller cannot
 * forge admin status by editing client state.
 *
 * Returns 200 { authorized } / 401 (no/invalid token) / 403 (not admin).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!token) {
    return NextResponse.json({ authorized: false, message: 'Not signed in.' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { authorized: false, message: 'Server configuration error.' },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { authorized: false, message: 'Session could not be verified.' },
      { status: 401 }
    );
  }

  const { data, error } = await supabase.rpc('is_admin');

  if (error || !data) {
    return NextResponse.json(
      { authorized: false, message: 'Admin account required.' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    authorized: true,
    userEmail: user.email ?? null,
  });
}
