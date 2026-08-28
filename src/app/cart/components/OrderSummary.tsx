'use client';

import React, { useState } from 'react';

import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';

const SHIPPING_THRESHOLD = 6500;
const TAX_RATE = 0.13;

export default function OrderSummary() {
  const { subtotal, items } = useCart();
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');

  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : 200;
  const discount = promoApplied ? subtotal * 0.15 : 0;
  const taxable = subtotal - discount;
  const tax = taxable * TAX_RATE;
  const total = taxable + tax + shipping;
  const savings = items?.reduce((acc, item) => {
    if (item?.originalPrice) {
      return acc + (item?.originalPrice - item?.price) * item?.quantity;
    }
    return acc;
  }, 0);

  const handlePromo = () => {
    if (promoCode?.trim()?.toUpperCase() === 'SHOPALL15') {
      setPromoApplied(true);
      setPromoError('');
    } else {
      setPromoError('Invalid promo code. Try SHOPALL15');
      setPromoApplied(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl card-shadow p-6 sticky top-24">
      <h2 className="text-lg font-800 text-foreground mb-6">Order Summary</h2>

      {/* Line Items */}
      <div className="space-y-3 mb-5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Subtotal ({items?.reduce((a, i) => a + i?.quantity, 0)} items)
          </span>
          <span className="font-600 text-foreground">रू{subtotal?.toLocaleString()}</span>
        </div>

        {promoApplied && (
          <div className="flex justify-between text-sm">
            <span className="text-green-600 font-600 flex items-center gap-1">
              <Icon name="TagIcon" size={14} />
              Promo (SHOPALL15)
            </span>
            <span className="text-green-600 font-700">-रू{discount?.toLocaleString()}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          {shipping === 0 ? (
            <span className="text-green-600 font-700">FREE</span>
          ) : (
            <span className="font-600 text-foreground">रू{shipping?.toLocaleString()}</span>
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Estimated Tax</span>
          <span className="font-600 text-foreground">रू{tax?.toLocaleString()}</span>
        </div>

        {savings > 0 && (
          <div className="flex justify-between text-sm bg-green-50 rounded-xl px-3 py-2">
            <span className="text-green-700 font-600 flex items-center gap-1">
              <Icon name="CheckBadgeIcon" size={14} />
              You&apos;re saving
            </span>
            <span className="text-green-700 font-800">रू{savings?.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Free shipping progress */}
      {shipping > 0 && (
        <div className="mb-5 bg-muted/50 rounded-xl p-3">
          <p className="text-xs text-muted-foreground font-600 mb-2">
            Add <span className="text-primary font-800">रू{(SHIPPING_THRESHOLD - subtotal)?.toLocaleString()}</span> more for FREE shipping
          </p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.min((subtotal / SHIPPING_THRESHOLD) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Promo Code */}
      <div className="mb-5">
        <label htmlFor="promo-input" className="text-xs font-700 uppercase tracking-widest text-muted-foreground block mb-2">
          Promo Code
        </label>
        <div className="flex gap-2">
          <input
            id="promo-input"
            type="text"
            value={promoCode}
            onChange={e => { setPromoCode(e?.target?.value); setPromoError(''); }}
            placeholder="Enter code"
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm font-600 focus:outline-none focus:border-primary transition-colors"
            aria-describedby={promoError ? 'promo-error' : undefined}
          />
          <button
            onClick={handlePromo}
            disabled={promoApplied || !promoCode?.trim()}
            className={`px-4 py-2 rounded-xl text-sm font-700 transition-all ${
              promoApplied
                ? 'bg-green-500 text-white cursor-default' :'bg-primary text-primary-foreground hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {promoApplied ? <Icon name="CheckIcon" size={16} /> : 'Apply'}
          </button>
        </div>
        {promoError && (
          <p id="promo-error" className="text-xs text-red-500 font-500 mt-1.5">{promoError}</p>
        )}
        {promoApplied && (
          <p className="text-xs text-green-600 font-600 mt-1.5 flex items-center gap-1">
            <Icon name="CheckCircleIcon" size={13} />
            15% discount applied!
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border my-4" />

      {/* Total */}
      <div className="flex justify-between items-baseline mb-6">
        <span className="text-base font-800 text-foreground">Total</span>
        <span className="text-2xl font-800 text-primary">रू{total?.toLocaleString()}</span>
      </div>

      {/* CTA */}
      <button className="btn-primary w-full justify-center text-base py-4 rounded-2xl">
        Proceed to Checkout
        <Icon name="LockClosedIcon" size={16} />
      </button>

      <p className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
        <Icon name="ShieldCheckIcon" size={13} />
        Secure SSL encrypted checkout
      </p>

      {/* Payment Icons */}
      <div className="flex items-center justify-center gap-3 mt-4">
        {['💳', '🏦', '📱', '🔐']?.map((icon, i) => (
          <div key={i} className="w-10 h-6 bg-muted rounded flex items-center justify-center text-sm">
            {icon}
          </div>
        ))}
      </div>
    </div>
  );
}