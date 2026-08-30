'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';

interface AdminReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  content: string;
  author_name: string | null;
  created_at: string;
  verified_purchase: boolean;
  is_edited: boolean;
  moderation_status: string;
  reported: boolean;
  reports_count: number;
  product_name?: string;
}

type FilterKey = 'pending' | 'approved' | 'rejected' | 'reported' | 'all';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const FILTER_KEYS: FilterKey[] = ['pending', 'reported', 'approved', 'rejected', 'all'];

function checkModerationStatus(s: string): 'pending' | 'approved' | 'rejected' {
  if (s === 'approved' || s === 'rejected') return s;
  return 'pending';
}

export default function AdminReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [filter, setFilter] = useState<FilterKey>('pending');

  async function loadReviews() {
    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (err) {
      console.error('Admin reviews error:', err);
      setError('Unable to load reviews.');
      setLoading(false);
      return;
    }

    const list = (data ?? []) as unknown as AdminReview[];
    const productIds = Array.from(new Set(list.map((r) => r.product_id)));

    const productMap: Record<string, string> = {};
    if (productIds.length) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      (products ?? []).forEach((p) => {
        productMap[p.id as string] = p.name as string;
      });
    }

    const enriched = list.map((r) => ({
      ...r,
      moderation_status: checkModerationStatus(r.moderation_status),
      reported: Boolean(r.reported),
      reports_count: Number(r.reports_count || 0),
      product_name: productMap[r.product_id] || 'Unknown product',
    }));
    setReviews(enriched);
    setLoading(false);
  }

  useEffect(() => {
    loadReviews();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'reported') return reviews.filter((r) => r.reported);
    if (filter === 'all') return reviews;
    return reviews.filter((r) => r.moderation_status === filter);
  }, [reviews, filter]);

  function countFor(f: FilterKey): number {
    if (f === 'reported') return reviews.filter((r) => r.reported).length;
    if (f === 'all') return reviews.length;
    return reviews.filter((r) => r.moderation_status === f).length;
  }

  const FILTER_LABELS: Record<FilterKey, string> = {
    pending: 'Pending',
    reported: 'Reported',
    approved: 'Approved',
    rejected: 'Rejected',
    all: 'All',
  };

  async function updateStatus(id: string, status: 'approved' | 'rejected' | 'pending') {
    setError('');
    const { error: err } = await supabase
      .from('reviews')
      .update({ moderation_status: status })
      .eq('id', id);

    if (err) {
      setError('Unable to update review.');
      return;
    }

    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, moderation_status: status } : r)));
  }

  async function clearReport(id: string) {
    setError('');
    const { error: err } = await supabase
      .from('reviews')
      .update({ reported: false, reports_count: 0 })
      .eq('id', id);
    if (err) {
      setError('Unable to clear report.');
      return;
    }
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, reported: false, reports_count: 0 } : r))
    );
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this review permanently?')) return;
    const { error: err } = await supabase.from('reviews').delete().eq('id', id);
    if (err) {
      setError('Unable to delete review.');
      return;
    }
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <AdminShell
      title="Review Moderation"
      subtitle="Approve, reject, mark reported or delete customer reviews."
    >
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_KEYS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-700 transition-colors ${
                f === 'reported' && !active
                  ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  : active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {FILTER_LABELS[f]} ({countFor(f)})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 text-red-600 font-600 text-sm flex items-center gap-2">
          <Icon name="ExclamationTriangleIcon" size={18} />
          {error}
        </div>
      )}

      <section className="bg-card rounded-3xl card-shadow p-5 md:p-8">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading reviews...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Icon
              name="ChatBubbleLeftRightIcon"
              size={40}
              className="text-muted-foreground mb-3 mx-auto"
            />
            <p className="font-800">No {FILTER_LABELS[filter].toLowerCase()} reviews</p>
            <p className="text-sm text-muted-foreground mt-1">
              There are no {FILTER_LABELS[filter].toLowerCase()} reviews to show.
            </p>
          </div>
        ) : (
          <ul className="space-y-5">
            {filtered.map((review) => (
              <li key={review.id} className="border border-border rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground font-600 truncate">
                      {review.product_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-800 text-sm">{review.author_name || 'Anonymous'}</span>
                      <span className="text-yellow-500 text-sm">★</span>
                      <span className="text-sm font-700">{review.rating}/5</span>
                      {review.verified_purchase && (
                        <span className="text-[10px] font-800 bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Icon name="CheckBadgeIcon" size={11} />
                          Verified
                        </span>
                      )}
                      {review.reported && (
                        <span className="text-[10px] font-800 bg-red-100 text-red-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Icon name="FlagIcon" size={11} />
                          Reported ({review.reports_count})
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-800 px-2 py-0.5 rounded-full capitalize ${
                          review.moderation_status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : review.moderation_status === 'rejected'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {STATUS_LABELS[review.moderation_status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(review.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {review.moderation_status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateStatus(review.id, 'approved')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white font-700 text-xs hover:bg-green-700"
                        >
                          <Icon name="CheckIcon" size={14} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(review.id, 'rejected')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white font-700 text-xs hover:bg-amber-600"
                        >
                          <Icon name="XCircleIcon" size={14} />
                          Reject
                        </button>
                      </>
                    )}
                    {review.moderation_status === 'rejected' && (
                      <button
                        type="button"
                        onClick={() => updateStatus(review.id, 'approved')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white font-700 text-xs hover:bg-green-700"
                      >
                        <Icon name="CheckIcon" size={14} />
                        Approve
                      </button>
                    )}
                    {review.reported && (
                      <button
                        type="button"
                        onClick={() => clearReport(review.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 text-slate-700 font-700 text-xs hover:bg-slate-300"
                      >
                        <Icon name="CheckCircleIcon" size={14} />
                        Dismiss Report
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(review.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 text-red-600 font-700 text-xs hover:bg-red-200"
                    >
                      <Icon name="TrashIcon" size={14} />
                      Delete
                    </button>
                  </div>
                </div>

                {review.title && <h4 className="font-800 mt-3">{review.title}</h4>}
                <p className="text-sm text-foreground/80 mt-1.5">{review.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
