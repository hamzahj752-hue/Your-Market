'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';

interface Category {
  id: string;
  name: string;
  slug?: string | null;
  image?: string | null;
  icon?: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

const emptyForm = {
  name: '',
  slug: '',
  image: '',
  icon: '',
  sort_order: '0',
  active: true,
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCategoryCounts, setProductCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function loadCategories() {
    setLoading(true);
    setError('');

    const [categoriesResult, productsResult] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('products').select('category'),
    ]);

    if (categoriesResult.error) {
      setError('Unable to load categories.');
      setCategories([]);
    } else {
      setCategories((categoriesResult.data || []) as Category[]);
    }

    const counts: Record<string, number> = {};
    (productsResult.data || []).forEach((p) => {
      const key = String(p.category || '').trim();
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    setProductCategoryCounts(counts);

    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage('');
    setError('');
    setShowForm(true);
  }

  function openEditForm(cat: Category) {
    setEditingId(cat.id);
    setForm({
      name: cat.name || '',
      slug: cat.slug || '',
      image: cat.image || '',
      icon: cat.icon || '',
      sort_order: cat.sort_order?.toString() || '0',
      active: cat.active,
    });
    setMessage('');
    setError('');
    setShowForm(true);
  }

  function updateField(field: keyof typeof emptyForm, value: string | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const data = {
      name: form.name.trim(),
      slug: form.slug.trim() || lower(form.name.trim()),
      image: form.image.trim() || null,
      icon: form.icon.trim() || null,
      sort_order: form.sort_order.trim() ? Number(form.sort_order) : 0,
      active: form.active,
    };

    const { error: saveError } = editingId
      ? await supabase.from('categories').update(data).eq('id', editingId)
      : await supabase.from('categories').insert(data);

    if (saveError) {
      console.error('Category save error:', saveError);
      setError('Unable to save category.');
      setSaving(false);
      return;
    }

    setMessage(editingId ? 'Category updated successfully.' : 'Category added successfully.');
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    await loadCategories();
  }

  function lower(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async function deleteCategory(cat: Category) {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    setError('');
    setMessage('');

    const { error } = await supabase.from('categories').delete().eq('id', cat.id);
    if (error) {
      setError('Unable to delete category.');
      return;
    }
    setMessage('Category deleted successfully.');
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
  }

  async function toggleActive(cat: Category) {
    const { error } = await supabase
      .from('categories')
      .update({ active: !cat.active })
      .eq('id', cat.id);
    if (error) {
      setError('Unable to update category.');
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, active: !cat.active } : c)));
  }

  return (
    <AdminShell
      title="Categories"
      subtitle="Organise products by category."
      actions={
        <button
          type="button"
          onClick={openAddForm}
          className="btn-primary px-5 py-3 justify-center"
        >
          <Icon name="PlusIcon" size={18} />
          Add Category
        </button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading categories...</p>
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
                    {editingId ? 'Edit Category' : 'Add Category'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Category information.</p>
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

              <form onSubmit={saveCategory} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-700">Name *</span>
                    <input
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g. Electronics"
                      className="input-search mt-2 w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-700">Slug</span>
                    <input
                      value={form.slug}
                      onChange={(e) => updateField('slug', e.target.value)}
                      placeholder="auto-generated"
                      className="input-search mt-2 w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-700">Image URL</span>
                    <input
                      value={form.image}
                      onChange={(e) => updateField('image', e.target.value)}
                      placeholder="https://..."
                      className="input-search mt-2 w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-700">Sort Order</span>
                    <input
                      type="number"
                      value={form.sort_order}
                      onChange={(e) => updateField('sort_order', e.target.value)}
                      className="input-search mt-2 w-full"
                    />
                  </label>
                </div>
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
                    {saving ? 'Saving...' : editingId ? 'Update Category' : 'Add Category'}
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
              <h2 className="text-xl font-900">All Categories</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
              </p>
            </div>

            {categories.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="TagIcon" size={45} className="mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-900 text-lg mb-2">No categories found</h3>
                <p className="text-sm text-muted-foreground mb-5">Add your first category.</p>
                <button type="button" onClick={openAddForm} className="btn-primary px-5 py-3">
                  Add Category
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {categories.map((cat) => (
                  <article key={cat.id} className="p-5 md:p-6 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted shrink-0">
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="TagIcon" size={24} className="text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-900">{cat.name}</h3>
                        {!cat.active && (
                          <span className="text-[10px] font-800 rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                            Hidden
                          </span>
                        )}
                        {cat.icon && (
                          <span className="text-[10px] font-800 rounded-full bg-primary/10 text-primary px-2 py-0.5">
                            {cat.icon}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {productCategoryCounts[cat.name] || 0} product
                        {(productCategoryCounts[cat.name] || 0) === 1 ? '' : 's'} · order{' '}
                        {cat.sort_order}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleActive(cat)}
                        className="px-3 py-2 rounded-xl border border-border font-700 text-sm hover:bg-muted"
                      >
                        {cat.active ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(cat)}
                        className="px-3 py-2 rounded-xl border border-border font-700 text-sm hover:bg-muted"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(cat)}
                        className="px-3 py-2 rounded-xl border border-red-500/20 text-red-600 font-700 text-sm hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
