'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';

interface CustomerRow {
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  account_status: string;
  blocked_at: string | null;
  joined_at: string | null;
  orders: number;
  spent: number;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  async function loadCustomers() {
    setLoading(true);
    setError('');

    const [ordersResult, profilesResult] = await Promise.all([
      supabase.from('orders').select('user_id, customer_name, total, created_at'),
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, account_status, blocked_at, created_at'),
    ]);

    const orderMap = new Map<string, { name: string; orders: number; spent: number }>();
    (ordersResult.data || []).forEach((row) => {
      if (!row.user_id) return;
      const key = String(row.user_id);
      const cur = orderMap.get(key) || {
        name: String(row.customer_name || ''),
        orders: 0,
        spent: 0,
      };
      cur.orders += 1;
      cur.spent += Number(row.total || 0);
      if (!cur.name) cur.name = String(row.customer_name || '');
      orderMap.set(key, cur);
    });

    const profileMap = new Map<string, any>();
    (profilesResult.data || []).forEach((p) => profileMap.set(String(p.id), p));

    const rows: CustomerRow[] = [];

    orderMap.forEach((info, userId) => {
      rows.push({
        user_id: userId,
        name: info.name || 'Customer',
        email: profileMap.get(userId)?.email || null,
        phone: profileMap.get(userId)?.phone || null,
        account_status: profileMap.get(userId)?.account_status || 'active',
        blocked_at: profileMap.get(userId)?.blocked_at || null,
        joined_at: profileMap.get(userId)?.created_at || null,
        orders: info.orders,
        spent: info.spent,
      });
    });

    profileMap.forEach((p, userId) => {
      if (orderMap.has(userId)) return;
      rows.push({
        user_id: userId,
        name: p.full_name || 'Customer',
        email: p.email || null,
        phone: p.phone || null,
        account_status: p.account_status || 'active',
        blocked_at: p.blocked_at || null,
        joined_at: p.created_at || null,
        orders: 0,
        spent: 0,
      });
    });

    rows.sort((a, b) => b.spent - a.spent);
    setCustomers(rows);
    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function ensureProfile(c: CustomerRow) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', c.user_id)
      .maybeSingle();
    if (!existing) {
      await supabase.from('profiles').insert({
        id: c.user_id,
        full_name: c.name,
        email: c.email,
        phone: c.phone,
      });
    }
  }

  async function toggleBlock(c: CustomerRow) {
    setToggling(c.user_id);
    setError('');
    setMessage('');
    await ensureProfile(c);

    const blocking = c.account_status !== 'blocked';
    const patch = blocking
      ? { account_status: 'blocked', blocked_at: new Date().toISOString() }
      : { account_status: 'active', blocked_at: null };

    const { error: err } = await supabase.from('profiles').update(patch).eq('id', c.user_id);

    if (err) {
      setError('Unable to update customer.');
      setToggling(null);
      return;
    }

    setMessage(blocking ? `Blocked ${c.name}.` : `Unblocked ${c.name}.`);
    setCustomers((prev) =>
      prev.map((x) =>
        x.user_id === c.user_id
          ? {
              ...x,
              account_status: blocking ? 'blocked' : 'active',
              blocked_at: blocking ? patch.blocked_at : null,
            }
          : x
      )
    );
    setToggling(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        c.user_id.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const blockedCount = customers.filter((c) => c.account_status === 'blocked').length;

  return (
    <AdminShell
      title="Customers"
      subtitle="Manage customer accounts, view order history and block/unblock."
    >
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
            placeholder="Search by name, email, phone..."
            className="input-search w-full pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {customers.length} customers · {blockedCount} blocked
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-700 text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-700 text-red-600">
          {error}
        </div>
      )}

      <section className="bg-card rounded-3xl card-shadow p-5 md:p-8">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading customers...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="UsersIcon" size={40} className="text-muted-foreground mb-3 mx-auto" />
            <p className="font-800">No customers found</p>
            <p className="text-sm text-muted-foreground mt-1">
              No customers match the current filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 font-700">Customer</th>
                  <th className="pb-3 font-700">Contact</th>
                  <th className="pb-3 font-700">Joined</th>
                  <th className="pb-3 font-700">Orders</th>
                  <th className="pb-3 font-700">Spent</th>
                  <th className="pb-3 font-700">Status</th>
                  <th className="pb-3 font-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const blocked = c.account_status === 'blocked';
                  return (
                    <tr key={c.user_id} className="border-b border-border/60">
                      <td className="py-4 pr-3">
                        <p className="font-800">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.user_id.slice(0, 8)}…</p>
                      </td>
                      <td className="py-4 pr-3">
                        <p className="text-xs">{c.email || '—'}</p>
                        <p className="text-xs text-muted-foreground">{c.phone || ''}</p>
                      </td>
                      <td className="py-4 pr-3 text-muted-foreground">
                        {c.joined_at
                          ? new Date(c.joined_at).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-4 pr-3">{c.orders}</td>
                      <td className="py-4 pr-3 font-800">रू{c.spent.toLocaleString('en-IN')}</td>
                      <td className="py-4 pr-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-700 ${
                            blocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {blocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="py-4">
                        <button
                          type="button"
                          disabled={toggling === c.user_id}
                          onClick={() => toggleBlock(c)}
                          className={`px-3 py-2 rounded-xl text-xs font-700 border disabled:opacity-50 ${
                            blocked
                              ? 'border-green-500/30 text-green-700 hover:bg-green-500/10'
                              : 'border-red-500/30 text-red-600 hover:bg-red-500/10'
                          }`}
                        >
                          {toggling === c.user_id ? '...' : blocked ? 'Unblock' : 'Block'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
