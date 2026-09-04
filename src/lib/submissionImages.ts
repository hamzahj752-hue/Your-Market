'use client';

import { supabase } from '@/lib/supabase';

export const SUBMISSION_BUCKET = 'submission-images';
// Private bucket. No public URLs are used; images are served to the owner and
// admins only, via short-lived signed URLs.
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// UI convenience validation. NOTE: this is UX only and is NOT a security
// boundary. Storage authz (path ownership via auth.uid()) is the real control.
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, and WEBP images are allowed.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Image must be 5MB or smaller.';
  }
  return null;
}

export async function uploadSubmissionImage(
  file: File,
  userId: string
): Promise<{ path: string } | { error: string }> {
  const validationError = validateImageFile(file);
  if (validationError) return { error: validationError };

  const ext =
    (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `submissions/${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SUBMISSION_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    return { error: uploadError.message || 'Unable to upload image.' };
  }

  return { path };
}

export async function deleteSubmissionImage(path: string): Promise<{ error?: string }> {
  const { error } = await supabase.storage.from(SUBMISSION_BUCKET).remove([path]);
  return { error: error?.message };
}

// Generate short-lived signed URLs for display. Signed URLs are scoped by RLS:
// the caller must be the owner or an admin (the DB policies enforce this), so a
// customer can never obtain signed URLs for another customer's images.
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SUBMISSION_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) {
    throw new Error(error?.message || 'Unable to load image.');
  }
  return data.signedUrl;
}

export async function getSignedUrls(paths: string[], expiresIn = 3600): Promise<string[]> {
  const results = await Promise.all(
    paths.map(async (p) => {
      try {
        return await getSignedUrl(p, expiresIn);
      } catch {
        return '';
      }
    })
  );
  return results.filter(Boolean);
}
