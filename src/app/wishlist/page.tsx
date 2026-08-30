'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';

export default function WishlistPage() {
  const { wishlist, toggleWishlist, clearWishlist, syncMessage } = useWishlist();
  const { addToCart } = useCart();

  const handleAddToCart = (product: any) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image,
      category: product.category,
      rating: product.rating,
      discount: product.discount,
      variant: product.variant,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
              >
                <Icon name="ArrowLeftIcon" size={16} />
                Continue Shopping
              </Link>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center">
                  <Icon name="HeartIcon" variant="solid" size={25} className="text-red-500" />
                </div>

                <div>
                  <h1 className="text-3xl md:text-4xl font-800 text-foreground">My Wishlist</h1>

                  <p className="text-sm text-muted-foreground mt-1">
                    {wishlist.length === 0
                      ? 'Save products you love for later.'
                      : `${wishlist.length} ${
                          wishlist.length === 1 ? 'product' : 'products'
                        } saved`}
                  </p>
                  {syncMessage && (
                    <p className="text-xs text-muted-foreground mt-2">{syncMessage}</p>
                  )}
                </div>
              </div>
            </div>

            {wishlist.length > 0 && (
              <button
                type="button"
                onClick={clearWishlist}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-700 text-muted-foreground hover:text-red-500 hover:border-red-200 transition-colors"
              >
                <Icon name="TrashIcon" size={16} />
                Clear Wishlist
              </button>
            )}
          </div>

          {wishlist.length === 0 ? (
            <div className="bg-card rounded-3xl card-shadow py-24 px-6 text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-6">
                <Icon name="HeartIcon" size={46} className="text-red-300" />
              </div>

              <h2 className="text-2xl font-800 text-foreground mb-3">Your wishlist is empty</h2>

              <p className="max-w-md mx-auto text-muted-foreground mb-8">
                Found something you love? Tap the heart button on any product to save it here.
              </p>

              <Link
                href="/products"
                className="btn-primary inline-flex items-center gap-2 px-7 py-3.5"
              >
                <Icon name="ShoppingBagIcon" size={18} />
                Browse Products
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {wishlist.map((product: any) => (
                  <article
                    key={product.id}
                    className="bg-card rounded-2xl overflow-hidden card-shadow product-card-hover"
                  >
                    <div className="relative h-60 bg-muted/30">
                      <Link href={`/products/${product.id}`}>
                        <AppImage
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover"
                        />
                      </Link>

                      <button
                        type="button"
                        onClick={() => toggleWishlist(product)}
                        className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                        aria-label="Remove from wishlist"
                      >
                        <Icon name="HeartIcon" variant="solid" size={20} className="text-red-500" />
                      </button>

                      {product.discount && (
                        <span className="absolute left-3 top-3 bg-accent text-accent-foreground text-xs font-800 px-2.5 py-1 rounded-lg">
                          -{product.discount}%
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-700 mb-1">
                        {product.category}
                      </p>

                      <Link href={`/products/${product.id}`}>
                        <h2 className="font-800 text-foreground leading-snug line-clamp-2 min-h-11 hover:text-primary transition-colors">
                          {product.name}
                        </h2>
                      </Link>

                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xl font-800 price-deal">
                          रू{Number(product.price || 0).toLocaleString()}
                        </span>

                        {product.originalPrice && (
                          <span className="price-original">
                            रू{Number(product.originalPrice).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 mt-2 text-sm">
                        <Icon
                          name="StarIcon"
                          variant="solid"
                          size={15}
                          className="text-yellow-500"
                        />
                        <span className="font-700">{product.rating || '4.5'}</span>
                        <span className="text-muted-foreground">rating</span>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => handleAddToCart(product)}
                          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-800 text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                          <Icon name="ShoppingCartIcon" size={17} />
                          Add to Cart
                        </button>

                        <Link
                          href={`/products/${product.id}`}
                          className="w-12 rounded-xl bg-muted text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center"
                          aria-label="View product"
                        >
                          <Icon name="EyeIcon" size={18} />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card rounded-2xl card-shadow p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon name="ShieldCheckIcon" size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-800 text-sm">Secure Shopping</p>
                    <p className="text-xs text-muted-foreground">Protected checkout</p>
                  </div>
                </div>

                <div className="bg-card rounded-2xl card-shadow p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center">
                    <Icon name="TruckIcon" size={22} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-800 text-sm">Fast Delivery</p>
                    <p className="text-xs text-muted-foreground">Reliable shipping</p>
                  </div>
                </div>

                <div className="bg-card rounded-2xl card-shadow p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Icon name="ArrowPathIcon" size={22} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="font-800 text-sm">Easy Returns</p>
                    <p className="text-xs text-muted-foreground">30-day returns</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
