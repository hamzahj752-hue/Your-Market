import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createServerClient(token: string) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function extractToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

const ALLOWED_STATUSES = ['Delivered', 'Completed', 'Processing', 'Shipped'];

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Sign in to submit a review.' }, { status: 401 });
  }

  const supabase = createServerClient(token);

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Session could not be verified.' }, { status: 401 });
  }

  let body: {
    product_id?: string;
    rating?: number;
    title?: string;
    content?: string;
    author_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { product_id, rating, title, content, author_name } = body;

  if (!product_id || typeof product_id !== 'string') {
    return NextResponse.json({ error: 'product_id is required.' }, { status: 400 });
  }
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Review text is required.' }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json(
      { error: 'Review must be 1000 characters or fewer.' },
      { status: 400 }
    );
  }

  // Server-side purchase eligibility
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ALLOWED_STATUSES);

  if (orderErr) {
    return NextResponse.json({ error: 'Unable to verify eligibility.' }, { status: 500 });
  }

  const orderIds = (orders ?? []).map((o: { id: string }) => o.id);

  if (orderIds.length === 0) {
    return NextResponse.json(
      { error: 'Only customers who purchased this product can review it.' },
      { status: 403 }
    );
  }

  const { count } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .in('order_id', orderIds)
    .eq('product_id', product_id);

  if (!count || count === 0) {
    return NextResponse.json(
      { error: 'Only customers who purchased this product can review it.' },
      { status: 403 }
    );
  }

  // Insert review — trigger forces pending moderation + verified_purchase = false
  const displayName =
    (typeof author_name === 'string' && author_name.trim()) ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Your Market User';

  const { data: review, error: insertErr } = await supabase
    .from('reviews')
    .insert({
      product_id,
      rating: Math.round(rating),
      title: title?.trim() || null,
      content: content.trim(),
      author_name: displayName,
    })
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json(
        { error: 'You have already reviewed this product.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Unable to submit review.' }, { status: 500 });
  }

  return NextResponse.json({ review }, { status: 201 });
}
