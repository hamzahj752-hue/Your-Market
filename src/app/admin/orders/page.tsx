'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';

interface AdminOrder {
  id: string;
  order_number: string | null;
  user_id: string;
  status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  shipping: number;
  coupon_code?: string | null;
  payment_method?: string | null;
  payment_provider?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  refunded_at?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  created_at: string;
  item_count?: number;
}

interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
}

const STATUSES = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Refunded',
  'Placed',
];

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Confirmed: 'bg-blue-100 text-blue-700',
  Processing: 'bg-sky-100 text-sky-700',
  Shipped: 'bg-indigo-100 text-indigo-700',
  Delivered: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-600',
  Refunded: 'bg-slate-200 text-slate-700',
  Placed: 'bg-slate-100 text-slate-600',
};

const PAYMENT_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-red-100 text-red-600',
  failed: 'bg-red-100 text-red-600',
  refunded: 'bg-slate-200 text-slate-700',
};

const PAYMENT_STATUSES = ['pending', 'paid', 'unpaid', 'failed', 'refunded'];

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadOrders() {
    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (err) {
      setError('Unable to load orders.');
      setLoading(false);
      return;
    }

    const list = (data ?? []) as unknown as AdminOrder[];
    const normalized = list.map((o) => ({
      ...o,
      total: Number(o.total || 0),
      subtotal: Number(o.subtotal || 0),
      tax: Number(o.tax || 0),
      discount: Number(o.discount || 0),
      shipping: Number(o.shipping || 0),
      payment_status: o.payment_status || 'pending',
    }));

    const orderIds = normalized.map((o) => o.id);
    const countMap: Record<string, number> = {};
    if (orderIds.length) {
      const { data: items } = await supabase.from('order_items').select('order_id, quantity');
      (items ?? []).forEach((it) => {
        countMap[it.order_id as string] =
          (countMap[it.order_id as string] || 0) + Number(it.quantity || 0);
      });
    }

    setOrders(normalized.map((o) => ({ ...o, item_count: countMap[o.id] || 0 })));
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function openDetail(order: AdminOrder) {
    setSelected(order);
    setDetailLoading(true);
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });
    setDetailItems((data || []) as OrderItem[]);
    setDetailLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    setError('');
    const { error: err } = await supabase.from('orders').update({ status }).eq('id', id);
    if (err) {
      setError('Unable to update order status.');
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    if (selected && selected.id === id) setSelected((prev) => (prev ? { ...prev, status } : prev));
  }

  async function updatePayment(id: string, paymentStatus: string) {
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      setError('Invalid payment status.');
      return;
    }
    if (paymentStatus === 'paid' || paymentStatus === 'refunded') {
      const confirmed = window.confirm(
        `Mark this order as ${paymentStatus === 'paid' ? 'PAID' : 'REFUNDED'}? This records the timestamp server-side.`
      );
      if (!confirmed) return;
    }
    setError('');
    const { error: err } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus })
      .eq('id', id);
    if (err) {
      setError('Unable to update payment status.');
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, payment_status: paymentStatus } : o))
    );
    if (selected && selected.id === id)
      setSelected((prev) => (prev ? { ...prev, payment_status: paymentStatus } : prev));
  }

  const filtered = useMemo(() => {
    let list = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          (o.order_number || '').toLowerCase().includes(q) ||
          (o.customer_name || '').toLowerCase().includes(q) ||
          (o.phone || '').toLowerCase().includes(q) ||
          (o.city || '').toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const counts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <AdminShell title="Order Management" subtitle="View and update customer orders and statuses.">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Icon
            name="MagnifyingGlassIcon"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order, name, phone or city..."
            className="input-search w-full pl-10"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-700 transition-colors ${
            statusFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/70'
          }`}
        >
          All ({orders.length})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-700 transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 text-red-600 font-600 text-sm flex items-center gap-2">
          <Icon name="ExclamationTriangleIcon" size={18} />
          {error}
        </div>
      )}

      <section className="bg-card rounded-3xl card-shadow p-5 md:p-8">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading orders...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="ShoppingBagIcon" size={40} className="text-muted-foreground mb-3 mx-auto" />
            <p className="font-800">No orders found</p>
            <p className="text-sm text-muted-foreground mt-1">
              No orders match the current filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 font-700">Order</th>
                  <th className="pb-3 font-700">Date</th>
                  <th className="pb-3 font-700">Customer</th>
                  <th className="pb-3 font-700">Total</th>
                  <th className="pb-3 font-700">Payment</th>
                  <th className="pb-3 font-700">Status</th>
                  <th className="pb-3 font-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className="border-b border-border/60">
                    <td className="py-4 pr-3">
                      <p className="font-800">{order.order_number || `#${order.id.slice(0, 8)}`}</p>
                      <p className="text-xs text-muted-foreground">{order.item_count} items</p>
                    </td>
                    <td className="py-4 pr-3 text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 pr-3">
                      <p className="font-700">{order.customer_name || 'Guest'}</p>
                      <p className="text-xs text-muted-foreground">{order.city || '—'}</p>
                    </td>
                    <td className="py-4 pr-3 font-800">रू{order.total.toLocaleString('en-IN')}</td>
                    <td className="py-4 pr-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-700 ${
                          PAYMENT_STYLES[order.payment_status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="py-4 pr-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-700 ${
                          STATUS_STYLES[order.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => openDetail(order)}
                        className="px-3 py-2 rounded-xl border border-border font-700 text-xs hover:bg-muted"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-card w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl card-shadow max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-900">
                  {selected.order_number || `Order ${selected.id.slice(0, 8)}`}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(selected.created_at).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-full hover:bg-muted"
                aria-label="Close"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-700 mb-1">Status</p>
                  <select
                    value={selected.status}
                    onChange={(e) => updateStatus(selected.id, e.target.value)}
                    className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-700 outline-none focus:ring-2 focus:ring-primary/20 w-full"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm font-700 mb-1">Payment</p>
                  <select
                    value={selected.payment_status}
                    onChange={(e) => updatePayment(selected.id, e.target.value)}
                    className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-700 outline-none focus:ring-2 focus:ring-primary/20 w-full"
                  >
                    {PAYMENT_STATUSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-sm font-700 mb-2">Shipping Details</p>
                <div className="rounded-2xl border border-border p-4 text-sm space-y-1">
                  <p className="font-800">{selected.customer_name || '—'}</p>
                  <p className="text-muted-foreground">{selected.phone || ''}</p>
                  <p className="text-muted-foreground">
                    {selected.address}
                    {selected.city ? `, ${selected.city}` : ''}
                  </p>
                  <p className="text-muted-foreground">
                    Payment:{' '}
                    {selected.payment_method === 'cod'
                      ? 'Cash on Delivery'
                      : (selected.payment_method || '—').replace(/^./, (c) => c.toUpperCase())}
                  </p>
                  {selected.paid_at && (
                    <p className="text-xs text-green-700 font-600">
                      Paid on{' '}
                      {new Date(selected.paid_at).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                  {selected.refunded_at && (
                    <p className="text-xs text-red-600 font-600">
                      Refunded on{' '}
                      {new Date(selected.refunded_at).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-700 mb-2">Items ({selected.item_count || 0})</p>
                {detailLoading ? (
                  <p className="text-sm text-muted-foreground">Loading items...</p>
                ) : detailItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items recorded.</p>
                ) : (
                  <ul className="space-y-3">
                    {detailItems.map((it) => (
                      <li key={it.id} className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
                          {it.image ? (
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
                            {it.quantity} × रू{Number(it.price || 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <p className="font-800 text-sm">
                          रू{Number(it.price || 0) * Number(it.quantity || 0)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-border pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>रू{selected.subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>रू{selected.shipping.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>रू{selected.tax.toLocaleString('en-IN')}</span>
                </div>
                {selected.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount {selected.coupon_code ? `(${selected.coupon_code})` : ''}</span>
                    <span>-रू{selected.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between font-900 text-base pt-2 border-t border-border">
                  <span>Total</span>
                  <span>रू{selected.total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
