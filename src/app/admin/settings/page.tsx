'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

interface StoreSettings {
  id: string;
  store_name: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  currency: string;
  shipping_charge: number;
  free_shipping_threshold: number;
  tax_percent: number;
  cod_enabled: boolean;
  online_payment_enabled: boolean;
  maintenance_mode: boolean;
}

const defaults: StoreSettings = {
  id: '',
  store_name: '',
  logo_url: null,
  contact_email: null,
  contact_phone: null,
  contact_address: null,
  currency: 'NPR',
  shipping_charge: 0,
  free_shipping_threshold: 0,
  tax_percent: 0,
  cod_enabled: true,
  online_payment_enabled: false,
  maintenance_mode: false,
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<StoreSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (err) {
      setError('Unable to load store settings.');
    } else {
      setForm({
        ...defaults,
        ...(data || {}),
      } as StoreSettings);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateText(field: keyof StoreSettings, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function updateNumber(
    field: 'shipping_charge' | 'free_shipping_threshold' | 'tax_percent',
    value: string
  ) {
    const parsed = Number(value);
    setForm((previous) => ({ ...previous, [field]: Number.isFinite(parsed) ? parsed : 0 }));
  }

  function updateBool(
    field: 'cod_enabled' | 'online_payment_enabled' | 'maintenance_mode',
    value: boolean
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function validate(): string {
    if (form.shipping_charge < 0) return 'Shipping charge cannot be negative.';
    if (form.free_shipping_threshold < 0) return 'Free shipping threshold cannot be negative.';
    if (form.tax_percent < 0 || form.tax_percent > 100)
      return 'Tax percentage must be between 0 and 100.';
    if (!form.currency.trim()) return 'Currency is required.';
    return '';
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('store-logo')
      .upload(path, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      setError('Unable to upload the logo.');
      setUploading(false);
      return;
    }

    const url = supabase.storage.from('store-logo').getPublicUrl(path).data.publicUrl;
    setForm((previous) => ({ ...previous, logo_url: url }));
    setMessage('Logo uploaded. Save to persist your changes.');
    setUploading(false);
    e.target.value = '';
  }

  async function removeLogo() {
    setUploading(true);
    setError('');
    const path = form.logo_url?.split('/').pop();
    if (path) {
      await supabase.storage.from('store-logo').remove([path]);
    }
    setForm((previous) => ({ ...previous, logo_url: null }));
    setUploading(false);
    setMessage('Logo removed. Save to persist your changes.');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setMessage('');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      id: SETTINGS_ID,
      store_name: form.store_name || null,
      logo_url: form.logo_url,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      contact_address: form.contact_address || null,
      currency: form.currency || 'NPR',
      shipping_charge: form.shipping_charge,
      free_shipping_threshold: form.free_shipping_threshold,
      tax_percent: form.tax_percent,
      cod_enabled: form.cod_enabled,
      online_payment_enabled: form.online_payment_enabled,
      maintenance_mode: form.maintenance_mode,
      updated_at: new Date().toISOString(),
    };

    const { error: err } = await supabase
      .from('store_settings')
      .upsert(payload, { onConflict: 'id' });

    setSaving(false);

    if (err) {
      setError('Unable to save store settings.');
      return;
    }

    setMessage('Store settings saved successfully.');
  }

  return (
    <AdminShell title="Store Settings" subtitle="Manage your storefront configuration.">
      {loading ? (
        <p className="text-muted-foreground">Loading settings...</p>
      ) : (
        <form onSubmit={save} className="space-y-6">
          {(message || error) && (
            <div
              className={`rounded-2xl px-5 py-4 text-sm font-700 ${
                error ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-700'
              }`}
            >
              {error || message}
            </div>
          )}

          {/* Store */}
          <section className="bg-card rounded-3xl card-shadow p-6 md:p-7">
            <h2 className="text-xl font-900 mb-1 flex items-center gap-2">
              <Icon name="BuildingStorefrontIcon" size={20} />
              Store
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Basic details shown to your customers.
            </p>

            <label className="block mb-4">
              <span className="text-sm font-700">Store name</span>
              <input
                value={form.store_name}
                onChange={(e) => updateText('store_name', e.target.value)}
                placeholder="Your Market"
                className="input-search mt-2 w-full"
              />
            </label>

            <div className="mb-4">
              <span className="text-sm font-700 block mb-2">Store logo</span>
              <div className="flex items-center gap-4">
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Store logo"
                    className="w-20 h-20 rounded-2xl object-cover border border-border bg-muted"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl border border-dashed border-border flex items-center justify-center text-muted-foreground">
                    <Icon name="PhotoIcon" size={24} />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="px-4 py-2 rounded-xl border border-border font-700 text-sm hover:bg-muted cursor-pointer inline-flex items-center gap-2 w-fit">
                    <Icon name="ArrowUpTrayIcon" size={16} />
                    {uploading ? 'Uploading...' : 'Upload logo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={uploadLogo}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  {form.logo_url && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      disabled={uploading}
                      className="px-4 py-2 rounded-xl border border-border font-700 text-sm text-red-600 hover:bg-red-500/10 w-fit"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-700">Contact email</span>
                <input
                  type="email"
                  value={form.contact_email || ''}
                  onChange={(e) => updateText('contact_email', e.target.value)}
                  placeholder="support@yourmarket.com"
                  className="input-search mt-2 w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm font-700">Contact phone</span>
                <input
                  value={form.contact_phone || ''}
                  onChange={(e) => updateText('contact_phone', e.target.value)}
                  placeholder="+977 9800000000"
                  className="input-search mt-2 w-full"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-700">Contact address</span>
                <input
                  value={form.contact_address || ''}
                  onChange={(e) => updateText('contact_address', e.target.value)}
                  placeholder="Kathmandu, Nepal"
                  className="input-search mt-2 w-full"
                />
              </label>
            </div>
          </section>

          {/* Commerce */}
          <section className="bg-card rounded-3xl card-shadow p-6 md:p-7">
            <h2 className="text-xl font-900 mb-1 flex items-center gap-2">
              <Icon name="ReceiptPercentIcon" size={20} />
              Commerce
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Currency and order totals used at checkout.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-700">Currency</span>
                <input
                  value={form.currency}
                  onChange={(e) => updateText('currency', e.target.value.toUpperCase())}
                  placeholder="NPR"
                  className="input-search mt-2 w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm font-700">Shipping charge (flat)</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.shipping_charge}
                  onChange={(e) => updateNumber('shipping_charge', e.target.value)}
                  className="input-search mt-2 w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm font-700">Free shipping threshold</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.free_shipping_threshold}
                  onChange={(e) => updateNumber('free_shipping_threshold', e.target.value)}
                  className="input-search mt-2 w-full"
                />
              </label>
              <label className="block">
                <span className="text-sm font-700">Tax percentage (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.tax_percent}
                  onChange={(e) => updateNumber('tax_percent', e.target.value)}
                  className="input-search mt-2 w-full"
                />
              </label>
            </div>
          </section>

          {/* Payments */}
          <section className="bg-card rounded-3xl card-shadow p-6 md:p-7">
            <h2 className="text-xl font-900 mb-1 flex items-center gap-2">
              <Icon name="CreditCardIcon" size={20} />
              Payments
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Choose which payment methods customers can use at checkout.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 cursor-pointer">
                <span>
                  <span className="font-700 text-sm block">Cash on Delivery</span>
                  <span className="text-xs text-muted-foreground">Pay when the order arrives</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.cod_enabled}
                  onChange={(e) => updateBool('cod_enabled', e.target.checked)}
                  className="w-5 h-5"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 cursor-pointer">
                <span>
                  <span className="font-700 text-sm block">Online Payment</span>
                  <span className="text-xs text-muted-foreground">Card / wallet payments</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.online_payment_enabled}
                  onChange={(e) => updateBool('online_payment_enabled', e.target.checked)}
                  className="w-5 h-5"
                />
              </label>
            </div>
          </section>

          {/* System */}
          <section className="bg-card rounded-3xl card-shadow p-6 md:p-7">
            <h2 className="text-xl font-900 mb-1 flex items-center gap-2">
              <Icon name="WrenchScrewdriverIcon" size={20} />
              System
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Global storefront controls.</p>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 cursor-pointer">
              <span>
                <span className="font-700 text-sm block">Maintenance Mode</span>
                <span className="text-xs text-muted-foreground">
                  Temporarily hide the storefront. Admins can still access the dashboard.
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.maintenance_mode}
                onChange={(e) => updateBool('maintenance_mode', e.target.checked)}
                className="w-5 h-5"
              />
            </label>
          </section>

          <div className="sticky bottom-4">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-8 py-3 justify-center disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
