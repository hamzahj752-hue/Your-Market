'use client';

import React from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { CartItem as CartItemType, useCart, cartKey } from '@/context/CartContext';

export default function CartItemRow({ item }: { item: CartItemType }) {
  const { updateQuantity, removeFromCart } = useCart();
  const key = cartKey(item);

  return (
    <div className="flex gap-3 p-3 bg-card rounded-2xl card-shadow group">
      {/* Image */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-muted/30">
        <AppImage
          src={item.variantImage || item.image}
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
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-muted-foreground font-600 uppercase tracking-wider block mb-0.5">
              {item.category}
            </span>
            <h3 className="text-[13px] font-700 text-foreground leading-snug line-clamp-2 mb-0.5">
              {item.name}
            </h3>
            {(item.variantSize || item.variantColor) && (
              <p className="text-[11px] text-muted-foreground">
                {[item.variantSize, item.variantColor].filter(Boolean).join(' · ')}
              </p>
            )}
            {item.variant && !item.variantSize && !item.variantColor && (
              <p className="text-[11px] text-muted-foreground">{item.variant}</p>
            )}
          </div>
          <button
            onClick={() => removeFromCart(key)}
            className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={`Remove ${item.name} from cart`}
          >
            <Icon name="TrashIcon" size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Price + Quantity */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => updateQuantity(key, item.quantity - 1)}
              className="w-7 h-7 rounded-full border border-border bg-white flex items-center justify-center text-sm font-700 hover:border-primary hover:bg-primary hover:text-white transition-colors"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-7 text-center text-sm font-700 text-foreground">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(key, item.quantity + 1)}
              disabled={item.stockQuantity != null && item.quantity >= item.stockQuantity}
              className="w-7 h-7 rounded-full border border-border bg-white flex items-center justify-center text-sm font-700 hover:border-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <p className="text-sm sm:text-base font-800 price-deal whitespace-nowrap">
            रू{(item.price * item.quantity).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
