'use client';

import { supabase } from '@/lib/supabase';

export const HOMEPAGE_BUCKET = 'homepage-images';

export async function uploadHomepageImage(
  file: File,
  label: string
): Promise<{ url: string } | { error: string }> {
  const allowed = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i;
  if (!allowed.test(file.type)) {
    return { error: 'Please choose a PNG, JPG, GIF, WEBP or SVG image.' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Image must be 5MB or smaller.' };
  }
  const ext =
    (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${label}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(HOMEPAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (uploadError) {
    return { error: uploadError.message || 'Unable to upload image.' };
  }
  const url = supabase.storage.from(HOMEPAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  return { url };
}
