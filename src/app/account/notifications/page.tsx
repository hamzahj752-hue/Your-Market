'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import {
  fetchNotifications,
  markRead,
  markAllRead,
  timeAgo,
  AppNotification,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

const TYPE_ICONS: Record<string, string> = {
  order_placed: 'CheckCircleIcon',
  order_confirmed: 'ClipboardDocumentListIcon',
  order_shipped: 'TruckIcon',
  order_delivered: 'HomeIcon',
  order_cancelled: 'XCircleIcon',
};

export default function AccountNotificationsPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) setLoggedIn(false);
        setLoading(false);
        return;
      }
      setLoggedIn(true);
      const list = await fetchNotifications('customer');
      if (active) setNotifications(list);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onRead(n: AppNotification) {
    await markRead(n.id);
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
  }

  async function onReadAll() {
    await markAllRead('customer');
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
  }

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-28 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link
                href="/account"
                className="inline-flex items-center gap-1.5 text-sm text-primary font-700 hover:underline mb-2"
              >
                <Icon name="ArrowLeftIcon" size={16} />
                Back to Account
              </Link>
              <h1 className="text-2xl md:text-3xl font-800">Notifications</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Updates about your orders and account.
              </p>
            </div>
            {notifications.length > 0 && unread > 0 && (
              <button
                type="button"
                onClick={onReadAll}
                className="px-4 py-2 rounded-xl border border-border text-sm font-700 hover:bg-muted"
              >
                Mark all read
              </button>
            )}
          </div>

          {!loggedIn ? (
            <section className="bg-card rounded-3xl card-shadow p-10 text-center">
              <Icon name="BellIcon" size={40} className="text-muted-foreground mb-4 mx-auto" />
              <h2 className="text-xl font-800 mb-2">Sign in to see notifications</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Log in to view updates about your orders.
              </p>
              <Link href="/account" className="btn-primary inline-flex">
                Go to Account
              </Link>
            </section>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <section className="bg-card rounded-3xl card-shadow p-10 text-center">
              <Icon name="InboxIcon" size={40} className="text-muted-foreground mb-4 mx-auto" />
              <h2 className="text-xl font-800 mb-2">No notifications yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                When you place or update an order, updates will appear here.
              </p>
              <Link href="/products" className="btn-primary inline-flex">
                Browse products
              </Link>
            </section>
          ) : (
            <section className="bg-card rounded-3xl card-shadow p-4 md:p-6 space-y-2">
              {notifications.map((n) => {
                const inner = (
                  <>
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
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => onRead(n)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <Icon name="EnvelopeOpenIcon" size={18} />
                      </button>
                    )}
                  </>
                );
                const className = `flex items-start gap-3 rounded-2xl p-4 transition-colors ${
                  n.is_read ? '' : 'bg-muted/40'
                } ${n.link ? 'hover:bg-muted/70' : ''}`;
                return n.link ? (
                  <Link key={n.id} href={n.link} className={className}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className={className}>
                    {inner}
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
