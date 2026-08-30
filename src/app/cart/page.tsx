'use client';

import React from 'react';
import Link from 'next/link';
import { CartProvider, useCart } from '@/context/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import CartItemRow from './components/CartItem';
import OrderSummary from './components/OrderSummary';
import Icon from '@/components/ui/AppIcon';
import { products } from '@/data/products';

function CartContent() {
  const { items, clearCart } = useCart();

  const recommendedProducts = products
    .filter((product) => !items.some((item) => item.id === product.id))
    .slice(0, 3);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
          <Icon name="ShoppingCartIcon" size={40} className="text-muted-foreground/40" />
        </div>

        <h2 className="text-2xl font-800 text-foreground mb-3">Your cart is empty</h2>

        <p className="text-muted-foreground text-base mb-8 max-w-sm">
          Looks like you haven&apos;t added anything yet. Browse our products and find something you
          love.
        </p>

        <Link
          href="/products"
          className="btn-primary text-base px-8 py-4 inline-flex items-center justify-center gap-2"
        >
          Start Shopping
          <Icon name="ArrowRightIcon" size={18} />
        </Link>

        <Link
          href="/"
          className="mt-4 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-800 text-foreground">Shopping Cart</h1>

          <p className="text-muted-foreground text-sm mt-1">
            {items.reduce((a, i) => a + i.quantity, 0)} items in your cart
          </p>
        </div>

        <button
          onClick={clearCart}
          className="text-sm text-muted-foreground hover:text-red-500 font-600 transition-colors flex items-center gap-1.5"
        >
          <Icon name="TrashIcon" size={15} />
          Clear cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-primary font-600 hover:gap-3 transition-all mb-2"
          >
            <Icon name="ArrowLeftIcon" size={15} />
            Continue Shopping
          </Link>

          {items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}

          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { icon: 'TruckIcon', label: 'Free shipping on रू6,500+' },
              { icon: 'ArrowPathIcon', label: '30-day returns' },
              { icon: 'ShieldCheckIcon', label: 'Buyer protection' },
            ].map((badge) => (
              <div
                key={badge.label}
                className="bg-white rounded-xl p-3 card-shadow flex flex-col items-center text-center gap-1.5"
              >
                <Icon
                  name={badge.icon as Parameters<typeof Icon>[0]['name']}
                  size={18}
                  className="text-primary"
                />

                <span className="text-xs text-muted-foreground font-600 leading-tight">
                  {badge.label}
                </span>
              </div>
            ))}
          </div>

          {recommendedProducts.length > 0 && (
            <div className="pt-4">
              <h3 className="text-base font-800 text-foreground mb-4 flex items-center gap-2">
                <Icon name="SparklesIcon" size={18} className="text-accent" />
                You might also like
              </h3>

              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                {recommendedProducts.map((rec) => (
                  <Link
                    key={rec.id}
                    href={`/products/${rec.id}`}
                    className="flex-shrink-0 w-40 group"
                  >
                    <div className="bg-white rounded-xl overflow-hidden card-shadow product-card-hover">
                      <div className="relative h-28 overflow-hidden bg-muted/30">
                        <img
                          src={rec.image}
                          alt={rec.alt}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>

                      <div className="p-2.5">
                        <p className="text-xs font-700 text-foreground line-clamp-2 leading-snug mb-1">
                          {rec.name}
                        </p>

                        <p className="text-sm font-800 price-deal">
                          रू{rec.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <OrderSummary />
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 pt-24 md:pt-28 pb-16 lg:pb-0">
          <CartContent />
        </main>

        <Footer />
        <BottomNav />
      </div>
    </CartProvider>
  );
}
