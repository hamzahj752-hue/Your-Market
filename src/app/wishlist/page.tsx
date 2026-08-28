'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';

export default function WishlistPage() {
  const { wishlist, toggleWishlist } = useWishlist();
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
    <main className="min-h-screen bg-background pt-28 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4"
          >
            <Icon name="ArrowLeftIcon" size={16} />
            Continue Shopping
          </Link>

          <div className="flex items-center gap-3">
            <Icon name="HeartIcon" variant="solid" size={30} className="text-red-500" />
            <h1 className="text-3xl font-800 text-foreground">My Wishlist</h1>
          </div>

          <p className="text-muted-foreground mt-2">
            {wishlist.length === 0
              ? 'Your saved products will appear here.'
              : `${wishlist.length} saved ${wishlist.length === 1 ? 'product' : 'products'}`}
          </p>
        </div>

        {wishlist.length === 0 ? (
          <div className="bg-card rounded-2xl card-shadow py-20 px-6 text-center">
            <Icon
              name="HeartIcon"
              size={64}
              className="mx-auto mb-5 text-muted-foreground/25"
            />
            <h2 className="text-xl font-800 text-foreground mb-2">
              Your wishlist is empty
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Save products you love and find them here later.
            </p>
            <Link
              href="/products"
              className="btn-primary inline-flex items-center gap-2"
            >
              <Icon name="ShoppingBagIcon" size={18} />
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {wishlist.map((product: any) => (
              <div
                key={product.id}
                className="bg-card rounded-2xl overflow-hidden card-shadow product-card-hover"
              >
                <div className="relative h-56 bg-muted/30">
                  <AppImage
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => toggleWishlist(product)}
                    className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                    aria-label="Remove from wishlist"
                  >
                    <Icon
                      name="HeartIcon"
                      variant="solid"
                      size={20}
                      className="text-red-500"
                    />
                  </button>
                </div>

                <div className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-600 mb-1">
                    {product.category}
                  </p>

                  <h2 className="font-700 text-foreground leading-snug line-clamp-2 min-h-10">
                    {product.name}
                  </h2>

                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-lg font-800 price-deal">
                      ?{product.price?.toLocaleString()}
                    </span>

                    {product.originalPrice && (
                      <span className="price-original">
                        ?{product.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-700 text-sm hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="ShoppingCartIcon" size={16} />
                      Add to Cart
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleWishlist(product)}
                      className="w-11 rounded-xl bg-muted text-foreground hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center"
                      aria-label="Remove product"
                    >
                      <Icon name="TrashIcon" size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
