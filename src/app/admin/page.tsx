'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface AdminStats {
  products: number;
  orders: number;
  customers: number;
  revenue: number;
  pendingOrders: number;
  lowStock: number;
}

const EXCLUDED_SALES_STATUSES = new Set(['Cancelled', 'Refunded']);

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    products: 0,
    orders: 0,
    customers: 0,
    revenue: 0,
    pendingOrders: 0,
    lowStock: 0,
  });
  const [salesMap, setSalesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const [productsResult, ordersResult, customersResult, profilesResult] = await Promise.all([
        supabase.from('products').select('id, stock_quantity, active, in_stock'),
        supabase.from('orders').select('id, user_id, total, status, created_at'),
        supabase.from('orders').select('user_id'),
        supabase.from('profiles').select('id'),
      ]);

      const orders = ordersResult.data || [];
      const activeOrders = orders.filter((o) => !EXCLUDED_SALES_STATUSES.has(o.status || ''));

      const revenue = activeOrders.reduce((sum, row) => sum + Number(row.total || 0), 0);

      const uniqueCustomers = new Set<string>();
      (customersResult.data || []).forEach((row) => {
        if (row.user_id) uniqueCustomers.add(String(row.user_id));
      });
      (profilesResult.data || []).forEach((row) => uniqueCustomers.add(String(row.id)));

      const pendingOrders = orders.filter((o) => o.status === 'Pending').length;
      const lowStock = (productsResult.data || []).filter(
        (p) => p.in_stock === false || Number(p.stock_quantity || 0) < 5
      ).length;

      const monthTotals: Record<string, number> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthTotals[key] = 0;
      }

      activeOrders.forEach((o) => {
        if (!o.created_at) return;
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key in monthTotals) {
          monthTotals[key] += Number(o.total || 0);
        }
      });

      setStats({
        products: productsResult.data?.length || 0,
        orders: orders.length,
        customers: uniqueCustomers.size,
        revenue,
        pendingOrders,
        lowStock,
      });
      setSalesMap(monthTotals);
      setLoading(false);
    }

    loadDashboard();
  }, []);

  const chartData = useMemo(() => {
    const labels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return Object.keys(salesMap)
      .sort()
      .map((key) => {
        const [, month] = key.split('-');
        return {
          name: labels[Number(month) - 1] || key,
          sales: Math.round(salesMap[key] || 0),
        };
      });
  }, [salesMap]);

  return (
    <AdminShell
      title="Admin Dashboard"
      subtitle="Manage your store from one place."
      actions={
        <Link
          href="/products"
          className="px-5 py-3 rounded-xl border border-border font-700 text-sm hover:bg-muted transition-colors"
        >
          View Store
        </Link>
      }
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading dashboard...</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {[
              {
                label: 'Products',
                value: stats.products.toString(),
                icon: 'CubeIcon',
                color: 'text-primary bg-primary/10',
              },
              {
                label: 'Orders',
                value: stats.orders.toString(),
                icon: 'ShoppingBagIcon',
                color: 'text-orange-500 bg-orange-500/10',
              },
              {
                label: 'Customers',
                value: stats.customers.toString(),
                icon: 'UsersIcon',
                color: 'text-blue-500 bg-blue-500/10',
              },
              {
                label: 'Pending Orders',
                value: stats.pendingOrders.toString(),
                icon: 'ClockIcon',
                color: 'text-amber-500 bg-amber-500/10',
              },
              {
                label: 'Low / Out of Stock',
                value: stats.lowStock.toString(),
                icon: 'ExclamationTriangleIcon',
                color: 'text-red-500 bg-red-500/10',
              },
              {
                label: 'Revenue',
                value: `रू${stats.revenue.toLocaleString('en-IN')}`,
                icon: 'BanknotesIcon',
                color: 'text-green-600 bg-green-500/10',
              },
            ].map((card) => (
              <div key={card.label} className="bg-card rounded-2xl card-shadow p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-900 mt-2">{card.value}</p>
                  </div>
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.color}`}
                  >
                    <Icon name={card.icon} size={22} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="bg-card rounded-3xl card-shadow p-6 md:p-8 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-900">Sales Overview</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Monthly revenue for the last 6 months (excludes cancelled/refunded).
                </p>
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} width={70} />
                  <Tooltip
                    formatter={(value) => [`रू${Number(value).toLocaleString('en-IN')}`, 'Sales']}
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-card rounded-3xl card-shadow p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-900 mb-6">Store Management</h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ManagementCard
                href="/admin/products"
                icon="CubeIcon"
                color="text-primary"
                title="Products"
                subtitle="Add, edit and manage products."
              />
              <ManagementCard
                href="/admin/categories"
                icon="TagIcon"
                color="text-emerald-600"
                title="Categories"
                subtitle="Organise products by category."
              />
              <ManagementCard
                href="/admin/orders"
                icon="ShoppingBagIcon"
                color="text-orange-500"
                title="Orders"
                subtitle="View and manage customer orders."
              />
              <ManagementCard
                href="/admin/customers"
                icon="UsersIcon"
                color="text-blue-500"
                title="Customers"
                subtitle="Manage customer accounts."
              />
              <ManagementCard
                href="/admin/coupons"
                icon="TicketIcon"
                color="text-violet-600"
                title="Coupons"
                subtitle="Create and manage discount coupons."
              />
              <ManagementCard
                href="/admin/reviews"
                icon="ChatBubbleLeftRightIcon"
                color="text-purple-500"
                title="Reviews"
                subtitle="Moderate customer reviews."
              />
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}

function ManagementCard({
  href,
  icon,
  color,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="p-5 rounded-2xl border border-border hover:bg-muted transition-colors"
    >
      <Icon name={icon} size={25} className={`${color} mb-4`} />
      <p className="font-900">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </Link>
  );
}
