'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';

/*
 * Food Order detail (customer side) — a compact view for the Food flow. No
 * parcel/tracking details (Food uses the status workflow, not carrier tracking).
 * Only the authenticated owner can see their own order (enforced by RLS).
 */

interface FoodOrder {
  id: string;
  order_number?: string | null;
  status?: string;
  created_at: string;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  coupon_code?: string | null;
  payment_method?: string;
  payment_status?: string;
  customer_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  delivered_at?: string | null;
}

interface FoodOrderItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  variant_size?: string | null;
  variant_color?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  Pending: 'Waiting for the kitchen to confirm',
  Confirmed: 'Food order confirmed',
  Preparing: 'Your food is being prepared',
  Ready: 'Your food is ready',
  'Out for Delivery': 'Your food is out for delivery',
  Delivered: 'Delivered — enjoy your meal!',
  Cancelled: 'This food order was cancelled',
};

const STATUS_ORDER = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const money = (value: number) => `रू${Math.round(value).toLocaleString('en-IN')}`;

export default function FoodOrderDetailsClient({ id }: { id: string }) {
  const [order, setOrder] = useState<FoodOrder | null>(null);
  const [items, setItems] = useState<FoodOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setError('Please login to view food order details.');
          setLoading(false);
        }
        return;
      }

      const [orderRes, itemsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('order_items')
          .select('*')
          .eq('order_id', id)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;

      if (orderRes.error || !orderRes.data || itemsRes.error) {
        setError('Unable to load this food order. It may not exist or you may not have access.');
        setLoading(false);
        return;
      }

      setOrder({
        id: orderRes.data.id,
        order_number: orderRes.data.order_number,
        status: orderRes.data.status,
        created_at: orderRes.data.created_at,
        total: Number(orderRes.data.total || 0),
        subtotal: Number(orderRes.data.subtotal || 0),
        shipping: Number(orderRes.data.shipping || 0),
        tax: Number(orderRes.data.tax || 0),
        discount: Number(orderRes.data.discount || 0),
        coupon_code: orderRes.data.coupon_code,
        payment_method: orderRes.data.payment_method,
        payment_status: orderRes.data.payment_status,
        customer_name: orderRes.data.customer_name,
        phone: orderRes.data.phone,
        address: orderRes.data.address,
        city: orderRes.data.city,
        cancelled_at: orderRes.data.cancelled_at,
        cancellation_reason: orderRes.data.cancellation_reason,
        delivered_at: orderRes.data.delivered_at,
      });
      setItems(
        ((itemsRes.data ?? []) as Record<string, unknown>[]).map((it) => ({
          id: String(it.id),
          product_id: String(it.product_id || ''),
          name: String(it.name || 'Food item'),
          price: Number(it.price || 0),
          quantity: Number(it.quantity || 0),
          image: it.image != null ? String(it.image) : null,
          variant_size: it.variant_size != null ? String(it.variant_size) : null,
          variant_color: it.variant_color != null ? String(it.variant_color) : null,
        }))
      );
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const stepIndex = order ? STATUS_ORDER.indexOf(order.status || 'Pending') : 0;
  const isCancelled = order?.status === 'Cancelled';
  const isDelivered = order?.status === 'Delivered';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="mb-6">
            <Link
              href="/account/food-orders"
              className="inline-flex items-center gap-1.5 text-sm text-primary font-700 hover:underline mb-2"
            >
              <Icon name="ArrowLeftIcon" size={16} />
              Food Orders
            </Link>
            <h1 className="text-2xl md:text-3xl font-800">
              {order?.order_number ? `Food Order ${order.order_number}` : 'Food Order'}
            </h1>
            {order && (
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(order.created_at).toLocaleString()}
              </p>
            )}
          </div>

          {loading ? (
            <section className="bg-card rounded-3xl card-shadow p-10 text-center">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading food order...</p>
            </section>
          ) : error ? (
            <section className="bg-card rounded-3xl card-shadow p-10 text-center">
              <Icon
                name="ExclamationTriangleIcon"
                size={40}
                className="mx-auto mb-4 text-red-500/60"
              />
              <h2 className="text-xl font-800 mb-2">Couldn&apos;t load food order</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </section>
          ) : (
            order && (
              <>
                {/* Status */}
                <section
                  className={`bg-card rounded-3xl card-shadow p-5 mb-4 border ${
                    isCancelled
                      ? 'border-red-200'
                      : isDelivered
                        ? 'border-green-200'
                        : 'border-border/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-800">Order Status</h2>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-800 ${
                        isCancelled
                          ? 'bg-red-100 text-red-600'
                          : isDelivered
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {order.status || 'Pending'}
                    </span>
                  </div>

                  {isCancelled ? (
                    <p className="text-sm text-red-600">
                      Your food order was cancelled
                      {order.cancelled_at
                        ? ` on ${new Date(order.cancelled_at).toLocaleString()}`
                        : ''}
                      {order.cancellation_reason ? ` (${order.cancellation_reason})` : '.'}
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 mb-3">
                        {STATUS_ORDER.slice(0, 6).map((step, i) => {
                          const active = i <= stepIndex && !isCancelled;
                          return (
                            <div key={step} className="flex-1">
                              <div
                                className={`h-1.5 rounded-full ${
                                  active ? 'bg-accent' : 'bg-muted'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-sm font-600 text-primary">
                        {STATUS_LABEL[order.status || 'Pending'] || 'Order is being processed'}
                      </p>
                      {order.delivered_at && isDelivered && (
                        <p className="text-xs text-green-700 font-600 mt-1">
                          Delivered on {new Date(order.delivered_at).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </section>

                {/* Delivery */}
                <section className="bg-card rounded-3xl card-shadow p-5 mb-4 border border-border/50">
                  <h2 className="text-base font-800 mb-3">Delivery Details</h2>
                  <div className="space-y-1.5 text-sm">
                    <p className="font-700">{order.customer_name || '—'}</p>
                    {order.phone && <p className="text-muted-foreground">{order.phone}</p>}
                    <p className="text-muted-foreground">
                      {order.address || '—'}
                      {order.city ? `, ${order.city}` : ''}
                    </p>
                  </div>
                </section>

                {/* Items */}
                <section className="bg-card rounded-3xl card-shadow p-5 mb-4 border border-border/50">
                  <h2 className="text-base font-800 mb-3">Food Items ({items.length})</h2>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items recorded.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="w-14 h-14 rounded-xl bg-muted/40 overflow-hidden shrink-0">
                            {it.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={it.image}
                                alt={it.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon
                                  name="PhotoIcon"
                                  size={18}
                                  className="text-muted-foreground/40"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-700 text-sm truncate">{it.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {it.quantity} × {money(it.price)}
                            </p>
                          </div>
                          <p className="font-800 text-sm">{money(it.price * it.quantity)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Summary */}
                <section className="bg-card rounded-3xl card-shadow p-5 border border-border/50">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{money(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span>{order.shipping === 0 ? 'FREE' : money(order.shipping)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{money(order.tax)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                        <span>-{money(order.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-900 text-base pt-2 border-t border-border">
                      <span>Total</span>
                      <span>{money(order.total)}</span>
                    </div>
                    <div className="flex justify-between pt-2 text-xs text-muted-foreground">
                      <span>Payment</span>
                      <span className="font-700 capitalize">
                        {order.payment_method === 'cod'
                          ? 'Cash on Delivery'
                          : (order.payment_method || 'cod').replace(/^./, (c) =>
                              c.toUpperCase()
                            )}{' '}
                        · {order.payment_status || 'pending'}
                      </span>
                    </div>
                  </div>
                </section>
              </>
            )
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
