'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import PasswordlessAuth from '@/components/auth/PasswordlessAuth';
import {
  getSignedUrls,
  uploadSubmissionImage,
  deleteSubmissionImage,
  validateImageFile,
} from '@/lib/submissionImages';

interface Submission {
  id: string;
  product_name: string;
  category: string;
  expected_price: number;
  quantity: number;
  condition: string;
  status: string;
  admin_note: string | null;
  image_urls: string[] | null;
  created_at: string;
  reviewed_at: string | null;
  brand?: string | null;
  description?: string | null;
  city?: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

interface SubmissionView extends Submission {
  displayUrls: string[];
}

interface EditImageState {
  file?: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  path?: string;
  existingPath: string;
  error?: string;
}

interface EditForm {
  productName: string;
  category: string;
  brand: string;
  condition: string;
  expectedPrice: string;
  quantity: string;
  description: string;
  city: string;
}

const CONDITIONS = ['New', 'Like New', 'Used'];
const MAX_IMAGES = 5;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending Review', color: 'text-warning', bg: 'bg-warning/10' },
  approved: { label: 'Approved', color: 'text-success', bg: 'bg-success/10' },
  rejected: { label: 'Rejected', color: 'text-red-500', bg: 'bg-red-500/10' },
};

export default function SubmissionsPage() {
  const { user, loading: authLoading, loggedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<SubmissionView[]>([]);

  const [editing, setEditing] = useState<Submission | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    productName: '',
    category: '',
    brand: '',
    condition: 'New',
    expectedPrice: '',
    quantity: '1',
    description: '',
    city: '',
  });
  const [editImages, setEditImages] = useState<EditImageState[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadSubmissions = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading submissions:', error);
    }

    const rows = (data as Submission[]) || [];

    const views: SubmissionView[] = [];
    for (const row of rows) {
      const paths = Array.isArray(row.image_urls) ? row.image_urls : [];
      const displayUrls = await getSignedUrls(paths);
      views.push({ ...row, image_urls: paths, displayUrls });
    }

    setSubmissions(views);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      loadSubmissions(user.id);
    } else {
      setSubmissions([]);
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (editing) {
      const loadCategories = async () => {
        const { data } = await supabase
          .from('categories')
          .select('name')
          .eq('active', true)
          .order('name', { ascending: true });
        if (data) setCategories(data.map((c) => c.name));
      };
      loadCategories();
    }
  }, [editing]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const startEdit = (sub: Submission) => {
    setEditForm({
      productName: sub.product_name,
      category: sub.category,
      brand: sub.brand || '',
      condition: CONDITIONS.includes(sub.condition) ? sub.condition : 'New',
      expectedPrice: String(sub.expected_price),
      quantity: String(sub.quantity),
      description: sub.description || '',
      city: sub.city || '',
    });
    setEditImages(
      (sub.image_urls || []).map((p) => ({
        preview: '',
        uploading: false,
        uploaded: true,
        existingPath: p,
        path: p,
      }))
    );
    setEditError('');
    setEditing(sub);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm({
      productName: '',
      category: '',
      brand: '',
      condition: 'New',
      expectedPrice: '',
      quantity: '1',
      description: '',
      city: '',
    });
    setEditImages([]);
    setEditError('');
  };

  const handleEditImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: EditImageState[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateImageFile(file);
      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        uploaded: false,
        existingPath: '',
        error: error || undefined,
      });
    }

    setEditImages((prev) => {
      const combined = [...prev, ...newImages];
      return combined.slice(0, MAX_IMAGES);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeEditImage = useCallback((index: number) => {
    setEditImages((prev) => {
      const img = prev[index];
      if (img.preview) URL.revokeObjectURL(img.preview);
      if (img.path && !img.existingPath) {
        deleteSubmissionImage(img.path);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const saveEdit = async () => {
    if (!user || !editing) return;
    setEditError('');

    const name = editForm.productName.trim();
    if (!name || name.length > 150) {
      setEditError('Product name is required (max 150 characters).');
      return;
    }
    if (!editForm.category) {
      setEditError('Please select a category.');
      return;
    }
    if (editForm.expectedPrice === '' || Number(editForm.expectedPrice) < 0) {
      setEditError('Please enter a valid price.');
      return;
    }
    const qty = Number(editForm.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setEditError('Quantity must be at least 1.');
      return;
    }
    if (!CONDITIONS.includes(editForm.condition)) {
      setEditError('Please select a valid condition.');
      return;
    }
    const desc = editForm.description.trim();
    if (!desc || desc.length < 10 || desc.length > 2000) {
      setEditError('Description must be between 10 and 2000 characters.');
      return;
    }

    const validImages = editImages.filter((img) => !img.error);
    if (validImages.length === 0) {
      setEditError('Please add at least one product image.');
      return;
    }

    setEditSaving(true);

    try {
      const finalImages: string[] = [];
      for (const img of validImages) {
        if (img.uploaded && img.path) {
          finalImages.push(img.path);
        } else if (img.file && user) {
          const result = await uploadSubmissionImage(img.file, user.id);
          if ('error' in result) {
            setEditError('Some images failed to upload. Please remove them and try again.');
            setEditSaving(false);
            return;
          }
          finalImages.push(result.path);
        }
      }

      const { error } = await supabase
        .from('product_submissions')
        .update({
          product_name: name,
          category: editForm.category,
          brand: editForm.brand.trim() || null,
          condition: editForm.condition,
          expected_price: Number(editForm.expectedPrice),
          quantity: qty,
          description: desc,
          city: editForm.city.trim() || null,
          image_urls: finalImages,
        })
        .eq('id', editing.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Update error:', error);
        setEditError('Failed to save changes. Please try again.');
        setEditSaving(false);
        return;
      }

      cancelEdit();
      await loadSubmissions(user.id);
    } catch (err) {
      console.error('Update exception:', err);
      setEditError('An unexpected error occurred.');
      setEditSaving(false);
    }
  };

  const handleDelete = async (sub: Submission) => {
    if (!user) return;
    setDeleting(sub.id);

    try {
      if (sub.image_urls && sub.image_urls.length > 0) {
        await Promise.all(sub.image_urls.map((path) => deleteSubmissionImage(path)));
      }

      const { error } = await supabase
        .from('product_submissions')
        .delete()
        .eq('id', sub.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Delete error:', error);
      }

      await loadSubmissions(user.id);
    } catch (err) {
      console.error('Delete exception:', err);
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pb-24 lg:pb-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Loading submissions...</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pb-24 lg:pb-0">
          <div className="max-w-lg mx-auto px-4 sm:px-6">
            <div className="bg-card rounded-3xl card-shadow p-6 md:p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Icon name="DocumentTextIcon" size={32} className="text-primary" />
              </div>
              <h1 className="text-2xl font-800 mb-3">My Submissions</h1>
              <p className="text-sm text-muted-foreground mb-8">
                Sign in to view your product submissions.
              </p>
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="btn-primary px-8 py-3 w-full"
              >
                Continue with Google
              </button>
              <Link
                href="/account"
                className="block mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to Account
              </Link>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
        {showAuth && (
          <PasswordlessAuth
            onClose={() => setShowAuth(false)}
            onAuthenticated={() => setShowAuth(false)}
            returnTo="/account/submissions"
          />
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pb-24 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <Icon name="ArrowLeftIcon" size={20} className="text-muted-foreground" />
                </button>
                <div>
                  <h1 className="text-xl md:text-2xl font-800">Edit Submission</h1>
                  <p className="text-sm text-muted-foreground">Update your product details</p>
                </div>
              </div>
            </div>

            <section className="bg-card rounded-2xl card-shadow p-5 mb-4">
              <h2 className="text-sm font-800 text-foreground mb-4 flex items-center gap-2">
                <Icon name="TagIcon" size={18} className="text-primary" />
                Product Details
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.productName}
                    onChange={(e) => setEditForm((f) => ({ ...f, productName: e.target.value }))}
                    maxLength={150}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Category *
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors appearance-none"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={editForm.brand}
                    onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Condition *
                  </label>
                  <div className="flex gap-2">
                    {CONDITIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditForm((f) => ({ ...f, condition: c }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-600 border transition-colors ${
                          editForm.condition === c
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                      Price (Rs.) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.expectedPrice}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, expectedPrice: e.target.value }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Description * <span className="opacity-60">(10–2000 characters)</span>
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    {editForm.description.length}/2000
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </div>
            </section>

            <section className="bg-card rounded-2xl card-shadow p-5 mb-4">
              <h2 className="text-sm font-800 text-foreground mb-4 flex items-center gap-2">
                <Icon name="PhotoIcon" size={18} className="text-primary" />
                Product Images *{' '}
                <span className="opacity-60">
                  ({editImages.filter((i) => !i.error).length}/{MAX_IMAGES})
                </span>
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
                {editImages.map((img, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted group"
                  >
                    {img.preview ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={img.preview}
                        alt={`Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : img.path ? (
                      <ExistingImage path={img.path} />
                    ) : null}
                    {img.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                    {img.error && (
                      <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center p-1">
                        <p className="text-white text-[9px] font-600 text-center leading-tight">
                          {img.error}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeEditImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon name="XMarkIcon" size={14} className="text-white" />
                    </button>
                  </div>
                ))}
                {editImages.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <Icon name="PlusIcon" size={22} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-600">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                onChange={handleEditImageSelect}
                className="hidden"
              />
            </section>

            {editError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-600 font-600">{editError}</p>
              </div>
            )}

            <div className="flex gap-3 pb-8">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={editSaving}
                className="flex-1 py-3 rounded-xl bg-muted font-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className="btn-primary flex-1 py-3 text-sm disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/account" className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors">
              <Icon name="ArrowLeftIcon" size={20} className="text-muted-foreground" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-800">My Submissions</h1>
              <p className="text-sm text-muted-foreground">Track your product submissions</p>
            </div>
            <Link href="/account/send-product" className="btn-primary px-4 py-2.5 text-sm">
              + New
            </Link>
          </div>

          {submissions.length === 0 ? (
            <div className="bg-card rounded-3xl card-shadow p-8 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Icon name="InboxIcon" size={28} className="text-muted-foreground" />
              </div>
              <h2 className="font-800 mb-2">No Products Submitted Yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Submit your first product for review.
              </p>
              <Link href="/account/send-product" className="btn-primary px-6 py-3 inline-block">
                Send Your Product
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => {
                const status = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
                const images = sub.displayUrls || [];
                const isPending = sub.status === 'pending';
                const isDeletingThis = deleting === sub.id;
                const showDeleteConfirm = deleteConfirm === sub.id;

                return (
                  <div key={sub.id} className="bg-card rounded-2xl card-shadow p-4 md:p-5">
                    <div className="flex gap-3">
                      {images.length > 0 && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={images[0]}
                            alt={sub.product_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-700 text-sm truncate">{sub.product_name}</h3>
                          <span
                            className={`shrink-0 text-[10px] font-700 px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{sub.category}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sub.condition}</p>
                        <p className="text-xs font-700 text-foreground mt-1">
                          Rs. {Number(sub.expected_price).toLocaleString()}
                          {sub.quantity > 1 && ` × ${sub.quantity}`}
                        </p>
                      </div>
                    </div>

                    {sub.admin_note && (
                      <div className="mt-3 p-3 rounded-xl bg-muted/50">
                        <p className="text-[10px] font-700 text-muted-foreground uppercase mb-1">
                          Admin Note
                        </p>
                        <p className="text-xs text-foreground">{sub.admin_note}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <p className="text-[11px] text-muted-foreground">
                        Submitted {formatDate(sub.created_at)}
                      </p>
                      {sub.reviewed_at && (
                        <p className="text-[11px] text-muted-foreground">
                          Reviewed {formatDate(sub.reviewed_at)}
                        </p>
                      )}
                    </div>

                    {isPending && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(sub)}
                          disabled={isDeletingThis}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-700 hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          <Icon name="PencilIcon" size={13} />
                          Edit
                        </button>
                        {showDeleteConfirm ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600 font-600">Delete?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(sub)}
                              disabled={isDeletingThis}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-700 disabled:opacity-50"
                            >
                              {isDeletingThis ? '...' : 'Yes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              disabled={isDeletingThis}
                              className="px-3 py-1.5 rounded-lg bg-muted text-xs font-700 disabled:opacity-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(sub.id)}
                            disabled={isDeletingThis}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <Icon name="TrashIcon" size={13} />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />

      {showAuth && (
        <PasswordlessAuth
          onClose={() => setShowAuth(false)}
          onAuthenticated={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}

function ExistingImage({ path }: { path: string }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    getSignedUrls([path]).then((urls) => {
      if (active && urls[0]) setSrc(urls[0]);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!src) {
    return <div className="w-full h-full bg-muted animate-pulse" />;
  }

  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt="" className="w-full h-full object-cover" />;
}
