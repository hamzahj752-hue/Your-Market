'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  image?: string | null;
  category?: string | null;
  original_price?: number | null;
  alt?: string | null;
  rating?: number | null;
  reviews?: number | null;
  discount?: number | null;
  badge?: string | null;
  variant?: string | null;
  brand?: string | null;
  in_stock?: boolean | null;
  sku?: string | null;
  featured?: boolean | null;
  active?: boolean | null;
  stock_quantity?: number | null;
  images?: unknown;
}

interface GalleryImage {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
}

const emptyForm = {
  id: '',
  name: '',
  description: '',
  price: '',
  image: '',
  category: '',
  original_price: '',
  alt: '',
  rating: '0',
  reviews: '0',
  discount: '',
  badge: '',
  variant: '',
  brand: '',
  in_stock: true,
  sku: '',
  stock_quantity: '0',
  featured: false,
  active: true,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  async function loadProducts() {
    setLoading(true);
    setError('');

    const [productsResult, categoriesResult] = await Promise.all([
      supabase.from('products').select('*').order('name', { ascending: true }),
      supabase.from('categories').select('name').order('name', { ascending: true }),
    ]);

    if (productsResult.error) {
      console.error(productsResult.error);
      setError('Unable to load products.');
      setProducts([]);
    } else {
      setProducts((productsResult.data || []) as Product[]);
    }

    setCategories((categoriesResult.data || []).map((c) => String(c.name)).filter(Boolean));

    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadGallery(productId: string) {
    const { data } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });
    setGallery((data || []) as GalleryImage[]);
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setGallery([]);
    setMessage('');
    setError('');
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingId(product.id);
    setForm({
      id: product.id || '',
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      image: product.image || '',
      category: product.category || '',
      original_price: product.original_price?.toString() || '',
      alt: product.alt || '',
      rating: product.rating?.toString() || '0',
      reviews: product.reviews?.toString() || '0',
      discount: product.discount?.toString() || '',
      badge: product.badge || '',
      variant: product.variant || '',
      brand: product.brand || '',
      in_stock: product.in_stock ?? true,
      sku: product.sku || '',
      stock_quantity: product.stock_quantity?.toString() || '0',
      featured: product.featured ?? false,
      active: product.active ?? true,
    });
    setMessage('');
    setError('');
    setShowForm(true);
    loadGallery(product.id);
  }

  function updateField(field: keyof typeof emptyForm, value: string | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const ext = file.name.split('.').pop() || 'png';
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error(uploadError);
      setError('Unable to upload image.');
      setUploading(false);
      return;
    }

    const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    updateField('image', url);
    setUploading(false);
    e.target.value = '';
  }

  async function addGalleryImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingId) return;

    setUploading(true);
    setError('');

    const ext = file.name.split('.').pop() || 'png';
    const path = `${editingId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error(uploadError);
      setError('Unable to upload image.');
      setUploading(false);
      return;
    }

    const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    const { error: insertError } = await supabase
      .from('product_images')
      .insert({ product_id: editingId, url, sort_order: gallery.length });

    if (insertError) {
      console.error(insertError);
      setError('Unable to save gallery image.');
    } else {
      loadGallery(editingId);
    }

    setUploading(false);
    e.target.value = '';
  }

  async function removeGalleryImage(id: string) {
    const img = gallery.find((g) => g.id === id);
    if (!img) return;
    if (!window.confirm('Remove this gallery image?')) return;

    const { error: delError } = await supabase.from('product_images').delete().eq('id', id);
    if (delError) {
      setError('Unable to remove image.');
      return;
    }

    if (editingId) loadGallery(editingId);
  }

  function nextSuggestedId(): string {
    const used = new Set(products.map((p) => p.id));
    let i = 1;
    let candidate = `pr${i}`;
    while (used.has(candidate)) {
      i += 1;
      candidate = `pr${i}`;
    }
    return candidate;
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();

    if (!editingId && !form.id.trim()) setForm((f) => ({ ...f, id: nextSuggestedId() }));

    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }

    if (!form.price.trim() || Number.isNaN(Number(form.price))) {
      setError('Please enter a valid price.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const productId = editingId || form.id.trim() || nextSuggestedId();

    const productData = {
      id: productId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      image: form.image.trim() || null,
      category: form.category.trim() || null,
      original_price: form.original_price.trim() ? Number(form.original_price) : null,
      alt: form.alt.trim() || null,
      rating: form.rating.trim() ? Number(form.rating) : 0,
      reviews: form.reviews.trim() ? Number(form.reviews) : 0,
      discount: form.discount.trim() ? Number(form.discount) : null,
      badge: form.badge.trim() || null,
      variant: form.variant.trim() || null,
      brand: form.brand.trim() || null,
      in_stock: form.in_stock,
      sku: form.sku.trim() || null,
      stock_quantity: form.stock_quantity.trim() ? Number(form.stock_quantity) : 0,
      featured: form.featured,
      active: form.active,
    };

    const { error: saveError } = editingId
      ? await supabase.from('products').update(productData).eq('id', editingId)
      : await supabase.from('products').insert(productData);

    if (saveError) {
      console.error('Product save error:', saveError);
      setError('Unable to save product.');
      setSaving(false);
      return;
    }

    setMessage(editingId ? 'Product updated successfully.' : 'Product added successfully.');
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setGallery([]);

    await loadProducts();
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(`Delete "${product.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    setError('');
    setMessage('');

    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id);

    if (deleteError) {
      console.error('Product delete error:', deleteError);
      setError('Unable to delete product.');
      return;
    }

    setMessage('Product deleted successfully.');
    setProducts((previous) => previous.filter((item) => item.id !== product.id));
  }

  return (
    <AdminShell
      title="Products"
      subtitle="Add, edit and manage your store products."
      actions={
        <button
          type="button"
          onClick={openAddForm}
          className="btn-primary px-5 py-3 justify-center"
        >
          <Icon name="PlusIcon" size={18} />
          Add Product
        </button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading products...</p>
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
                    {editingId ? 'Edit Product' : 'Add Product'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fill in the product information below.
                  </p>
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

              <form onSubmit={saveProduct} className="space-y-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <label className="block">
                    <span className="text-sm font-700">Product ID</span>
                    <input
                      value={form.id}
                      disabled={Boolean(editingId)}
                      onChange={(e) => updateField('id', e.target.value)}
                      placeholder={nextSuggestedId()}
                      className="input-search mt-2 w-full disabled:opacity-60"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-700">Product Name *</span>
                    <input
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Product name"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Price (??) *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => updateField('price', e.target.value)}
                      placeholder="0"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Original Price (??)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.original_price}
                      onChange={(e) => updateField('original_price', e.target.value)}
                      placeholder="0"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">SKU</span>
                    <input
                      value={form.sku}
                      onChange={(e) => updateField('sku', e.target.value)}
                      placeholder="SKU"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Category</span>
                    <input
                      list="category-list"
                      value={form.category}
                      onChange={(e) => updateField('category', e.target.value)}
                      placeholder="Category"
                      className="input-search mt-2 w-full"
                    />
                    <datalist id="category-list">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Brand</span>
                    <input
                      value={form.brand}
                      onChange={(e) => updateField('brand', e.target.value)}
                      placeholder="Brand"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Stock Quantity</span>
                    <input
                      type="number"
                      min="0"
                      value={form.stock_quantity}
                      onChange={(e) => updateField('stock_quantity', e.target.value)}
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Discount %</span>
                    <input
                      type="number"
                      min="0"
                      value={form.discount}
                      onChange={(e) => updateField('discount', e.target.value)}
                      placeholder="0"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Rating</span>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={form.rating}
                      onChange={(e) => updateField('rating', e.target.value)}
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Reviews</span>
                    <input
                      type="number"
                      min="0"
                      value={form.reviews}
                      onChange={(e) => updateField('reviews', e.target.value)}
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Variant</span>
                    <input
                      value={form.variant}
                      onChange={(e) => updateField('variant', e.target.value)}
                      placeholder="Variant"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Badge</span>
                    <input
                      value={form.badge}
                      onChange={(e) => updateField('badge', e.target.value)}
                      placeholder="New / Sale / Popular"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-700">Image Alt</span>
                    <input
                      value={form.alt}
                      onChange={(e) => updateField('alt', e.target.value)}
                      placeholder="Product image description"
                      className="input-search mt-2 w-full"
                    />
                  </label>

                  <div className="flex items-center gap-4 flex-wrap sm:col-span-2 lg:col-span-3">
                    <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                      <input
                        type="checkbox"
                        checked={form.in_stock}
                        onChange={(e) => updateField('in_stock', e.target.checked)}
                        className="w-5 h-5"
                      />
                      <span className="font-700 text-sm">In stock</span>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                      <input
                        type="checkbox"
                        checked={form.featured}
                        onChange={(e) => updateField('featured', e.target.checked)}
                        className="w-5 h-5"
                      />
                      <span className="font-700 text-sm">Featured</span>
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
                  </div>
                </div>

                <div>
                  <span className="text-sm font-700">Main Image</span>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
                    {form.image && (
                      <img
                        src={form.image}
                        alt="Main"
                        className="w-24 h-24 rounded-2xl object-cover bg-muted"
                      />
                    )}
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border font-700 text-sm hover:bg-muted cursor-pointer">
                      <Icon name="ArrowUpTrayIcon" size={16} />
                      {uploading ? 'Uploading...' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={uploadImage}
                        className="hidden"
                      />
                    </label>
                    <input
                      value={form.image}
                      onChange={(e) => updateField('image', e.target.value)}
                      placeholder="Paste image URL or upload"
                      className="input-search flex-1 w-full sm:w-auto"
                    />
                  </div>
                </div>

                {editingId && (
                  <div>
                    <span className="text-sm font-700">Gallery Images</span>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {gallery.map((g) => (
                        <div key={g.id} className="relative">
                          <img
                            src={g.url}
                            alt="Gallery"
                            className="w-20 h-20 rounded-xl object-cover bg-muted"
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(g.id)}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs"
                            aria-label="Remove"
                          >
                            <Icon name="XMarkIcon" size={12} />
                          </button>
                        </div>
                      ))}
                      <label className="w-20 h-20 rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted">
                        <Icon name="PlusIcon" size={22} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={addGalleryImage}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <label className="block">
                  <span className="text-sm font-700">Description</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Product description"
                    rows={5}
                    className="input-search mt-2 w-full resize-y"
                  />
                </label>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary px-6 py-3 justify-center disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-900">All Products</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {products.length} product{products.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="CubeIcon" size={45} className="mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-900 text-lg mb-2">No products found</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Add your first product to the store.
                </p>
                <button type="button" onClick={openAddForm} className="btn-primary px-5 py-3">
                  Add Product
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="p-5 md:p-6 flex flex-col lg:flex-row gap-5 lg:items-center"
                  >
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted shrink-0">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.alt || product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="PhotoIcon" size={30} className="text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-900 text-lg">{product.name}</h3>
                        {product.badge && (
                          <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-1 font-700">
                            {product.badge}
                          </span>
                        )}
                        {product.featured && (
                          <span className="text-xs rounded-full bg-amber-500/10 text-amber-700 px-2 py-1 font-700">
                            Featured
                          </span>
                        )}
                        {product.active === false && (
                          <span className="text-xs rounded-full bg-muted text-muted-foreground px-2 py-1 font-700">
                            Hidden
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {product.id}
                        {product.brand ? ` · ${product.brand}` : ''}
                        {product.category ? ` · ${product.category}` : ''}
                        {product.sku ? ` · SKU: ${product.sku}` : ''}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 mt-3">
                        <span className="font-900">
                          ??{Number(product.price || 0).toLocaleString('en-IN')}
                        </span>
                        {product.original_price && (
                          <span className="text-sm text-muted-foreground line-through">
                            ??{Number(product.original_price).toLocaleString('en-IN')}
                          </span>
                        )}
                        <span className="text-sm">? {Number(product.rating || 0).toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">
                          Stock: {Number(product.stock_quantity || 0)}
                        </span>
                        <span
                          className={`text-xs font-800 ${
                            product.in_stock ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {product.in_stock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditForm(product)}
                        className="px-4 py-2.5 rounded-xl border border-border font-700 text-sm hover:bg-muted"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProduct(product)}
                        className="px-4 py-2.5 rounded-xl border border-red-500/20 text-red-600 font-700 text-sm hover:bg-red-500/10"
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
