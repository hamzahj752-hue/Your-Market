'use client';

import { supabase } from '@/lib/supabase';

export interface AppNotification {
  id: string;
  recipient_type: 'customer' | 'admin';
  recipient_id: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  order_id: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Fetches notifications for the current user.
 * @param scope 'customer' reads notifications tied to the signed in user;
 *              'admin' reads the admin broadcast stream (requires is_admin()).
 */
export async function fetchNotifications(scope: 'customer' | 'admin', limit = 100) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_type', scope)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (scope === 'customer') {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    query = query.eq('recipient_id', user.id);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as AppNotification[];
}

export async function markRead(id: string) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  return !error && !!data;
}

export async function markAllRead(scope: 'customer' | 'admin') {
  let query = supabase.from('notifications').update({ is_read: true }).eq('recipient_type', scope);

  if (scope === 'customer') {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    query = query.eq('recipient_id', user.id);
  }

  const { error } = await query.eq('is_read', false);
  return !error;
}

export function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
