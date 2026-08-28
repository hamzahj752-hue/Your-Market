'use client';

import React from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { CartItem as CartItemType, useCart } from '@/context/CartContext';

export default function CartItemRow({ item }: { item: CartItemType }) {
  const { updateQuantity, removeFromCart } = useCart();

  return (
    <div className="flex gap-4 p-4 bg-card rounded-2xl card-shadow group">
      {/* Image */}
      <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-muted/30">
        <AppImage
          src={item.image}
          alt={`${item.name} product image`}
          fill
          sizes="96px"
          className="object-cover w-full h-full"
        />
        {item.discount && (
          <div className="absolute top-1 left-1">
            <span className="badge-deal">-{item.discount}%</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground font-600 uppercase tracking-wider block mb-0.5">
              {item.category}
            </span>
            <h3 className="text-sm font-700 text-foreground leading-snug line-clamp-2 mb-1">
              {item.name}
            </h3>
            {item.variant && (
              <p className="text-xs text-muted-foreground">{item.variant}</p>
            )}
          </div>
          <button
            onClick={() => removeFromCart(item.id)}
            className="p-1.5 rounded-lg hover:bg-red-50hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
            aria-label={`Remove ${item.name} from cart`}
          >
            <Icon name="TrashIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Price + Quantity */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
              className="quantity-btn"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-700 text-foreground">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
              className="quantity-btn"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <div className="text-right">
            <p className="text-base font-800 price-deal">
              रू{(item.price * item.quantity).toLocaleString()}
            </p>
            {item.quantity > 1 && (
              <p className="text-xs text-muted-foreground">
                रू{item.price.toLocaleString()} each
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}