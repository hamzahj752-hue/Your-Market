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
import NepalPhoneInput from '@/components/NepalPhoneInput';
import { normalizeNepalMobile, toCanonicalNepalMobile } from '@/lib/nepalPhone';
import {
  uploadSubmissionImage,
  deleteSubmissionImage,
  validateImageFile,
} from '@/lib/submissionImages';

interface ImagePreview {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  path?: string;
  error?: string;
}

const CONDITIONS = ['New', 'Like New', 'Used'];
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function SendProductPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, loading: authLoading, loggedIn, profile } = useAuth();

  const [showAuth, setShowAuth] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const [form, setForm] = useState({
    productName: '',
    category: '',
    brand: '',
    condition: 'New',
    expectedPrice: '',
    quantity: '1',
    description: '',
    city: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });

  const [images, setImages] = useState<ImagePreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState('');

  const WIZARD_STEPS = [
    { n: 1, label: 'Your Details' },
    { n: 2, label: 'Product' },
    { n: 3, label: 'Photos' },
    { n: 4, label: 'Review' },
  ];

  // Per-step validation for the wizard. Returns an error message or ''.
  const validateStep = (s: number): string => {
    if (s === 1) {
      if (!form.customerName.trim() || form.customerName.trim().length > 100) {
        return 'Please enter your full name (max 100 characters).';
      }
      if (
        !form.customerEmail.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())
      ) {
        return 'Please enter a valid email address.';
      }
      const phoneCanonical = toCanonicalNepalMobile(form.customerPhone.trim());
      if (!phoneCanonical || !normalizeNepalMobile(form.customerPhone.trim())) {
        return 'Enter a valid 10-digit Nepal mobile number.';
      }
      return '';
    }
    if (s === 2) {
      if (!form.productName.trim() || form.productName.trim().length > 150) {
        return 'Please enter a product name (max 150 characters).';
      }
      if (!form.category) {
        return 'Please select a category.';
      }
      if (form.expectedPrice === '' || Number(form.expectedPrice) < 0) {
        return 'Please enter a valid price (0 or greater).';
      }
      const qty = Number(form.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        return 'Quantity must be a whole number of 1 or more.';
      }
      if (!CONDITIONS.includes(form.condition)) {
        return 'Please select a valid product condition.';
      }
      const desc = form.description.trim();
      if (!desc || desc.length < 10 || desc.length > 2000) {
        return 'Description must be between 10 and 2000 characters.';
      }
      return '';
    }
    if (s === 3) {
      const validImages = images.filter((img) => !img.error);
      if (validImages.length === 0) {
        return 'Please add at least one product image.';
      }
      if (validImages.length > MAX_IMAGES) {
        return `You can add at most ${MAX_IMAGES} images.`;
      }
      if (images.some((img) => img.error)) {
        return 'Some images are invalid. Please remove them before continuing.';
      }
      return '';
    }
    return '';
  };

  const goNext = () => {
    setStepError('');
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => {
    setStepError('');
    setStep((s) => Math.max(1, s - 1));
  };

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        customerName: profile.name,
        customerEmail: profile.email,
        customerPhone: profile.phone ? profile.phone.replace(/^\+?977/, '') : prev.customerPhone,
        city: user.user_metadata?.city || prev.city,
      }));
    }
  }, [user, profile.name, profile.email, profile.phone]);

  useEffect(() => {
    const loadCategories = async () => {
      const { data: catData } = await supabase
        .from('categories')
        .select('name')
        .eq('active', true)
        .order('name', { ascending: true });
      if (catData) {
        setCategories(catData.map((c) => c.name));
      }
    };
    loadCategories();
  }, []);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: ImagePreview[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateImageFile(file);
      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        uploaded: false,
        error: error || undefined,
      });
    }

    setImages((prev) => {
      const combined = [...prev, ...newImages];
      return combined.slice(0, MAX_IMAGES);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeImage = useCallback(async (index: number) => {
    setImages((prev) => {
      const img = prev[index];
      if (img.preview) URL.revokeObjectURL(img.preview);
      if (img.path) {
        deleteSubmissionImage(img.path);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const uploadAllImages = async (): Promise<ImagePreview[]> => {
    if (!user) return images;
    const results = await Promise.all(
      images.map(async (img) => {
        if (img.uploaded && img.path) return img;
        if (img.error) return img;

        const result = await uploadSubmissionImage(img.file, user.id);
        if ('error' in result) {
          return { ...img, uploading: false, error: result.error };
        }
        return {
          ...img,
          uploading: false,
          uploaded: true,
          path: result.path,
        };
      })
    );
    return results;
  };

  const handleSubmit = async () => {
    setSubmitError('');

    if (!loggedIn || !user) {
      setSubmitError('Please sign in to submit a product.');
      return;
    }

    const name = form.customerName.trim();
    if (!name || name.length > 100) {
      setSubmitError('Please enter your full name (max 100 characters).');
      return;
    }

    const email = form.customerEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError('Please enter a valid email address.');
      return;
    }

    const phoneRaw = form.customerPhone.trim();
    const phoneCanonical = toCanonicalNepalMobile(phoneRaw);
    if (!phoneCanonical || !normalizeNepalMobile(phoneRaw)) {
      setSubmitError('Enter a valid 10-digit Nepal mobile number.');
      return;
    }
    const phone = phoneCanonical;

    if (!form.productName.trim() || form.productName.trim().length > 150) {
      setSubmitError('Please enter a product name (max 150 characters).');
      return;
    }
    if (!form.category) {
      setSubmitError('Please select a category.');
      return;
    }
    if (form.expectedPrice === '' || Number(form.expectedPrice) < 0) {
      setSubmitError('Please enter a valid price (0 or greater).');
      return;
    }
    const qty = Number(form.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setSubmitError('Quantity must be a whole number of 1 or more.');
      return;
    }
    if (!CONDITIONS.includes(form.condition)) {
      setSubmitError('Please select a valid product condition.');
      return;
    }
    const desc = form.description.trim();
    if (!desc || desc.length < 10 || desc.length > 2000) {
      setSubmitError('Description must be between 10 and 2000 characters.');
      return;
    }

    const validImages = images.filter((img) => !img.error);
    if (validImages.length === 0) {
      setSubmitError('Please add at least one product image.');
      return;
    }

    setSubmitting(true);

    try {
      const uploadedImages = await uploadAllImages();
      const hasUploadErrors = uploadedImages.some((img) => img.error);
      if (hasUploadErrors) {
        setImages(uploadedImages);
        setSubmitError('Some images failed to upload. Please remove them and try again.');
        setSubmitting(false);
        return;
      }

      const imageUrls = uploadedImages.filter((img) => img.path).map((img) => img.path as string);

      const { error } = await supabase.from('product_submissions').insert({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        product_name: form.productName.trim(),
        category: form.category,
        brand: form.brand.trim() || null,
        condition: form.condition,
        expected_price: Number(form.expectedPrice),
        quantity: qty,
        description: desc,
        city: form.city.trim() || null,
        image_urls: imageUrls,
      });

      if (error) {
        console.error('Submission error:', error);
        for (const img of uploadedImages) {
          if (img.path) {
            deleteSubmissionImage(img.path);
          }
        }
        setSubmitError('Failed to submit. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Submit exception:', err);
      setSubmitError('An unexpected error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-28 pb-20 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Loading...</p>
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
        <main className="flex-1 pt-28 pb-20">
          <div className="max-w-lg mx-auto px-4 sm:px-6">
            <div className="bg-card rounded-3xl card-shadow p-6 md:p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Icon name="PaperAirplaneIcon" size={32} className="text-primary" />
              </div>
              <h1 className="text-2xl font-800 mb-2">Send Your Product</h1>
              <p className="text-muted-foreground text-sm mb-2">Earn with YourMarket</p>
              <p className="text-sm text-muted-foreground mb-8">
                Sign in to submit your product for review. YourMarket will review the details before
                the product can be published.
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
            returnTo="/account/send-product"
          />
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-28 pb-20">
          <div className="max-w-lg mx-auto px-4 sm:px-6">
            <div className="bg-card rounded-3xl card-shadow p-6 md:p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-5">
                <Icon name="CheckCircleIcon" size={36} className="text-success" />
              </div>
              <h1 className="text-2xl font-800 mb-3">Product Submitted for Review</h1>
              <p className="text-sm text-muted-foreground mb-2">
                Thank you for your submission! YourMarket will review the details before the product
                can be published.
              </p>
              <p className="text-xs text-muted-foreground mb-8">
                Submission does not guarantee approval. Your product is not publicly listed until
                reviewed and approved by an admin.
              </p>
              <div className="flex flex-col gap-3">
                <Link href="/account/submissions" className="btn-primary py-3 text-center">
                  View My Submissions
                </Link>
                <Link href="/" className="btn-outline py-3 text-center">
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  const hasImageErrors = images.some((img) => img.error);
  const isUploading = images.some((img) => img.uploading);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 pt-28 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/account"
                className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
              >
                <Icon name="ArrowLeftIcon" size={20} className="text-muted-foreground" />
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-800">Send Your Product</h1>
                <p className="text-sm text-muted-foreground">Earn with YourMarket</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground ml-11">
              Fill in the details below. YourMarket will review before publishing.
            </p>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              {WIZARD_STEPS.map((s) => (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => {
                    if (s.n < step) {
                      setStepError('');
                      setStep(s.n);
                    } else if (s.n === step) {
                      return;
                    } else {
                      goNext();
                    }
                  }}
                  className={`flex-1 text-center text-[11px] font-700 transition-colors ${
                    step === s.n ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <span
                    className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-800 border-2 transition-colors ${
                      step > s.n
                        ? 'bg-primary border-primary text-primary-foreground'
                        : step === s.n
                          ? 'border-primary text-primary'
                          : 'border-border text-muted-foreground'
                    }`}
                  >
                    {step > s.n ? '✓' : s.n}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
              />
            </div>
          </div>

          {stepError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm text-red-600 font-600">{stepError}</p>
            </div>
          )}

          {step === 1 && (
            <section className="bg-card rounded-2xl card-shadow p-5 mb-4">
              <h2 className="text-sm font-800 text-foreground mb-1 flex items-center gap-2">
                <Icon name="UserIcon" size={18} className="text-primary" />
                Your Information
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Your contact information is used so YourMarket can reach you about your submitted
                product.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => updateField('customerName', e.target.value)}
                    placeholder="Your full name"
                    maxLength={100}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => updateField('customerEmail', e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Phone / Mobile Number *
                  </label>
                  <NepalPhoneInput
                    value={form.customerPhone}
                    onChange={(local) => updateField('customerPhone', local)}
                    placeholder="98XXXXXXXX"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Nepal mobile number. Used only to contact you about this submission. Not
                    verified.
                  </p>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
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
                    value={form.productName}
                    onChange={(e) => updateField('productName', e.target.value)}
                    placeholder="e.g. Samsung Galaxy S24"
                    maxLength={150}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
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
                    value={form.brand}
                    onChange={(e) => updateField('brand', e.target.value)}
                    placeholder="e.g. Samsung, Apple"
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
                        onClick={() => updateField('condition', c)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-600 border transition-colors ${
                          form.condition === c
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
                      value={form.expectedPrice}
                      onChange={(e) => updateField('expectedPrice', e.target.value)}
                      placeholder="0.00"
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
                      value={form.quantity}
                      onChange={(e) => updateField('quantity', e.target.value)}
                      placeholder="1"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    Description * <span className="opacity-60">(10–2000 characters)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Describe your product, its features, and condition..."
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    {form.description.length}/2000
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="e.g. Kathmandu, Pokhara"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="bg-card rounded-2xl card-shadow p-5 mb-4">
              <h2 className="text-sm font-800 text-foreground mb-4 flex items-center gap-2">
                <Icon name="PhotoIcon" size={18} className="text-primary" />
                Product Images *{' '}
                <span className="opacity-60">
                  ({images.filter((i) => !i.error).length}/{MAX_IMAGES})
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Add up to {MAX_IMAGES} images. JPG, PNG, or WEBP, max{' '}
                {MAX_IMAGE_SIZE / (1024 * 1024)}
                MB each.
              </p>

              <div className="grid grid-cols-3 gap-2.5">
                {images.map((img, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.preview}
                      alt={`Product ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
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
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon name="XMarkIcon" size={14} className="text-white" />
                    </button>
                  </div>
                ))}

                {images.length < MAX_IMAGES && (
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
                onChange={handleImageSelect}
                className="hidden"
              />
            </section>
          )}

          {step === 4 && (
            <section className="bg-card rounded-2xl card-shadow p-5 mb-4">
              <h2 className="text-sm font-800 text-foreground mb-4 flex items-center gap-2">
                <Icon name="CheckCircleIcon" size={18} className="text-primary" />
                Review & Submit
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Review your details below before submitting for YourMarket review.
              </p>
              <dl className="space-y-3 text-sm">
                <ReviewRow label="Full Name" value={form.customerName} />
                <ReviewRow label="Email" value={form.customerEmail} />
                <ReviewRow
                  label="Phone"
                  value={toCanonicalNepalMobile(form.customerPhone.trim()) || form.customerPhone}
                />
                <ReviewRow label="Product" value={form.productName} />
                <ReviewRow label="Category" value={form.category} />
                <ReviewRow label="Brand" value={form.brand} />
                <ReviewRow label="Condition" value={form.condition} />
                <ReviewRow label="Price" value={`Rs. ${Number(form.expectedPrice).toFixed(2)}`} />
                <ReviewRow label="Quantity" value={form.quantity} />
                <ReviewRow label="City" value={form.city || '—'} />
                <ReviewRow
                  label="Images"
                  value={`${images.filter((i) => !i.error).length} image(s)`}
                />
                <ReviewRow label="Description" value={form.description} />
              </dl>
            </section>
          )}

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-600 font-600">{submitError}</p>
            </div>
          )}

          <div className="pb-8">
            {step > 1 && step < 4 && (
              <button
                type="button"
                onClick={goBack}
                className="w-full py-3 text-sm font-700 rounded-full border border-border bg-card text-foreground mb-3 transition-colors hover:bg-muted inline-flex items-center justify-center"
              >
                Back
              </button>
            )}

            {step < 4 && (
              <button type="button" onClick={goNext} className="btn-primary w-full py-3.5 text-sm">
                Continue
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || isUploading || hasImageErrors}
                className="btn-primary w-full py-3.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Submit for Review'
                )}
              </button>
            )}

            <p className="text-xs text-muted-foreground text-center mt-3">
              Your submission will be reviewed by YourMarket before publishing.
            </p>
          </div>
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border last:border-0 pb-2 last:pb-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right font-600 text-foreground break-words">{value || '—'}</dd>
    </div>
  );
}
