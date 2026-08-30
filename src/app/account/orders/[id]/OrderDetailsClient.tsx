'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';

interface Order {
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
}

interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
}

const STATUS_STEPS = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];

export default function OrderDetailPage({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
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
          setError('Please login to view order details.');
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
        setError('Unable to load this order. It may not exist or you may not have access.');
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
      });
      setItems((itemsRes.data ?? []) as OrderItem[]);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const currentStep = order?.status
    ? STATUS_STEPS.indexOf(order.status === 'Placed' ? 'Pending' : order.status)
    : -1;
  const isCancelled = order?.status === 'Cancelled';
  const isRefunded = order?.status === 'Refunded';

  const money = (v: number | undefined | null) =>
    `रू${Math.round(Number(v || 0)).toLocaleString('en-IN')}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">Loading order...</p>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <Icon
              name="ExclamationTriangleIcon"
              size={40}
              className="mx-auto mb-4 text-red-500/60"
            />
            <h1 className="text-2xl font-800 mb-2">Order not found</h1>
            <p className="text-muted-foreground mb-6">{error || 'This order does not exist.'}</p>
            <Link href="/account" className="btn-primary inline-flex">
              Back to My Orders
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm text-primary font-700 hover:underline mb-6"
          >
            <Icon name="ArrowLeftIcon" size={15} />
            Back to My Orders
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-800">
                Order {order.order_number || order.id}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Placed on{' '}
                {new Date(order.created_at).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-700 ${
                order.status === 'Delivered'
                  ? 'bg-green-100 text-green-700'
                  : order.status === 'Cancelled' || order.status === 'Refunded'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
              }`}
            >
              {order.status || 'Pending'}
            </span>
          </div>

          {/* Status timeline */}
          {isCancelled || isRefunded ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 flex items-center gap-3">
              <Icon name="XCircleIcon" size={24} className="text-red-600" />
              <p className="text-sm font-700 text-red-700">
                {isRefunded ? 'This order was refunded.' : 'This order was cancelled.'}
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl card-shadow p-6 mb-6">
              <div className="flex items-center justify-between">
                {STATUS_STEPS.map((step, idx) => (
                  <div key={step} className="flex-1 flex flex-col items-center">
                    <div className="flex items-center w-full">
                      <div
                        className={`h-1 flex-1 ${
                          idx === 0
                            ? 'bg-transparent'
                            : idx <= currentStep
                              ? 'bg-green-500'
                              : 'bg-muted'
                        }`}
                      />
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-800 ${
                          idx <= currentStep
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {idx < currentStep ? <Icon name="CheckIcon" size={14} /> : idx + 1}
                      </div>
                      <div
                        className={`h-1 flex-1 ${
                          idx === STATUS_STEPS.length - 1
                            ? 'bg-transparent'
                            : idx < currentStep
                              ? 'bg-green-500'
                              : 'bg-muted'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-xs font-600 mt-2 ${
                        idx <= currentStep ? 'text-green-600' : 'text-muted-foreground'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <section className="bg-card rounded-2xl card-shadow p-6 mb-6">
            <h2 className="text-lg font-800 mb-4">Items</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items available for this order.</p>
            ) : (
              <ul className="space-y-4">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-4">
                    {it.image && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted/40 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/products/${it.product_id}`}
                        className="font-700 text-sm hover:text-primary line-clamp-1"
                      >
                        {it.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">Qty: {it.quantity}</p>
                    </div>
                    <span className="font-700 text-sm">{money(it.price * it.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Details */}
          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-card rounded-2xl card-shadow p-6">
              <h2 className="text-lg font-800 mb-4">Delivery Address</h2>
              <p className="font-700 text-sm">{order.customer_name}</p>
              <p className="text-sm text-muted-foreground">{order.address}</p>
              <p className="text-sm text-muted-foreground">{order.city}</p>
              <p className="text-sm text-muted-foreground">{order.phone}</p>
            </section>

            <section className="bg-card rounded-2xl card-shadow p-6">
              <h2 className="text-lg font-800 mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-600">{money(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}
                    </span>
                    <span className="text-green-600 font-600">-{money(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-600">
                    {order.shipping === 0 ? 'FREE' : money(order.shipping)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-600">{money(order.tax)}</span>
                </div>
                <div className="flex justify-between text-base font-800 pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">{money(order.total)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="font-600">
                    {order.payment_method === 'cod'
                      ? 'Cash on Delivery'
                      : (order.payment_method || 'cod').replace(/^./, (c) => c.toUpperCase())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Status</span>
                  <span className="font-600 capitalize">{order.payment_status || 'pending'}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
