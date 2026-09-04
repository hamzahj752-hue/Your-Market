'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  content: string;
  author_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  verified_purchase?: boolean;
  is_edited?: boolean;
  moderation_status?: string;
}

interface ReviewImage {
  id: string;
  review_id: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  signed_url: string;
}

interface Props {
  productId: string;
  productName: string;
}

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function ReviewsSection({ productId, productName }: Props) {
  const router = useRouter();

  // Reviews data
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, ReviewImage[]>>({});

  // Current user
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Purchase eligibility
  const [hasPurchased, setHasPurchased] = useState<boolean | null>(null);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);

  // Submit form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  // Edit form
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Photos
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [editPhotos, setEditPhotos] = useState<File[]>([]);
  const [existingEditPhotos, setExistingEditPhotos] = useState<ReviewImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  /* ─── Computed ─────────────────────────────────────────────────────────── */

  const approvedReviews = reviews.filter((r) => r.moderation_status === 'approved');
  const avgRating = approvedReviews.length
    ? (approvedReviews.reduce((s, r) => s + r.rating, 0) / approvedReviews.length).toFixed(1)
    : null;

  const ratingDist = React.useMemo(() => {
    const d = [0, 0, 0, 0, 0];
    for (const r of approvedReviews) {
      if (r.rating >= 1 && r.rating <= 5) d[r.rating - 1]++;
    }
    return d;
  }, [approvedReviews]);

  /* ─── Data Loading ─────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setReviewsLoading(true);
      setReviewsError('');

      const { data: userData } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = userData.user;
      setCurrentUser(
        user
          ? {
              id: user.id,
              name:
                user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your Market User',
              email: user.email || '',
            }
          : null
      );
      setAuthChecking(false);

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        setReviewsError('Unable to load reviews.');
        setReviewsLoading(false);
        return;
      }

      const list = (data ?? []) as Review[];
      setReviews(list);

      // Find user's existing review
      if (user) {
        const existing = list.find((r) => r.user_id === user.id);
        if (existing) setUserReview(existing);
      }

      // Load photo URLs for reviews that have images
      if (list.length > 0) {
        const ids = list.map((r) => r.id);
        const { data: imgData } = await supabase
          .from('review_images')
          .select('id, review_id, storage_path, mime_type, file_size')
          .in('review_id', ids);

        if (cancelled) return;
        if (imgData && imgData.length > 0) {
          const byReview: Record<string, ReviewImage[]> = {};
          for (const img of imgData) {
            const { data: urlData } = await supabase.storage
              .from('review-images')
              .createSignedUrl(img.storage_path, 60 * 60 * 24);

            if (urlData?.signedUrl) {
              const entry: ReviewImage = {
                ...img,
                signed_url: urlData.signedUrl,
              };
              if (!byReview[img.review_id]) byReview[img.review_id] = [];
              byReview[img.review_id].push(entry);
            }
          }
          if (!cancelled) setPhotoUrls(byReview);
        }
      }

      setReviewsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  /* ─── Purchase Eligibility ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!currentUser) {
      setEligibilityChecked(true);
      return;
    }
    let cancelled = false;

    async function check() {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', currentUser!.id)
        .in('status', ['Delivered', 'Completed', 'Processing', 'Shipped']);

      if (cancelled) return;
      const orderIds = (orders ?? []).map((o: { id: string }) => o.id);

      if (orderIds.length === 0) {
        setHasPurchased(false);
        setEligibilityChecked(true);
        return;
      }

      const { count } = await supabase
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .in('order_id', orderIds)
        .eq('product_id', productId);

      if (!cancelled) {
        setHasPurchased(!!count && count > 0);
        setEligibilityChecked(true);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [currentUser, productId]);

  /* ─── Photo Helpers ────────────────────────────────────────────────────── */

  function validateFiles(files: FileList | File[]): File[] {
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(f.type)) continue;
      if (f.size > MAX_FILE_SIZE) continue;
      valid.push(f);
    }
    return valid;
  }

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const valid = validateFiles(e.target.files);
    setPendingPhotos((prev) => [...prev, ...valid].slice(0, MAX_PHOTOS));
    e.target.value = '';
  }, []);

  const handleEditPhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const valid = validateFiles(e.target.files);
      setEditPhotos((prev) => [...prev, ...valid].slice(0, MAX_PHOTOS - existingEditPhotos.length));
      e.target.value = '';
    },
    [existingEditPhotos.length]
  );

  function removePendingPhoto(idx: number) {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeEditPhoto(idx: number) {
    setEditPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function removeExistingPhoto(photo: ReviewImage) {
    setExistingEditPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function uploadPhotos(reviewId: string, files: File[]): Promise<boolean> {
    for (const file of files) {
      const fd = new FormData();
      fd.append('review_id', reviewId);
      fd.append('file', file);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/reviews/photos', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      if (!res.ok) {
        return false;
      }
    }
    return true;
  }

  /* ─── Submit Review ────────────────────────────────────────────────────── */

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewFormError('');
    setReviewSuccess('');

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      setReviewFormError('Please select a star rating (1-5).');
      return;
    }
    if (!reviewContent.trim()) {
      setReviewFormError('Please write a short review.');
      return;
    }

    setReviewSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setReviewFormError('Please sign in to submit a review.');
        setReviewSubmitting(false);
        return;
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          product_id: productId,
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          content: reviewContent.trim(),
          author_name: currentUser?.name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setReviewFormError('Please sign in to submit a review.');
          router.push('/account');
        } else if (res.status === 403) {
          setReviewFormError(
            data.error || 'Only customers who purchased this product can review it.'
          );
        } else if (res.status === 409) {
          setReviewFormError('You have already reviewed this product.');
        } else {
          setReviewFormError(data.error || 'Unable to submit review. Please try again.');
        }
        setReviewSubmitting(false);
        return;
      }

      const newReview = data.review as Review;
      setReviews((prev) => [newReview, ...prev]);
      setUserReview(newReview);

      // Upload photos
      if (pendingPhotos.length > 0) {
        const ok = await uploadPhotos(newReview.id, pendingPhotos);
        if (!ok) {
          setReviewSuccess(
            'Review submitted! Some photos could not be uploaded. Please try editing your review to add them.'
          );
        } else {
          setReviewSuccess(
            'Thank you! Your review has been submitted and will appear once approved.'
          );
        }
      } else {
        setReviewSuccess(
          'Thank you! Your review has been submitted and will appear once approved.'
        );
      }

      setReviewRating(0);
      setReviewTitle('');
      setReviewContent('');
      setPendingPhotos([]);
    } catch {
      setReviewFormError('Unable to submit review. Please try again.');
    }
    setReviewSubmitting(false);
  }

  /* ─── Edit Review ──────────────────────────────────────────────────────── */

  function startEdit(review: Review) {
    setEditingReviewId(review.id);
    setEditRating(review.rating);
    setEditTitle(review.title || '');
    setEditContent(review.content);
    setEditError('');
    setEditPhotos([]);
    setExistingEditPhotos(photoUrls[review.id] || []);
  }

  function cancelEdit() {
    setEditingReviewId(null);
    setEditError('');
    setEditPhotos([]);
    setExistingEditPhotos([]);
  }

  async function saveEdit(reviewId: string) {
    setEditError('');
    if (!editRating || editRating < 1 || editRating > 5) {
      setEditError('Please select a star rating (1-5).');
      return;
    }
    if (!editContent.trim()) {
      setEditError('Please write a short review.');
      return;
    }
    setEditSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          rating: editRating,
          title: editTitle.trim() || undefined,
          content: editContent.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Unable to update review.');
        setEditSaving(false);
        return;
      }

      // Upload new edit photos
      if (editPhotos.length > 0) {
        await uploadPhotos(reviewId, editPhotos);
      }

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                rating: editRating,
                title: editTitle.trim() || null,
                content: editContent.trim(),
                is_edited: true,
                moderation_status: 'pending',
                updated_at: new Date().toISOString(),
              }
            : r
        )
      );

      setUserReview((prev) =>
        prev && prev.id === reviewId
          ? {
              ...prev,
              rating: editRating,
              title: editTitle.trim() || null,
              content: editContent.trim(),
              is_edited: true,
              moderation_status: 'pending',
            }
          : prev
      );

      setEditingReviewId(null);
      setEditPhotos([]);
      setExistingEditPhotos([]);
    } catch {
      setEditError('Unable to update review.');
    }
    setEditSaving(false);
  }

  /* ─── Delete Review ────────────────────────────────────────────────────── */

  async function deleteReview(review: Review) {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        setReviewsError('Unable to delete review.');
        return;
      }

      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      setUserReview((prev) => (prev && prev.id === review.id ? null : prev));
      setPhotoUrls((prev) => {
        const next = { ...prev };
        delete next[review.id];
        return next;
      });
    } catch {
      setReviewsError('Unable to delete review.');
    }
  }

  /* ─── Lightbox ─────────────────────────────────────────────────────────── */

  function openLightbox(images: string[], index: number) {
    setLightboxImages(images);
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxImages([]);
    setLightboxIndex(0);
  }

  /* ─── Star SVG path ────────────────────────────────────────────────────── */

  const STAR_PATH =
    'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z';

  function StarSvg({ filled, size = 16 }: { filled: boolean; size?: number }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? '#F59E0B' : 'none'}
        stroke={filled ? '#F59E0B' : '#CBD5E1'}
        strokeWidth="1.5"
        className="flex-shrink-0"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={STAR_PATH} />
      </svg>
    );
  }

  function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
    return (
      <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <StarSvg key={i} filled={i <= Math.round(rating)} size={size} />
        ))}
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <section className="mt-10">
      <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-800">Ratings &amp; Reviews</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {approvedReviews.length} {approvedReviews.length === 1 ? 'review' : 'reviews'} for{' '}
              {productName}
            </p>
          </div>
          {avgRating && (
            <div className="flex items-center gap-2">
              <StarDisplay rating={Number(avgRating)} size={20} />
              <b className="text-lg">{avgRating}</b>
              <span className="text-muted-foreground text-sm">average</span>
            </div>
          )}
        </div>

        {/* Error */}
        {reviewsError && (
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm font-600 mb-5">
            <Icon name="ExclamationTriangleIcon" size={18} />
            <span>{reviewsError}</span>
          </div>
        )}

        {reviewsLoading ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Loading reviews...</div>
        ) : approvedReviews.length === 0 ? (
          /* ── Empty State ── */
          <div className="py-10 text-center border border-dashed border-border rounded-2xl">
            <Icon
              name="ChatBubbleLeftRightIcon"
              size={40}
              className="mx-auto mb-3 text-muted-foreground/40"
            />
            <h3 className="font-800 text-lg mb-1">No reviews yet</h3>
            <p className="text-sm text-muted-foreground">
              Be the first to share your experience with this product.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[220px_1fr] gap-8">
            {/* ── Rating Summary ── */}
            <div>
              <div className="text-center lg:text-left mb-5">
                <p className="text-4xl font-900">{avgRating}</p>
                <div className="flex items-center justify-center lg:justify-start gap-1 mt-1">
                  <StarDisplay rating={Number(avgRating)} size={18} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {approvedReviews.length} {approvedReviews.length === 1 ? 'review' : 'reviews'}
                </p>
              </div>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingDist[star - 1];
                  const pct = approvedReviews.length ? (count / approvedReviews.length) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-right font-600">{star}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="#F59E0B"
                        className="flex-shrink-0"
                      >
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Review List ── */}
            <ul className="space-y-5">
              {reviews.map((review) => {
                const photos = photoUrls[review.id] || [];
                const isOwner = currentUser && currentUser.id === review.user_id;
                const isEditing = editingReviewId === review.id;

                return (
                  <li key={review.id} className="border border-border rounded-2xl p-4 sm:p-5">
                    {isEditing ? (
                      /* ── Edit Mode ── */
                      <div className="space-y-3 border border-primary/30 rounded-2xl p-4 bg-primary/5">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              aria-label={`${star} star`}
                              onClick={() => setEditRating(star)}
                              className="p-1 focus:outline-none"
                            >
                              <StarSvg filled={star <= editRating} size={22} />
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Review title (optional)"
                          maxLength={120}
                          className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          maxLength={1000}
                          className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />

                        {/* Existing photos */}
                        {existingEditPhotos.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {existingEditPhotos.map((p) => (
                              <div
                                key={p.id}
                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-border"
                              >
                                <AppImage
                                  src={p.signed_url}
                                  alt="Review photo"
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeExistingPhoto(p)}
                                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                                  aria-label="Remove photo"
                                >
                                  <Icon name="XMarkIcon" size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* New edit photos */}
                        {editPhotos.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {editPhotos.map((f, idx) => (
                              <div
                                key={idx}
                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-border"
                              >
                                <img
                                  src={URL.createObjectURL(f)}
                                  alt="New photo"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeEditPhoto(idx)}
                                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                                  aria-label="Remove photo"
                                >
                                  <Icon name="XMarkIcon" size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {existingEditPhotos.length + editPhotos.length < MAX_PHOTOS && (
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 text-xs font-600 text-primary hover:underline"
                          >
                            <Icon name="CameraIcon" size={14} />
                            Add Photos ({existingEditPhotos.length + editPhotos.length}/{MAX_PHOTOS}
                            )
                          </button>
                        )}
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handleEditPhotoSelect}
                          className="hidden"
                        />

                        {editError && <p className="text-sm text-red-500 font-600">{editError}</p>}
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={editSaving}
                            className="flex-1 py-2.5 rounded-xl bg-muted font-700 text-sm disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(review.id)}
                            disabled={editSaving}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-700 text-sm disabled:opacity-50"
                          >
                            {editSaving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Display Mode ── */
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-800 text-primary uppercase">
                                {review.author_name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-800 text-sm">
                                  {review.author_name || 'Anonymous'}
                                </p>
                                {review.verified_purchase && (
                                  <span className="text-[10px] font-800 bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <Icon name="CheckBadgeIcon" size={11} />
                                    Verified Purchase
                                  </span>
                                )}
                                {review.is_edited && (
                                  <span className="text-[10px] font-600 text-muted-foreground">
                                    (edited)
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(review.created_at).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                          <StarDisplay rating={review.rating} />
                        </div>

                        {review.title && <h4 className="font-800 mt-3">{review.title}</h4>}
                        <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
                          {review.content}
                        </p>

                        {/* Review Photos */}
                        {photos.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {photos.map((photo, idx) => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() =>
                                  openLightbox(
                                    photos.map((p) => p.signed_url),
                                    idx
                                  )
                                }
                                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-border hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                                aria-label={`View review photo ${idx + 1}`}
                              >
                                <AppImage
                                  src={photo.signed_url}
                                  alt={`${review.author_name || 'Customer'} review photo ${idx + 1}`}
                                  fill
                                  sizes="80px"
                                  className="object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Owner Actions */}
                        {isOwner && (
                          <div className="mt-3 flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => startEdit(review)}
                              className="text-xs font-700 text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <Icon name="PencilIcon" size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteReview(review)}
                              className="text-xs font-700 text-red-600 hover:underline inline-flex items-center gap-1"
                            >
                              <Icon name="TrashIcon" size={14} />
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── Write a Review ── */}
        <div className="mt-8 border-t border-border pt-8">
          <h3 className="text-lg font-800 mb-4">Write a Review</h3>

          {authChecking ? (
            <p className="text-sm text-muted-foreground">Checking your account...</p>
          ) : !currentUser ? (
            /* ── Guest ── */
            <div className="p-5 rounded-2xl bg-muted/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Icon name="LockClosedIcon" size={22} className="text-muted-foreground" />
                <div>
                  <p className="font-700 text-sm">Sign in to write a review</p>
                  <p className="text-xs text-muted-foreground">
                    Only verified shoppers can submit reviews.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/account')}
                className="btn-primary whitespace-nowrap"
              >
                Sign In
              </button>
            </div>
          ) : userReview ? (
            /* ── Already reviewed ── */
            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3">
                <Icon name="CheckCircleIcon" size={22} className="text-primary" />
                <div>
                  <p className="font-700 text-sm">You&apos;ve already reviewed this product</p>
                  <p className="text-xs text-muted-foreground">
                    You can edit or delete your existing review above.
                  </p>
                </div>
              </div>
            </div>
          ) : !eligibilityChecked ? (
            <p className="text-sm text-muted-foreground">Checking purchase eligibility...</p>
          ) : hasPurchased === false ? (
            /* ── Not a purchaser ── */
            <div className="p-5 rounded-2xl bg-muted/60 flex items-center gap-3">
              <Icon name="InformationCircleIcon" size={22} className="text-muted-foreground" />
              <div>
                <p className="font-700 text-sm">Purchase required</p>
                <p className="text-xs text-muted-foreground">
                  Only customers who purchased this product can review it.
                </p>
              </div>
            </div>
          ) : (
            /* ── Review Form ── */
            <form onSubmit={handleSubmitReview} className="max-w-2xl space-y-4">
              {reviewSuccess && (
                <div className="flex items-start gap-3 p-4 rounded-2xl border border-green-200 bg-green-50 text-green-700 text-sm font-600">
                  <Icon name="CheckCircleIcon" size={18} />
                  <span>{reviewSuccess}</span>
                </div>
              )}
              {reviewFormError && (
                <div className="flex items-start gap-3 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm font-600">
                  <Icon name="ExclamationTriangleIcon" size={18} />
                  <span>{reviewFormError}</span>
                </div>
              )}

              {/* Star Rating */}
              <div>
                <label className="block text-sm font-700 mb-2">
                  Your Rating <span className="text-accent">*</span>
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      onClick={() => setReviewRating(star)}
                      className="p-1 focus:outline-none"
                    >
                      <StarSvg filled={star <= reviewRating} size={26} />
                    </button>
                  ))}
                </div>
                {reviewRating > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewRating]}
                  </p>
                )}
              </div>

              {/* Title */}
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Review title (optional)"
                maxLength={120}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              {/* Content */}
              <textarea
                required
                value={reviewContent}
                onChange={(e) => setReviewContent(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={4}
                maxLength={1000}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />

              {/* Photo Upload */}
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pendingPhotos.length >= MAX_PHOTOS}
                  className="inline-flex items-center gap-1.5 text-sm font-600 text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="CameraIcon" size={16} />
                  {pendingPhotos.length === 0
                    ? `Add Photos (optional, max ${MAX_PHOTOS})`
                    : `${pendingPhotos.length}/${MAX_PHOTOS} photos`}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                {pendingPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {pendingPhotos.map((f, idx) => (
                      <div
                        key={idx}
                        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-border"
                      >
                        <img
                          src={URL.createObjectURL(f)}
                          alt={`Upload ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePendingPhoto(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                          aria-label="Remove photo"
                        >
                          <Icon name="XMarkIcon" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {reviewContent.length}/1000 characters
                </p>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="btn-primary px-6 py-3 disabled:opacity-50"
                >
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  {!reviewSubmitting && <Icon name="PaperAirplaneIcon" size={16} />}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ── Photo Lightbox ── */}
      {lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-label="Review photo viewer"
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={24} />
          </button>

          {lightboxImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => (i > 0 ? i - 1 : lightboxImages.length - 1));
              }}
              className="absolute left-2 sm:left-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
              aria-label="Previous photo"
            >
              <Icon name="ChevronLeftIcon" size={24} />
            </button>
          )}

          <div
            className="relative max-w-[90vw] max-h-[85vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImages[lightboxIndex]}
              alt={`Review photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>

          {lightboxImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i < lightboxImages.length - 1 ? i + 1 : 0));
                }}
                className="absolute right-2 sm:right-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
                aria-label="Next photo"
              >
                <Icon name="ChevronRightIcon" size={24} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5">
                {lightboxImages.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === lightboxIndex ? 'bg-white' : 'bg-white/40'
                    }`}
                    aria-label={`Go to photo ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
