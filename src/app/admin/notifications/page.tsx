'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import {
  fetchNotifications,
  markRead,
  markAllRead,
  timeAgo,
  AppNotification,
} from '@/lib/notifications';

const TYPE_ICONS: Record<string, string> = {
  new_order: 'ShoppingBagIcon',
  low_stock: 'ExclamationTriangleIcon',
  new_customer: 'UserPlusIcon',
  new_review: 'ChatBubbleLeftRightIcon',
};

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const list = await fetchNotifications('admin');
      if (active) setNotifications(list);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onOpen(n: AppNotification) {
    if (!n.is_read) {
      await markRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.link) router.push(n.link);
  }

  async function onReadAll() {
    await markAllRead('admin');
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
  }

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <AdminShell
      title="Notifications"
      subtitle="System alerts and store activity."
      actions={
        notifications.length > 0 && unread > 0 ? (
          <button
            type="button"
            onClick={onReadAll}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-700 hover:bg-muted"
          >
            Mark all read
          </button>
        ) : undefined
      }
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <section className="bg-card rounded-3xl card-shadow p-10 text-center">
          <Icon name="InboxIcon" size={40} className="text-muted-foreground mb-4 mx-auto" />
          <h2 className="text-xl font-800 mb-2">No notifications</h2>
          <p className="text-sm text-muted-foreground">
            New orders, low stock, registrations and reviews will appear here.
          </p>
        </section>
      ) : (
        <section className="bg-card rounded-3xl card-shadow p-4 md:p-6 space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onOpen(n)}
              className={`w-full text-left flex items-start gap-3 rounded-2xl p-4 transition-colors ${
                n.is_read ? 'hover:bg-muted/60' : 'bg-muted/40 hover:bg-muted/60'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  n.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                }`}
              >
                <Icon name={TYPE_ICONS[n.type] || 'BellIcon'} size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.is_read ? 'text-muted-foreground' : 'font-800'}`}>
                  {n.title}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />}
            </button>
          ))}
        </section>
      )}
    </AdminShell>
  );
}
