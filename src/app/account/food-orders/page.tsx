'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';

interface FoodOrder {
  id: string;
  status?: string;
  orderNumber?: string;
  createdAt: string;
  total: number;
  paymentStatus?: string;
  itemCount?: number;
}

type LoadState = 'loading' | 'ready' | 'error';

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Confirmed: 'bg-blue-100 text-blue-700',
  Preparing: 'bg-orange-100 text-orange-700',
  Ready: 'bg-teal-100 text-teal-700',
  'Out for Delivery': 'bg-indigo-100 text-indigo-700',
  Delivered: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-600',
};

// Dedicated Food Orders page. Queries ONLY the current authenticated user's own
// Food orders (orders.order_type = 'food'), kept SEPARATE from the product
// orders under /account/orders.
export default function AccountFoodOrdersPage() {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoadState('loading');

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) setNotLoggedIn(true);
        setLoadState('ready');
        return;
      }
      setNotLoggedIn(false);

      // order_type is added by the food migration. Until it is applied there
      // ARE no food orders, so an unfiltered fallback is never shown here.
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('order_type', 'food')
        .order('created_at', { ascending: false });

      if (error) {
        if (active) setLoadState('error');
        return;
      }

      const rows = data ?? [];
      let itemCountMap: Record<string, number> = {};

      if (rows.length > 0) {
        const ids = rows.map((o) => o.id);
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, quantity')
          .in('order_id', ids);

        if (!itemsError && orderItems) {
          itemCountMap = orderItems.reduce<Record<string, number>>((map, row) => {
            map[row.order_id] = (map[row.order_id] || 0) + Number(row.quantity || 0);
            return map;
          }, {});
        }
      }

      if (!active) return;

      setOrders(
        rows.map((order) => ({
          id: order.id,
          status: order.status,
          orderNumber: order.order_number,
          createdAt: order.created_at,
          total: Number(order.total || 0),
          paymentStatus: order.payment_status,
          itemCount: itemCountMap[order.id],
        }))
      );
      setLoadState('ready');
    })();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="mb-6">
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 text-sm text-primary font-700 hover:underline mb-2"
            >
              <Icon name="ArrowLeftIcon" size={16} />
              Back
            </Link>
            <h1 className="text-2xl md:text-3xl font-800">Food Orders</h1>
            <p className="text-sm text-muted-foreground mt-1">Track and manage your food orders.</p>
          </div>

          {notLoggedIn ? (
            <section className="bg-card rounded-3xl card-shadow p-10 text-center">
              <Icon name="FireIcon" size={40} className="mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-800 mb-2">Sign in to see your food orders</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Log in to view your food order history and track deliveries.
              </p>
              <Link href="/account" className="btn-primary inline-flex">
                Go to Account
              </Link>
            </section>
          ) : loadState === 'loading' ? (
            <section className="bg-card rounded-3xl card-shadow p-10 text-center">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading your food orders...</p>
            </section>
          ) : loadState === 'error' ? (
            <section className="bg-card rounded-3xl card-shadow p-10 text-center">
              <Icon
                name="ExclamationTriangleIcon"
                size={40}
                className="mx-auto mb-4 text-red-500/60"
              />
              <h2 className="text-xl font-800 mb-2">Couldn&apos;t load food orders</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Something went wrong while fetching your food orders. Please try again.
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="btn-outline inline-flex items-center gap-2"
              >
                <Icon name="ArrowPathIcon" size={16} />
                Try Again
              </button>
            </section>
          ) : orders.length === 0 ? (
            <section className="bg-card rounded-3xl card-shadow p-10 text-center">
              <Icon name="FireIcon" size={40} className="mx-auto mb-4 text-muted-foreground/40" />
              <h2 className="text-xl font-800 mb-2">No food orders yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your food orders will appear here after you order through the Food checkout.
              </p>
              <Link href="/food" className="btn-primary inline-flex">
                Browse Food
              </Link>
            </section>
          ) : (
            <section className="space-y-2.5">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/account/food-orders/${order.id}`}
                  className="block bg-white border border-border/60 rounded-lg p-3 hover:border-primary/40 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-800 break-words">
                        {order.orderNumber
                          ? `Food Order ${order.orderNumber}`
                          : `Food Order #${order.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <p className="text-sm font-800">
                        रू{Number(order.total || 0).toLocaleString('en-IN')}
                      </p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-800 mt-1 ${
                          STATUS_STYLES[order.status || 'Pending'] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {order.status || 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span className="break-words">
                      {order.itemCount ?? 0} item(s) · Cash on Delivery
                    </span>
                    <span className="inline-flex items-center gap-1 text-primary font-700 text-xs shrink-0">
                      View Details
                      <Icon name="ChevronRightIcon" size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
