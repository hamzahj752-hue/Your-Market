'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { requireAdmin } from '@/lib/admin';
import { fetchNotifications } from '@/lib/notifications';

const NAV_ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/admin', label: 'Dashboard', icon: 'Squares2x2Icon' },
  { href: '/admin/products', label: 'Products', icon: 'CubeIcon' },
  { href: '/admin/categories', label: 'Categories', icon: 'TagIcon' },
  { href: '/admin/orders', label: 'Orders', icon: 'ShoppingBagIcon' },
  { href: '/admin/customers', label: 'Customers', icon: 'UsersIcon' },
  { href: '/admin/coupons', label: 'Coupons', icon: 'TicketIcon' },
  { href: '/admin/reviews', label: 'Reviews', icon: 'ChatBubbleLeftRightIcon' },
  { href: '/admin/homepage', label: 'Homepage', icon: 'HomeModernIcon' },
  { href: '/admin/notifications', label: 'Notifications', icon: 'BellIcon' },
  { href: '/admin/settings', label: 'Settings', icon: 'Cog6ToothIcon' },
];

interface AdminShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function AdminShell({ title, subtitle, actions, children }: AdminShellProps) {
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [message, setMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    requireAdmin().then((result) => {
      if (!active) return;
      if (result.authorized) {
        setState('ready');
        fetchNotifications('admin', 200).then((list) => {
          if (!active) return;
          setUnreadCount(list.filter((n) => !n.is_read).length);
        });
      } else {
        setMessage(result.message || 'Access denied. Admin account required.');
        setState('denied');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">Checking admin access...</p>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
              <Icon name="LockClosedIcon" size={30} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-900 mb-3">Admin Access Required</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Link href="/account" className="btn-primary inline-flex">
              Go to Account
            </Link>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="lg:w-60 shrink-0">
              <div className="bg-card rounded-3xl card-shadow p-4 flex lg:flex-col gap-1 overflow-x-auto">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-700 whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon name={item.icon} size={19} />
                      <span>{item.label}</span>
                      {item.href === '/admin/notifications' && unreadCount > 0 && (
                        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-800 flex items-center justify-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </aside>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 text-sm text-primary font-700 hover:underline mb-2"
                  >
                    <Icon name="ArrowLeftIcon" size={16} />
                    Admin Dashboard
                  </Link>
                  <h1 className="text-3xl md:text-4xl font-900">{title}</h1>
                  {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
                </div>
                {actions}
              </div>

              {children}
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
