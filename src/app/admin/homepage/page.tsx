'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';
import { uploadHomepageImage } from '@/lib/homepageImages';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-700">{label}</span>
      {hint && <span className="text-xs text-muted-foreground ml-1">({hint})</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="input-search mt-0 w-full" />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="input-search mt-0 w-full" />;
}

function CheckboxRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5"
      />
      <span className="text-sm font-700">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-3xl card-shadow overflow-hidden">
      <div className="p-5 md:p-6 border-b border-border">
        <h2 className="text-xl font-900">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="p-5 md:p-6 space-y-4">{children}</div>
    </section>
  );
}

function RowItem({
  title,
  subtitle,
  image,
  onEdit,
  onDelete,
  isActive,
  onToggle,
  controls,
}: {
  title: string;
  subtitle?: string;
  image?: string;
  onEdit?: () => void;
  onDelete: () => void;
  isActive: boolean;
  onToggle: () => void;
  controls?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
      {image && (
        <img
          src={image}
          alt=""
          className="w-14 h-14 rounded-xl object-cover bg-muted flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-700 text-sm truncate">{title}</span>
          {!isActive && (
            <span className="text-[10px] font-700 uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        {controls}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          title={isActive ? 'Deactivate' : 'Activate'}
        >
          <Icon name={isActive ? 'EyeIcon' : 'EyeSlashIcon'} size={18} />
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            title="Edit"
          >
            <Icon name="PencilSquareIcon" size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"
          title="Delete"
        >
          <Icon name="TrashIcon" size={18} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center text-sm text-muted-foreground py-8 border border-dashed border-border rounded-2xl">
      {message}
    </div>
  );
}

function FormActions({
  saving,
  isEdit,
  onCancel,
}: {
  saving: boolean;
  isEdit: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 pt-1">
      <button
        type="submit"
        disabled={saving}
        className="btn-primary px-6 py-2.5 justify-center disabled:opacity-50"
      >
        {saving ? 'Saving...' : isEdit ? 'Update' : 'Add'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-6 py-2.5 rounded-xl border border-border font-700 hover:bg-muted"
      >
        Cancel
      </button>
    </div>
  );
}

function ImagePicker({
  value,
  onChange,
  uploading,
  setUploading,
  setError,
  label = 'Upload image',
}: {
  value: string;
  onChange: (v: string) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  setError: (msg: string) => void;
  label?: string;
}) {
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const result = await uploadHomepageImage(file, 'banners');
    setUploading(false);
    if ('error' in result) {
      setError(result.error);
    } else {
      onChange(result.url);
    }
    e.target.value = '';
  }
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-2xl overflow-hidden border border-border bg-muted flex items-center justify-center flex-shrink-0">
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <Icon name="PhotoIcon" size={24} className="text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label className="px-4 py-2 rounded-xl border border-border font-700 text-sm hover:bg-muted cursor-pointer inline-flex items-center gap-2 w-fit">
          <Icon name="ArrowUpTrayIcon" size={16} />
          {uploading ? 'Uploading...' : label}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-red-600 hover:underline w-fit"
          >
            Remove image
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero Banners                                                        */
/* ------------------------------------------------------------------ */
interface HeroBanner {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  cta_text: string | null;
  cta_url: string | null;
  is_active: boolean;
  sort_order: number;
}

function HeroBanners() {
  const [rows, setRows] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HeroBanner | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    cta_text: '',
    cta_url: '',
  });

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('homepage_hero_banners')
      .select('*')
      .order('sort_order')
      .order('created_at');
    if (!err && data) setRows(data as HeroBanner[]);
    if (err) setError('Unable to load hero banners.');
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setForm({ title: '', subtitle: '', image_url: '', cta_text: '', cta_url: '' });
    setEditing(null);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  function openEdit(r: HeroBanner) {
    setForm({
      title: r.title || '',
      subtitle: r.subtitle || '',
      image_url: r.image_url,
      cta_text: r.cta_text || '',
      cta_url: r.cta_url || '',
    });
    setEditing(r);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.image_url) {
      setError('Image is required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error: err } = editing
      ? await supabase.from('homepage_hero_banners').update(payload).eq('id', editing.id)
      : await supabase.from('homepage_hero_banners').insert(payload);
    setSaving(false);
    if (err) {
      setError('Unable to save hero banner.');
      return;
    }
    setMessage(editing ? 'Hero banner updated.' : 'Hero banner added.');
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function toggle(r: HeroBanner) {
    await supabase
      .from('homepage_hero_banners')
      .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    load();
  }
  async function remove(r: HeroBanner) {
    if (!window.confirm('Delete this hero banner?')) return;
    await supabase.from('homepage_hero_banners').delete().eq('id', r.id);
    load();
  }

  return (
    <SectionCard title="Hero Banners" subtitle="Rotating banners at the top of the homepage.">
      {showForm ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-border p-4">
          <Field label="Image">
            <ImagePicker
              value={form.image_url}
              onChange={(v) => setForm((f) => ({ ...f, image_url: v }))}
              uploading={uploading}
              setUploading={setUploading}
              setError={setError}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Title">
              <TextInput
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <Field label="Subtitle">
              <TextInput
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </Field>
            <Field label="CTA text">
              <TextInput
                value={form.cta_text}
                onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
              />
            </Field>
            <Field label="CTA link" hint="internal path">
              <TextInput
                value={form.cta_url}
                onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                placeholder="/products"
              />
            </Field>
          </div>
          {error && <p className="text-sm text-red-500 font-600">{error}</p>}
          <FormActions saving={saving} isEdit={!!editing} onCancel={() => setShowForm(false)} />
        </form>
      ) : (
        <div className="flex justify-end">
          <button onClick={openAdd} className="btn-primary px-5 py-2.5 justify-center">
            <Icon name="PlusIcon" size={16} /> Add Banner
          </button>
        </div>
      )}
      {message && <p className="text-sm text-green-600 font-600">{message}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No hero banners yet. Add one to feature it on the homepage." />
      ) : (
        rows.map((r) => (
          <RowItem
            key={r.id}
            title={r.title || 'Untitled'}
            subtitle={r.subtitle || ''}
            image={r.image_url}
            onEdit={() => openEdit(r)}
            onDelete={() => remove(r)}
            isActive={r.is_active}
            onToggle={() => toggle(r)}
          />
        ))
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Featured Products                                                   */
/* ------------------------------------------------------------------ */
interface FeaturedRow {
  id: string;
  product_id: string;
  sort_order: number;
  is_active: boolean;
  products: { id: string; name: string; image: string; price: number }[] | null;
}

function FeaturedProductsAdmin() {
  const [rows, setRows] = useState<FeaturedRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('homepage_featured_products')
      .select('id, product_id, sort_order, is_active, products(id, name, image, price)')
      .order('sort_order');
    if (!err && data) setRows(data as FeaturedRow[]);
    if (err) setError('Unable to load featured products.');
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function loadProducts() {
    const { data } = await supabase.from('products').select('id, name').order('name');
    setProducts((data as { id: string; name: string }[]) || []);
  }
  useEffect(() => {
    loadProducts();
  }, []);

  const [selected, setSelected] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Choose a product.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('homepage_featured_products')
      .insert({ product_id: selected, sort_order: rows.length });
    setSaving(false);
    if (err) {
      setError('Unable to add featured product.');
      return;
    }
    setMessage('Product added to featured.');
    setSelected('');
    setShowForm(false);
    load();
  }

  async function toggle(r: FeaturedRow) {
    await supabase
      .from('homepage_featured_products')
      .update({ is_active: !r.is_active })
      .eq('id', r.id);
    load();
  }
  async function remove(r: FeaturedRow) {
    if (!window.confirm('Remove this product from featured?')) return;
    await supabase.from('homepage_featured_products').delete().eq('id', r.id);
    load();
  }

  return (
    <SectionCard title="Featured Products" subtitle="Products highlighted from live product data.">
      {showForm ? (
        <form onSubmit={save} className="rounded-2xl border border-border p-4 space-y-3">
          <Field label="Product">
            <SelectInput value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          {error && <p className="text-sm text-red-500 font-600">{error}</p>}
          <FormActions saving={saving} isEdit={false} onCancel={() => setShowForm(false)} />
        </form>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-5 py-2.5 justify-center"
          >
            <Icon name="PlusIcon" size={16} /> Add Product
          </button>
        </div>
      )}
      {message && <p className="text-sm text-green-600 font-600">{message}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No featured products. Add products to showcase them." />
      ) : (
        rows.map((r) => (
          <RowItem
            key={r.id}
            title={r.products?.[0]?.name || 'Unknown product'}
            image={r.products?.[0]?.image}
            onDelete={() => remove(r)}
            isActive={r.is_active}
            onToggle={() => toggle(r)}
          />
        ))
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Deals                                                               */
/* ------------------------------------------------------------------ */
interface DealRow {
  id: string;
  product_id: string;
  title: string | null;
  subtitle: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  is_active: boolean;
  products: { id: string; name: string; image: string; price: number }[] | null;
}

function Deals() {
  const [rows, setRows] = useState<DealRow[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DealRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    product_id: '',
    title: '',
    subtitle: '',
    starts_at: '',
    ends_at: '',
  });

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('homepage_deals')
      .select(
        'id, product_id, title, subtitle, starts_at, ends_at, sort_order, is_active, products(id, name, image, price)'
      )
      .order('sort_order');
    if (!err && data) setRows(data as DealRow[]);
    if (err) setError('Unable to load deals.');
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function loadProducts() {
    const { data } = await supabase.from('products').select('id, name').order('name');
    setProducts((data as { id: string; name: string }[]) || []);
  }
  useEffect(() => {
    loadProducts();
  }, []);

  function toLocal(v: string | null): string {
    return v ? new Date(v).toISOString().slice(0, 16) : '';
  }

  function openAdd() {
    setForm({ product_id: '', title: '', subtitle: '', starts_at: '', ends_at: '' });
    setEditing(null);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  function openEdit(r: DealRow) {
    setForm({
      product_id: r.product_id,
      title: r.title || '',
      subtitle: r.subtitle || '',
      starts_at: toLocal(r.starts_at),
      ends_at: toLocal(r.ends_at),
    });
    setEditing(r);
    setShowForm(true);
    setError('');
    setMessage('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_id) {
      setError('Choose a product.');
      return;
    }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) < new Date(form.starts_at)) {
      setError('End date must not be before start date.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      product_id: form.product_id,
      title: form.title || null,
      subtitle: form.subtitle || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = editing
      ? await supabase.from('homepage_deals').update(payload).eq('id', editing.id)
      : await supabase.from('homepage_deals').insert(payload);
    setSaving(false);
    if (err) {
      setError('Unable to save deal.');
      return;
    }
    setMessage(editing ? 'Deal updated.' : 'Deal added.');
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function toggle(r: DealRow) {
    await supabase
      .from('homepage_deals')
      .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    load();
  }
  async function remove(r: DealRow) {
    if (!window.confirm('Remove this deal?')) return;
    await supabase.from('homepage_deals').delete().eq('id', r.id);
    load();
  }

  const availableProducts = editing
    ? products
    : products.filter((p) => !rows.some((r) => r.product_id === p.id));

  return (
    <SectionCard title="Deals" subtitle="Flash deal placements referencing live product pricing.">
      {showForm ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-border p-4">
          <Field label="Product">
            <SelectInput
              value={form.product_id}
              onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
            >
              <option value="">Select a product...</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Deal title">
              <TextInput
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <Field label="Deal subtitle">
              <TextInput
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </Field>
            <Field label="Start date/time">
              <TextInput
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
              />
            </Field>
            <Field label="End date/time">
              <TextInput
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
              />
            </Field>
          </div>
          {error && <p className="text-sm text-red-500 font-600">{error}</p>}
          <FormActions saving={saving} isEdit={!!editing} onCancel={() => setShowForm(false)} />
        </form>
      ) : (
        <div className="flex justify-end">
          <button onClick={openAdd} className="btn-primary px-5 py-2.5 justify-center">
            <Icon name="PlusIcon" size={16} /> Add Deal
          </button>
        </div>
      )}
      {message && <p className="text-sm text-green-600 font-600">{message}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No deals yet. Add a deal to showcase a product." />
      ) : (
        rows.map((r) => (
          <RowItem
            key={r.id}
            title={r.products?.[0]?.name || 'Unknown product'}
            subtitle={r.title || ''}
            image={r.products?.[0]?.image}
            onEdit={() => openEdit(r)}
            onDelete={() => remove(r)}
            isActive={r.is_active}
            onToggle={() => toggle(r)}
          />
        ))
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Homepage Categories                                                 */
/* ------------------------------------------------------------------ */
interface HomeCatRow {
  id: string;
  category_id: string;
  sort_order: number;
  is_active: boolean;
  categories: { id: string; name: string; image: string | null }[] | null;
}

function HomepageCategories() {
  const [rows, setRows] = useState<HomeCatRow[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState('');

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('homepage_categories')
      .select('id, category_id, sort_order, is_active, categories(id, name, image)')
      .order('sort_order');
    if (!err && data) setRows(data as HomeCatRow[]);
    if (err) setError('Unable to load homepage categories.');
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setCategories((data as { id: string; name: string }[]) || []);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Choose a category.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('homepage_categories')
      .insert({ category_id: selected, sort_order: rows.length });
    setSaving(false);
    if (err) {
      setError('Unable to add category.');
      return;
    }
    setMessage('Category added.');
    setSelected('');
    setShowForm(false);
    load();
  }
  async function toggle(r: HomeCatRow) {
    await supabase.from('homepage_categories').update({ is_active: !r.is_active }).eq('id', r.id);
    load();
  }
  async function remove(r: HomeCatRow) {
    if (!window.confirm('Remove this category from the homepage?')) return;
    await supabase.from('homepage_categories').delete().eq('id', r.id);
    load();
  }

  const available = categories.filter((c) => !rows.some((r) => r.category_id === c.id));

  return (
    <SectionCard
      title="Homepage Categories"
      subtitle="Categories shown on the storefront homepage."
    >
      {showForm ? (
        <form onSubmit={save} className="rounded-2xl border border-border p-4 space-y-3">
          <Field label="Category">
            <SelectInput value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a category...</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          {error && <p className="text-sm text-red-500 font-600">{error}</p>}
          <FormActions saving={saving} isEdit={false} onCancel={() => setShowForm(false)} />
        </form>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-5 py-2.5 justify-center"
          >
            <Icon name="PlusIcon" size={16} /> Add Category
          </button>
        </div>
      )}
      {message && <p className="text-sm text-green-600 font-600">{message}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No homepage categories yet." />
      ) : (
        rows.map((r) => (
          <RowItem
            key={r.id}
            title={r.categories?.[0]?.name || 'Unknown category'}
            image={r.categories?.[0]?.image || undefined}
            onDelete={() => remove(r)}
            isActive={r.is_active}
            onToggle={() => toggle(r)}
          />
        ))
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Promotional Banners                                                 */
/* ------------------------------------------------------------------ */
interface PromoRow {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  cta_text: string | null;
  cta_url: string | null;
  is_active: boolean;
  sort_order: number;
}

function PromotionalBanners() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    cta_text: '',
    cta_url: '',
  });

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('homepage_promotional_banners')
      .select('*')
      .order('sort_order');
    if (!err && data) setRows(data as PromoRow[]);
    if (err) setError('Unable to load promotional banners.');
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setForm({ title: '', subtitle: '', image_url: '', cta_text: '', cta_url: '' });
    setEditing(null);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  function openEdit(r: PromoRow) {
    setForm({
      title: r.title || '',
      subtitle: r.subtitle || '',
      image_url: r.image_url,
      cta_text: r.cta_text || '',
      cta_url: r.cta_url || '',
    });
    setEditing(r);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.image_url) {
      setError('Image is required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error: err } = editing
      ? await supabase.from('homepage_promotional_banners').update(payload).eq('id', editing.id)
      : await supabase.from('homepage_promotional_banners').insert(payload);
    setSaving(false);
    if (err) {
      setError('Unable to save promotional banner.');
      return;
    }
    setMessage(editing ? 'Promotional banner updated.' : 'Promotional banner added.');
    setShowForm(false);
    setEditing(null);
    load();
  }
  async function toggle(r: PromoRow) {
    await supabase
      .from('homepage_promotional_banners')
      .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    load();
  }
  async function remove(r: PromoRow) {
    if (!window.confirm('Delete this promotional banner?')) return;
    await supabase.from('homepage_promotional_banners').delete().eq('id', r.id);
    load();
  }

  return (
    <SectionCard title="Promotional Banners" subtitle="Promotional banners shown on the homepage.">
      {showForm ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-border p-4">
          <Field label="Image">
            <ImagePicker
              value={form.image_url}
              onChange={(v) => setForm((f) => ({ ...f, image_url: v }))}
              uploading={uploading}
              setUploading={setUploading}
              setError={setError}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Title">
              <TextInput
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <Field label="Subtitle">
              <TextInput
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </Field>
            <Field label="CTA text">
              <TextInput
                value={form.cta_text}
                onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))}
              />
            </Field>
            <Field label="CTA link" hint="internal path">
              <TextInput
                value={form.cta_url}
                onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                placeholder="/products"
              />
            </Field>
          </div>
          {error && <p className="text-sm text-red-500 font-600">{error}</p>}
          <FormActions saving={saving} isEdit={!!editing} onCancel={() => setShowForm(false)} />
        </form>
      ) : (
        <div className="flex justify-end">
          <button onClick={openAdd} className="btn-primary px-5 py-2.5 justify-center">
            <Icon name="PlusIcon" size={16} /> Add Banner
          </button>
        </div>
      )}
      {message && <p className="text-sm text-green-600 font-600">{message}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No promotional banners yet." />
      ) : (
        rows.map((r) => (
          <RowItem
            key={r.id}
            title={r.title || 'Untitled'}
            subtitle={r.subtitle || ''}
            image={r.image_url}
            onEdit={() => openEdit(r)}
            onDelete={() => remove(r)}
            isActive={r.is_active}
            onToggle={() => toggle(r)}
          />
        ))
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */
interface TestimonialRow {
  id: string;
  customer_name: string;
  testimonial_text: string;
  customer_image_url: string | null;
  rating: number | null;
  is_active: boolean;
  sort_order: number;
}

function Testimonials() {
  const [rows, setRows] = useState<TestimonialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TestimonialRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    customer_name: '',
    testimonial_text: '',
    customer_image_url: '',
    rating: '',
  });

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('homepage_testimonials')
      .select('*')
      .order('sort_order');
    if (!err && data) setRows(data as TestimonialRow[]);
    if (err) setError('Unable to load testimonials.');
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setForm({ customer_name: '', testimonial_text: '', customer_image_url: '', rating: '' });
    setEditing(null);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  function openEdit(r: TestimonialRow) {
    setForm({
      customer_name: r.customer_name,
      testimonial_text: r.testimonial_text,
      customer_image_url: r.customer_image_url || '',
      rating: r.rating != null ? String(r.rating) : '',
    });
    setEditing(r);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.testimonial_text.trim()) {
      setError('Name and testimonial text are required.');
      return;
    }
    const ratingNum = form.rating === '' ? null : Number(form.rating);
    if (ratingNum !== null && (ratingNum < 1 || ratingNum > 5)) {
      setError('Rating must be between 1 and 5.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      customer_name: form.customer_name.trim(),
      testimonial_text: form.testimonial_text.trim(),
      customer_image_url: form.customer_image_url || null,
      rating: ratingNum,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = editing
      ? await supabase.from('homepage_testimonials').update(payload).eq('id', editing.id)
      : await supabase.from('homepage_testimonials').insert(payload);
    setSaving(false);
    if (err) {
      setError('Unable to save testimonial.');
      return;
    }
    setMessage(editing ? 'Testimonial updated.' : 'Testimonial added.');
    setShowForm(false);
    setEditing(null);
    load();
  }
  async function toggle(r: TestimonialRow) {
    await supabase
      .from('homepage_testimonials')
      .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    load();
  }
  async function remove(r: TestimonialRow) {
    if (!window.confirm('Delete this testimonial?')) return;
    await supabase.from('homepage_testimonials').delete().eq('id', r.id);
    load();
  }

  return (
    <SectionCard
      title="Testimonials"
      subtitle="Manually curated quotes shown to shoppers. No account data is exposed."
    >
      {showForm ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-border p-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Display name">
              <TextInput
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
            </Field>
            <Field label="Rating" hint="1-5, optional">
              <TextInput
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Testimonial text">
            <textarea
              value={form.testimonial_text}
              onChange={(e) => setForm((f) => ({ ...f, testimonial_text: e.target.value }))}
              className="input-search mt-0 w-full min-h-24"
            />
          </Field>
          <Field label="Customer photo" hint="optional">
            <ImagePicker
              value={form.customer_image_url}
              onChange={(v) => setForm((f) => ({ ...f, customer_image_url: v }))}
              uploading={uploading}
              setUploading={setUploading}
              setError={setError}
            />
          </Field>
          {error && <p className="text-sm text-red-500 font-600">{error}</p>}
          <FormActions saving={saving} isEdit={!!editing} onCancel={() => setShowForm(false)} />
        </form>
      ) : (
        <div className="flex justify-end">
          <button onClick={openAdd} className="btn-primary px-5 py-2.5 justify-center">
            <Icon name="PlusIcon" size={16} /> Add Testimonial
          </button>
        </div>
      )}
      {message && <p className="text-sm text-green-600 font-600">{message}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No testimonials yet." />
      ) : (
        rows.map((r) => (
          <RowItem
            key={r.id}
            title={r.customer_name}
            subtitle={r.testimonial_text}
            image={r.customer_image_url || undefined}
            onEdit={() => openEdit(r)}
            onDelete={() => remove(r)}
            isActive={r.is_active}
            onToggle={() => toggle(r)}
          />
        ))
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Trust Items                                                         */
/* ------------------------------------------------------------------ */
interface TrustRow {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
}

function TrustItems() {
  const [rows, setRows] = useState<TrustRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TrustRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', description: '', icon: '' });

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('homepage_trust_items')
      .select('*')
      .order('sort_order');
    if (!err && data) setRows(data as TrustRow[]);
    if (err) setError('Unable to load trust items.');
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setForm({ title: '', description: '', icon: '' });
    setEditing(null);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  function openEdit(r: TrustRow) {
    setForm({ title: r.title, description: r.description || '', icon: r.icon || '' });
    setEditing(r);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = editing
      ? await supabase.from('homepage_trust_items').update(payload).eq('id', editing.id)
      : await supabase.from('homepage_trust_items').insert(payload);
    setSaving(false);
    if (err) {
      setError('Unable to save trust item.');
      return;
    }
    setMessage(editing ? 'Trust item updated.' : 'Trust item added.');
    setShowForm(false);
    setEditing(null);
    load();
  }
  async function toggle(r: TrustRow) {
    await supabase
      .from('homepage_trust_items')
      .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    load();
  }
  async function remove(r: TrustRow) {
    if (!window.confirm('Delete this trust item?')) return;
    await supabase.from('homepage_trust_items').delete().eq('id', r.id);
    load();
  }

  return (
    <SectionCard
      title="Trust Section"
      subtitle="Assurance badges shown on the homepage (e.g. Secure Payments, Fast Delivery)."
    >
      {showForm ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-border p-4">
          <Field label="Title">
            <TextInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label="Description">
            <TextInput
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <Field label="Icon identifier" hint="heroicon name, optional">
            <TextInput
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="ShieldCheckIcon"
            />
          </Field>
          {error && <p className="text-sm text-red-500 font-600">{error}</p>}
          <FormActions saving={saving} isEdit={!!editing} onCancel={() => setShowForm(false)} />
        </form>
      ) : (
        <div className="flex justify-end">
          <button onClick={openAdd} className="btn-primary px-5 py-2.5 justify-center">
            <Icon name="PlusIcon" size={16} /> Add Trust Item
          </button>
        </div>
      )}
      {message && <p className="text-sm text-green-600 font-600">{message}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState message="No trust items yet." />
      ) : (
        rows.map((r) => (
          <RowItem
            key={r.id}
            title={r.title}
            subtitle={r.description || r.icon || ''}
            onEdit={() => openEdit(r)}
            onDelete={() => remove(r)}
            isActive={r.is_active}
            onToggle={() => toggle(r)}
          />
        ))
      )}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AdminHomepagePage() {
  return (
    <AdminShell title="Homepage" subtitle="Manage the content shown on your storefront homepage.">
      <div className="flex flex-col gap-8">
        <HeroBanners />
        <FeaturedProductsAdmin />
        <Deals />
        <HomepageCategories />
        <PromotionalBanners />
        <Testimonials />
        <TrustItems />
      </div>
    </AdminShell>
  );
}
