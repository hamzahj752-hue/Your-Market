import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 5;

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

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Sign in to upload photos.' }, { status: 401 });
  }

  const supabase = createServerClient(token);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Session could not be verified.' }, { status: 401 });
  }

  const formData = await req.formData();
  const reviewId = formData.get('review_id') as string | null;
  const file = formData.get('file') as File | null;

  if (!reviewId) {
    return NextResponse.json({ error: 'review_id is required.' }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  }

  // Validate MIME type
  if (!ALLOWED_MIMES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPG, PNG, and WEBP images are allowed.' },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Each image must be 5 MB or smaller.' }, { status: 400 });
  }

  // Verify review ownership
  const { data: review, error: reviewErr } = await supabase
    .from('reviews')
    .select('id, user_id')
    .eq('id', reviewId)
    .single();

  if (reviewErr || !review) {
    return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
  }
  if (review.user_id !== user.id) {
    return NextResponse.json(
      { error: 'You can only add photos to your own review.' },
      { status: 403 }
    );
  }

  // Check existing photo count
  const { count } = await supabase
    .from('review_images')
    .select('id', { count: 'exact', head: true })
    .eq('review_id', reviewId);

  if (count && count >= MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PHOTOS} photos per review.` },
      { status: 400 }
    );
  }

  // Upload to storage
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const storagePath = `${user.id}/${reviewId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from('review-images')
    .upload(storagePath, arrayBuffer, { contentType: file.type });

  if (uploadErr) {
    return NextResponse.json({ error: 'Photo upload failed.' }, { status: 500 });
  }

  // Insert metadata
  const { data: image, error: insertErr } = await supabase
    .from('review_images')
    .insert({
      review_id: reviewId,
      user_id: user.id,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();

  if (insertErr) {
    await supabase.storage.from('review-images').remove([storagePath]);
    return NextResponse.json({ error: 'Unable to save photo record.' }, { status: 500 });
  }

  // Generate a signed URL for immediate display (24h expiry, not stored permanently)
  const { data: signedUrlData } = await supabase.storage
    .from('review-images')
    .createSignedUrl(storagePath, 60 * 60 * 24);

  return NextResponse.json(
    {
      image: { ...image, signed_url: signedUrlData?.signedUrl ?? null },
    },
    { status: 201 }
  );
}
