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

// ─── PATCH: Edit own review ───────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await params;
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Sign in to edit your review.' }, { status: 401 });
  }

  const supabase = createServerClient(token);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Session could not be verified.' }, { status: 401 });
  }

  let body: { rating?: number; title?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { rating, title, content } = body;

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

  // Verify ownership, then update (RLS + server check)
  const { data: existing, error: fetchErr } = await supabase
    .from('reviews')
    .select('id, user_id')
    .eq('id', reviewId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'You can only edit your own review.' }, { status: 403 });
  }

  const { data: updated, error: updateErr } = await supabase
    .from('reviews')
    .update({
      rating: Math.round(rating),
      title: title?.trim() || null,
      content: content.trim(),
      is_edited: true,
      moderation_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: 'Unable to update review.' }, { status: 500 });
  }

  return NextResponse.json({ review: updated });
}

// ─── DELETE: Remove own review ────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await params;
  const token = extractToken(_req);
  if (!token) {
    return NextResponse.json({ error: 'Sign in to delete your review.' }, { status: 401 });
  }

  const supabase = createServerClient(token);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Session could not be verified.' }, { status: 401 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('reviews')
    .select('id, user_id')
    .eq('id', reviewId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'You can only delete your own review.' }, { status: 403 });
  }

  // Delete review images from storage first
  const { data: images } = await supabase
    .from('review_images')
    .select('storage_path')
    .eq('review_id', reviewId);

  if (images && images.length > 0) {
    const paths = images.map((img: { storage_path: string }) => img.storage_path);
    await supabase.storage.from('review-images').remove(paths);
  }

  const { error: deleteErr } = await supabase.from('reviews').delete().eq('id', reviewId);

  if (deleteErr) {
    return NextResponse.json({ error: 'Unable to delete review.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
