'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';

interface Coupon {
  code: string;
  discount_type: string;
  discount_percent: number | null;
  discount_value: number | null;
  min_order: number;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  description?: string | null;
  created_at: string;
}

const emptyForm = {
  code: '',
  discount_type: 'percent',
  discount_percent: '',
  discount_value: '',
  min_order: '0',
  usage_limit: '',
  active: true,
  expires_at: '',
  description: '',
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadCoupons() {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError('Unable to load coupons.');
    } else {
      setCoupons((data || []) as Coupon[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  function openAddForm() {
    setEditingCode(null);
    setForm(emptyForm);
    setMessage('');
    setError('');
    setShowForm(true);
  }

  function openEditForm(c: Coupon) {
    setEditingCode(c.code);
    setForm({
      code: c.code,
      discount_type: c.discount_type || 'percent',
      discount_percent: c.discount_percent?.toString() || '',
      discount_value: c.discount_value?.toString() || '',
      min_order: c.min_order?.toString() || '0',
      usage_limit: c.usage_limit?.toString() || '',
      active: c.active,
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : '',
      description: c.description || '',
    });
    setMessage('');
    setError('');
    setShowForm(true);
  }

  function updateField(field: keyof typeof emptyForm, value: string | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function discountLabel(c: Coupon): string {
    if (c.discount_type === 'fixed') {
      return `रू${Number(c.discount_value || 0).toLocaleString('en-IN')} off`;
    }
    return `${Number(c.discount_percent || 0)}% off`;
  }

  async function saveCoupon(e: React.FormEvent) {
    e.preventDefault();

    const code = form.code.trim().toUpperCase();
    if (!code) {
      setError('Coupon code is required.');
      return;
    }

    if (
      form.discount_type === 'percent' &&
      (!form.discount_percent || Number(form.discount_percent) <= 0)
    ) {
      setError('Please enter a discount percentage greater than 0.');
      return;
    }
    if (
      form.discount_type === 'fixed' &&
      (!form.discount_value || Number(form.discount_value) <= 0)
    ) {
      setError('Please enter a discount value greater than 0.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const data = {
      code,
      discount_type: form.discount_type,
      discount_percent: form.discount_percent.trim() ? Number(form.discount_percent) : null,
      discount_value: form.discount_value.trim() ? Number(form.discount_value) : null,
      min_order: form.min_order.trim() ? Number(form.min_order) : 0,
      usage_limit: form.usage_limit.trim() ? Number(form.usage_limit) : null,
      active: form.active,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      description: form.description.trim() || null,
    };

    const { error: saveError } = editingCode
      ? await supabase.from('coupons').update(data).eq('code', editingCode)
      : await supabase.from('coupons').insert(data);

    if (saveError) {
      console.error('Coupon save error:', saveError);
      setError('Unable to save coupon.');
      setSaving(false);
      return;
    }

    setMessage(editingCode ? 'Coupon updated successfully.' : 'Coupon added successfully.');
    setSaving(false);
    setShowForm(false);
    setEditingCode(null);
    setForm(emptyForm);
    await loadCoupons();
  }

  async function deleteCoupon(code: string) {
    if (!window.confirm(`Delete coupon "${code}"?`)) return;
    setError('');
    setMessage('');
    const { error } = await supabase.from('coupons').delete().eq('code', code);
    if (error) {
      setError('Unable to delete coupon.');
      return;
    }
    setMessage('Coupon deleted successfully.');
    setCoupons((prev) => prev.filter((c) => c.code !== code));
  }

  async function toggleActive(c: Coupon) {
    const { error } = await supabase
      .from('coupons')
      .update({ active: !c.active })
      .eq('code', c.code);
    if (error) {
      setError('Unable to update coupon.');
      return;
    }
    setCoupons((prev) => prev.map((x) => (x.code === c.code ? { ...x, active: !c.active } : x)));
  }

  return (
    <AdminShell
      title="Coupons"
      subtitle="Create and manage discount coupons."
      actions={
        <button
          type="button"
          onClick={openAddForm}
          className="btn-primary px-5 py-3 justify-center"
        >
          <Icon name="PlusIcon" size={18} />
          Add Coupon
        </button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading coupons...</p>
      ) : (
        <>
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

          {showForm && (
            <section className="bg-card rounded-3xl card-shadow p-6 md:p-8 mb-7">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-900">
                    {editingCode ? `Edit Coupon ${editingCode}` : 'Add Coupon'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-full hover:bg-muted"
                  aria-label="Close"
                >
                  <Icon name="XMarkIcon" size={20} />
                </button>
              </div>

              <form onSubmit={saveCoupon} className="space-y-5">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <label className="block">
                    <span className="text-sm font-700">Code *</span>
                    <input
                      value={form.code}
                      disabled={Boolean(editingCode)}
                      onChange={(e) => updateField('code', e.target.value)}
                      placeholder="e.g. SAVE10"
                      className="input-search mt-2 w-full uppercase disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Discount Type</span>
                    <select
                      value={form.discount_type}
                      onChange={(e) => updateField('discount_type', e.target.value)}
                      className="input-search mt-2 w-full"
                    >
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (रू)</option>
                    </select>
                  </label>

                  {form.discount_type === 'percent' ? (
                    <label className="block">
                      <span className="text-sm font-700">Discount % *</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={form.discount_percent}
                        onChange={(e) => updateField('discount_percent', e.target.value)}
                        className="input-search mt-2 w-full"
                      />
                    </label>
                  ) : (
                    <label className="block">
                      <span className="text-sm font-700">Discount Amount (रू) *</span>
                      <input
                        type="number"
                        min="0"
                        value={form.discount_value}
                        onChange={(e) => updateField('discount_value', e.target.value)}
                        className="input-search mt-2 w-full"
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className="text-sm font-700">Min. Order (रू)</span>
                    <input
                      type="number"
                      min="0"
                      value={form.min_order}
                      onChange={(e) => updateField('min_order', e.target.value)}
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Usage Limit</span>
                    <input
                      type="number"
                      min="0"
                      value={form.usage_limit}
                      onChange={(e) => updateField('usage_limit', e.target.value)}
                      placeholder="Unlimited if empty"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Expires At</span>
                    <input
                      type="datetime-local"
                      value={form.expires_at}
                      onChange={(e) => updateField('expires_at', e.target.value)}
                      className="input-search mt-2 w-full"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-700">Description</span>
                  <input
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Short description shown to customers"
                    className="input-search mt-2 w-full"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => updateField('active', e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="font-700 text-sm">Active</span>
                </label>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary px-6 py-3 justify-center disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingCode ? 'Update Coupon' : 'Add Coupon'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-3 rounded-xl border border-border font-700 hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="bg-card rounded-3xl card-shadow overflow-hidden">
            <div className="p-5 md:p-7 border-b border-border">
              <h2 className="text-xl font-900">All Coupons</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {coupons.length} coupon{coupons.length === 1 ? '' : 's'}
              </p>
            </div>

            {coupons.length === 0 ? (
              <div className="p-12 text-center">
                <Icon
                  name="TicketIcon"
                  size={45}
                  className="mx-auto mb-4 text-muted-foreground/30"
                />
                <h3 className="font-900 text-lg mb-2">No coupons found</h3>
                <p className="text-sm text-muted-foreground mb-5">Create your first coupon.</p>
                <button type="button" onClick={openAddForm} className="btn-primary px-5 py-3">
                  Add Coupon
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {coupons.map((c) => {
                  const expired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
                  return (
                    <article key={c.code} className="p-5 md:p-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon name="TicketIcon" size={24} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-900">{c.code}</h3>
                          <span
                            className={`text-[10px] font-800 px-2 py-0.5 rounded-full ${
                              c.active && !expired
                                ? 'bg-green-100 text-green-700'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {expired ? 'Expired' : c.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {discountLabel(c)}
                          {Number(c.min_order || 0) > 0 ? ` · min रू${c.min_order}` : ''} · used{' '}
                          {c.used_count}
                          {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                          {c.expires_at
                            ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}`
                            : ''}
                        </p>
                        {c.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleActive(c)}
                          className="px-3 py-2 rounded-xl border border-border font-700 text-xs hover:bg-muted"
                        >
                          {c.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(c)}
                          className="px-3 py-2 rounded-xl border border-border font-700 text-xs hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCoupon(c.code)}
                          className="px-3 py-2 rounded-xl border border-red-500/20 text-red-600 font-700 text-xs hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
