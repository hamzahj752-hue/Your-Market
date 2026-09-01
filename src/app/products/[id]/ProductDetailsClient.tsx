'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { supabase } from '@/lib/supabase';

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  content: string;
  author_name?: string | null;
  created_at: string;
  verified_purchase?: boolean;
  is_edited?: boolean;
  moderation_status?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  alt: string;
  category: string;
  rating: number;
  reviews: number;
  discount?: number;
  badge?: string;
  variant?: string;
  brand: string;
  inStock: boolean;
  description?: string;
  sku?: string;
  stockQuantity?: number;
}

export default function ProductDetailsClient({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [gallery, setGallery] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState('');
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [authChecking, setAuthChecking] = useState(true);

  const [qty, setQty] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const router = useRouter();

  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const maxQty = product?.stockQuantity && product.stockQuantity > 0 ? product.stockQuantity : 99;
  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const allImages = useMemo(() => {
    const imgs: string[] = [];
    if (product?.image) imgs.push(product.image);
    for (const url of gallery) {
      if (url && !imgs.includes(url)) imgs.push(url);
    }
    return imgs;
  }, [product?.image, gallery]);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setLoadError('');

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('active', true)
        .maybeSingle();

      if (error && error.code === 'PGRST116') {
        setLoadError('This product is not available.');
        setLoading(false);
        return;
      }
      if (error || !data) {
        console.error('Supabase product detail error:', error);
        setLoadError('Unable to load product. Please try again.');
        setLoading(false);
        return;
      }

      const mappedProduct: Product = {
        id: data.id,
        name: data.name,
        price: Number(data.price),
        originalPrice: data.original_price != null ? Number(data.original_price) : undefined,
        image: data.image,
        alt: data.alt,
        category: data.category,
        rating: Number(data.rating),
        reviews: Number(data.reviews),
        discount: data.discount != null ? Number(data.discount) : undefined,
        badge: data.badge ?? undefined,
        variant: data.variant ?? undefined,
        brand: data.brand,
        inStock: Boolean(data.in_stock),
        description: data.description ?? undefined,
        sku: data.sku ?? undefined,
        stockQuantity: data.stock_quantity != null ? Number(data.stock_quantity) : undefined,
      };

      setProduct(mappedProduct);
      setActiveImage(0);

      const { data: imagesData, error: imagesError } = await supabase
        .from('product_images')
        .select('url')
        .eq('product_id', id)
        .order('sort_order', { ascending: true });

      if (!imagesError && imagesData && imagesData.length > 0) {
        setGallery(imagesData.map((row) => row.url));
      }

      setLoading(false);
    }

    loadProduct();
  }, [id]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (user) {
          setCurrentUser({
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your Market User',
            email: user.email || '',
          });
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      }
      setAuthChecking(false);
    };

    const loadReviews = async () => {
      setReviewsLoading(true);
      setReviewsError('');

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase reviews error:', error);
        setReviewsError('Unable to load reviews. Please try again.');
        setReviewsLoading(false);
        return;
      }

      setReviews((data ?? []) as Review[]);
      setReviewsLoading(false);
    };

    loadCurrentUser();
    loadReviews();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function loadRelated() {
      if (!product) return;
      setRelatedLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category', product.category)
        .neq('id', product.id)
        .eq('active', true)
        .limit(8);
      if (cancelled) return;
      if (!error && data) {
        const mapped: Product[] = data.map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
          image: p.image,
          alt: p.alt,
          category: p.category,
          rating: Number(p.rating),
          reviews: Number(p.reviews),
          discount: p.discount != null ? Number(p.discount) : undefined,
          badge: p.badge ?? undefined,
          variant: p.variant ?? undefined,
          brand: p.brand,
          inStock: Boolean(p.in_stock),
        }));
        setRelatedProducts(mapped);
      } else {
        setRelatedProducts([]);
      }
      setRelatedLoading(false);
    }
    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category]);

  const handleStartEdit = (review: Review) => {
    setEditingReviewId(review.id);
    setEditRating(review.rating);
    setEditTitle(review.title || '');
    setEditContent(review.content);
    setEditError('');
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setEditError('');
  };

  const handleSaveEdit = async (reviewId: string) => {
    setEditError('');
    if (!editRating || editRating < 1 || editRating > 5) {
      setEditError('Please select a star rating (1–5).');
      return;
    }
    if (!editContent.trim()) {
      setEditError('Please write a short review.');
      return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from('reviews')
      .update({
        rating: editRating,
        title: editTitle.trim() || null,
        content: editContent.trim(),
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .eq('user_id', currentUser?.id);

    if (error) {
      setEditError(error.message || 'Unable to update review.');
      setEditSaving(false);
      return;
    }

    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              rating: editRating,
              title: editTitle.trim() || null,
              content: editContent.trim(),
              is_edited: true,
              updated_at: new Date().toISOString(),
            }
          : r
      )
    );
    setEditingReviewId(null);
    setEditSaving(false);
  };

  const addToCartWithQty = () => {
    if (!product) return;
    for (let i = 0; i < qty; i += 1) {
      addToCart({ ...product });
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewFormError('');
    setReviewSuccess('');

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      setReviewFormError('Please select a star rating (1–5).');
      return;
    }
    if (!reviewContent.trim()) {
      setReviewFormError('Please write a short review.');
      return;
    }

    setReviewSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setReviewFormError('Please login before submitting a review.');
      setReviewSubmitting(false);
      router.push('/account');
      return;
    }

    const newReview = {
      product_id: id,
      user_id: user.id,
      rating: reviewRating,
      title: reviewTitle.trim() || null,
      content: reviewContent.trim(),
      author_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your Market User',
    };

    const { data, error } = await supabase.from('reviews').insert(newReview).select().single();

    if (error) {
      if (
        error.code === '23505' ||
        /duplicate key value violates unique constraint/.test(error.message)
      ) {
        setReviewFormError('You have already reviewed this product.');
      } else {
        setReviewFormError('Unable to submit review. Please try again.');
      }
      setReviewSubmitting(false);
      return;
    }

    setReviews((prev) => [data as Review, ...prev]);
    setReviewRating(0);
    setReviewTitle('');
    setReviewContent('');
    setReviewSuccess('Thank you! Your review has been submitted and will appear once approved.');
    setReviewSubmitting(false);
  };

  const handleRemoveReview = async (review: Review) => {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', review.id)
      .eq('user_id', currentUser?.id);

    if (error) {
      setReviewsError('Unable to delete your review. Please try again.');
      return;
    }

    setReviews((prev) => prev.filter((r) => r.id !== review.id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">Loading product...</p>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (loadError || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-800 mb-3">Product not found</h1>
            <p className="text-muted-foreground mb-5">
              {loadError || 'This product does not exist.'}
            </p>
            <Link href="/products" className="btn-primary">
              Browse Products
            </Link>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 sm:pt-24 lg:pt-28 pb-44 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
          >
            <Icon name="ArrowLeftIcon" size={16} />
            Back to Products
          </Link>

          <div className="grid lg:grid-cols-2 gap-8 bg-card rounded-3xl p-5 md:p-8 card-shadow">
            <div>
              <div className="relative min-h-[320px] sm:min-h-[360px] md:min-h-[480px] lg:min-h-[520px] rounded-2xl overflow-hidden bg-muted/30">
                <AppImage
                  src={allImages[activeImage] || allImages[0] || product.image}
                  alt={product.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain"
                  objectFit="contain"
                  priority
                />
              </div>

              {allImages.length > 1 && (
                <div className="flex gap-2.5 mt-3 overflow-x-auto scrollbar-hide pb-1">
                  {allImages.map((img, idx) => (
                    <button
                      key={`${idx}-${img}`}
                      type="button"
                      onClick={() => setActiveImage(idx)}
                      className={`relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-muted/30 border-2 transition-colors ${
                        activeImage === idx ? 'border-primary' : 'border-transparent'
                      }`}
                      aria-label={`View image ${idx + 1}`}
                    >
                      <AppImage src={img} alt="" fill sizes="96px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center">
              <p className="text-xs uppercase tracking-widest font-700 text-muted-foreground">
                {product.category} · {product.brand}
              </p>

              <h1 className="text-3xl md:text-4xl font-800 text-foreground mt-2 leading-tight">
                {product.name}
              </h1>

              {product.reviews > 0 && (
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-yellow-500">★</span>
                  <b>{product.rating}</b>
                  <span className="text-muted-foreground">
                    ({product.reviews.toLocaleString()} reviews)
                  </span>
                </div>
              )}

              <p className="text-muted-foreground leading-relaxed mt-5">
                {product.description || 'No description available.'}
              </p>

              {product.sku && (
                <p className="text-xs text-muted-foreground mt-4">
                  SKU: <span className="font-600">{product.sku}</span>
                </p>
              )}

              <div className="flex items-baseline gap-3 mt-6">
                <span className="text-3xl font-900 price-deal">
                  रू{product.price.toLocaleString()}
                </span>

                {product.originalPrice && (
                  <span className="price-original">रू{product.originalPrice.toLocaleString()}</span>
                )}
              </div>

              <p className="text-sm text-green-600 font-700 mt-2">
                {product.inStock ? 'In stock · Ready to order' : 'Currently out of stock'}
              </p>

              <div className="flex items-center gap-4 mt-7">
                <div className="flex items-center gap-2 border border-border rounded-xl px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="quantity-btn"
                    aria-label="Decrease quantity"
                    disabled={qty <= 1}
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-800">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    className="quantity-btn"
                    aria-label="Increase quantity"
                    disabled={qty >= maxQty}
                  >
                    +
                  </button>
                </div>

                <button
                  disabled={!product.inStock || qty > maxQty}
                  onClick={addToCartWithQty}
                  className="btn-primary flex-1 justify-center disabled:opacity-50 hidden sm:inline-flex"
                >
                  <Icon name="ShoppingCartIcon" size={18} />
                  Add to Cart ({qty})
                </button>

                <button
                  onClick={() => toggleWishlist(product)}
                  className="w-12 rounded-xl border border-border flex items-center justify-center hover:bg-muted"
                  aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Icon
                    name="HeartIcon"
                    variant={isInWishlist(product.id) ? 'solid' : 'outline'}
                    size={21}
                    className={isInWishlist(product.id) ? 'text-red-500' : ''}
                  />
                </button>
              </div>

              <Link
                href="/cart"
                className="mt-3 text-center text-sm text-primary font-700 hover:underline"
              >
                Go to Cart →
              </Link>
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <section className="mt-10">
              <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
                <h2 className="text-2xl font-800 mb-6">You may also like</h2>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                  {relatedProducts.map((rel) => (
                    <Link
                      key={rel.id}
                      href={`/products/${rel.id}`}
                      className="flex-shrink-0 w-44 group"
                    >
                      <div className="bg-muted/30 rounded-xl overflow-hidden product-card-hover">
                        <div className="relative h-32 overflow-hidden bg-muted/30">
                          <AppImage
                            src={rel.image}
                            alt={rel.alt}
                            fill
                            sizes="176px"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="p-2.5 bg-white">
                          <p className="text-xs font-700 text-foreground line-clamp-2 leading-snug mb-1">
                            {rel.name}
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-800 price-deal">
                              रू{rel.price.toLocaleString()}
                            </span>
                            {rel.originalPrice && (
                              <span className="price-original text-xs">
                                रू{rel.originalPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {rel.inStock ? 'In stock' : 'Out of stock'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Reviews */}
          <section className="mt-10">
            <div className="bg-card rounded-3xl card-shadow p-5 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-800">Customer Reviews</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} for{' '}
                    {product.name}
                  </p>
                </div>

                {avgRating && (
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-500">★</span>
                    <b>{avgRating}</b>
                    <span className="text-muted-foreground text-sm">average rating</span>
                  </div>
                )}
              </div>

              {reviewsError && (
                <div className="flex items-start gap-3 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm font-600 mb-5">
                  <Icon name="ExclamationTriangleIcon" size={18} />
                  <span>{reviewsError}</span>
                </div>
              )}

              {reviewsLoading ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  Loading reviews...
                </div>
              ) : reviews.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-border rounded-2xl">
                  <Icon
                    name="ChatBubbleLeftRightIcon"
                    size={40}
                    className="mx-auto mb-3 text-muted-foreground/40"
                  />
                  <h3 className="font-800 text-lg mb-1">No reviews yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Be the first to share your thoughts on this product.
                  </p>
                </div>
              ) : (
                <ul className="space-y-5">
                  {reviews.map((review) => (
                    <li key={review.id} className="border border-border rounded-2xl p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="font-800 text-primary uppercase">
                              {review.author_name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-800 text-sm">
                                {review.author_name || 'Anonymous'}
                              </p>
                              {review.verified_purchase && (
                                <span className="text-[10px] font-800 bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <Icon name="CheckBadgeIcon" size={11} />
                                  Verified Purchase
                                </span>
                              )}
                              {review.is_edited && (
                                <span className="text-[10px] font-600 text-muted-foreground">
                                  (edited)
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(review.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <Stars rating={review.rating} />
                      </div>

                      {editingReviewId === review.id ? (
                        <div className="mt-4 space-y-3 border border-primary/30 rounded-2xl p-4 bg-primary/5">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                aria-label={`${star} star`}
                                onClick={() => setEditRating(star)}
                                className="p-1 focus:outline-none"
                              >
                                <svg
                                  width="22"
                                  height="22"
                                  viewBox="0 0 24 24"
                                  fill={star <= editRating ? '#F59E0B' : 'none'}
                                  stroke={star <= editRating ? '#F59E0B' : '#CBD5E1'}
                                  strokeWidth="1.5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                                  />
                                </svg>
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Review title (optional)"
                            maxLength={120}
                            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          />
                          {editError && (
                            <p className="text-sm text-red-500 font-600">{editError}</p>
                          )}
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={editSaving}
                              className="flex-1 py-2.5 rounded-xl bg-muted font-700 text-sm disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(review.id)}
                              disabled={editSaving}
                              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-700 text-sm disabled:opacity-50"
                            >
                              {editSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {review.title && <h4 className="font-800 mt-3">{review.title}</h4>}
                          <p className="text-sm text-foreground/80 mt-1.5">{review.content}</p>
                          {currentUser && currentUser.id === review.user_id && (
                            <div className="mt-3 flex items-center gap-4">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(review)}
                                className="text-xs font-700 text-primary hover:underline inline-flex items-center gap-1"
                              >
                                <Icon name="PencilIcon" size={14} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveReview(review)}
                                className="text-xs font-700 text-red-600 hover:underline inline-flex items-center gap-1"
                              >
                                <Icon name="TrashIcon" size={14} />
                                Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8 border-t border-border pt-8">
                <h3 className="text-lg font-800 mb-4">Write a Review</h3>

                {authChecking ? (
                  <p className="text-sm text-muted-foreground">Checking your account...</p>
                ) : !currentUser ? (
                  <div className="p-5 rounded-2xl bg-muted/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Icon name="LockClosedIcon" size={22} className="text-muted-foreground" />
                      <div>
                        <p className="font-700 text-sm">Login to write a review</p>
                        <p className="text-xs text-muted-foreground">
                          Only verified shoppers can submit reviews.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/account')}
                      className="btn-primary whitespace-nowrap"
                    >
                      Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="max-w-2xl space-y-4">
                    {reviewSuccess && (
                      <div className="flex items-start gap-3 p-4 rounded-2xl border border-green-200 bg-green-50 text-green-700 text-sm font-600">
                        <Icon name="CheckCircleIcon" size={18} />
                        <span>{reviewSuccess}</span>
                      </div>
                    )}
                    {reviewFormError && (
                      <div className="flex items-start gap-3 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm font-600">
                        <Icon name="ExclamationTriangleIcon" size={18} />
                        <span>{reviewFormError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-700 mb-2">
                        Your Rating <span className="text-accent">*</span>
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            aria-label={`${star} star${star > 1 ? 's' : ''}`}
                            onClick={() => setReviewRating(star)}
                            className="p-1 focus:outline-none"
                          >
                            <svg
                              width="26"
                              height="26"
                              viewBox="0 0 24 24"
                              fill={star <= reviewRating ? '#F59E0B' : 'none'}
                              stroke={star <= reviewRating ? '#F59E0B' : '#CBD5E1'}
                              strokeWidth="1.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                              />
                            </svg>
                          </button>
                        ))}
                      </div>
                      {reviewRating > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewRating]}
                        </p>
                      )}
                    </div>

                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="Review title (optional)"
                      maxLength={120}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
                    />

                    <textarea
                      required
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                      placeholder="Share your experience with this product..."
                      rows={4}
                      maxLength={1000}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {reviewContent.length}/1000 characters
                      </p>
                      <button
                        type="submit"
                        disabled={reviewSubmitting}
                        className="btn-primary px-6 py-3 disabled:opacity-50"
                      >
                        {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                        {!reviewSubmitting && <Icon name="PaperAirplaneIcon" size={16} />}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {product.inStock && (
        <div
          className="lg:hidden fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 border border-border rounded-full px-1.5 py-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="quantity-btn"
                aria-label="Decrease quantity"
                disabled={qty <= 1}
              >
                −
              </button>
              <span className="w-7 text-center font-800 text-sm">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                className="quantity-btn"
                aria-label="Increase quantity"
                disabled={qty >= maxQty}
              >
                +
              </button>
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-[10px] text-muted-foreground leading-tight">Price</p>
              <p className="text-lg font-800 price-deal leading-tight">
                रू{product.price.toLocaleString()}
              </p>
            </div>
            <button
              onClick={addToCartWithQty}
              disabled={!product.inStock || qty > maxQty}
              className="btn-primary flex-1 justify-center px-4 py-3"
            >
              <Icon name="ShoppingCartIcon" size={18} />
              Add to Cart
            </button>
          </div>
        </div>
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={i <= Math.round(rating) ? '#F59E0B' : 'none'}
          stroke={i <= Math.round(rating) ? '#F59E0B' : '#CBD5E1'}
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      ))}
    </div>
  );
}
