'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';

function PromoCodeRow() {
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(false);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setApplied(true);
  };

  return (
    <form onSubmit={apply} className="mb-4" aria-label="Enter promo code">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon name="TicketIcon" size={14} />
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setApplied(false);
            }}
            placeholder={applied ? 'Promo code applied' : 'Enter promo code'}
            aria-label="Promo code"
            className="w-full h-10 pl-8 pr-3 rounded-full border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/15 disabled:opacity-60"
            disabled={applied}
          />
        </div>
        <button
          type="submit"
          disabled={applied || !code.trim()}
          className="flex-shrink-0 h-10 px-4 rounded-full bg-foreground text-background text-sm font-700 disabled:opacity-50 transition-opacity"
        >
          Apply
        </button>
      </div>
      {applied && (
        <p className="mt-1.5 text-xs font-700 text-green-600 flex items-center gap-1">
          <Icon name="CheckBadgeIcon" size={14} />
          Code {code} applied
        </p>
      )}
    </form>
  );
}

interface StoreSettings {
  currency: string;
  shipping_charge: number;
  free_shipping_threshold: number;
  tax_percent: number;
}

const money = (value: number) => `रू${Math.round(value).toLocaleString('en-IN')}`;

export default function OrderSummary() {
  const { subtotal, items } = useCart();

  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('currency, shipping_charge, free_shipping_threshold, tax_percent')
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setSettings(data as StoreSettings);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const shippingCharge = settings?.shipping_charge ?? 200;
  const freeShippingThreshold = settings?.free_shipping_threshold ?? 6500;
  const taxPercent = settings?.tax_percent ?? 13;

  const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCharge;
  const tax = subtotal * (taxPercent / 100);
  const total = subtotal + shipping + tax;

  const savings = items.reduce((acc, item) => {
    if (item.originalPrice) {
      return acc + (item.originalPrice - item.price) * item.quantity;
    }
    return acc;
  }, 0);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const hasFreeShippingThreshold = freeShippingThreshold > 0;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const shippingProgress = hasFreeShippingThreshold
    ? Math.min((subtotal / freeShippingThreshold) * 100, 100)
    : 100;

  return (
    <div className="bg-card rounded-lg card-shadow p-4 sticky top-20">
      <h2 className="text-base font-800 text-foreground mb-4">Order Summary</h2>

      {/* Summary */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
          <span className="font-600 text-foreground">{money(subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>

          {shipping === 0 ? (
            <span className="text-green-600 font-700">FREE</span>
          ) : (
            <span className="font-600 text-foreground">{money(shipping)}</span>
          )}
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Estimated Tax</span>

          <span className="font-600 text-foreground">{money(tax)}</span>
        </div>

        {savings > 0 && (
          <div className="flex justify-between text-sm bg-green-50 rounded-xl px-2.5 py-1.5">
            <span className="text-green-700 font-600 flex items-center gap-1">
              <Icon name="CheckBadgeIcon" size={14} />
              You&apos;re saving
            </span>

            <span className="text-green-700 font-800">{money(savings)}</span>
          </div>
        )}
      </div>

      {/* Free Shipping */}
      {shipping > 0 ? (
        <div className="mb-4 bg-muted/50 rounded-xl p-2.5">
          <p className="text-xs text-muted-foreground font-600 mb-2">
            Add <span className="text-primary font-800">{money(remainingForFreeShipping)}</span>{' '}
            more for FREE shipping
          </p>

          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{
                width: `${shippingProgress}%`,
              }}
            />
          </div>
        </div>
      ) : (
        hasFreeShippingThreshold && (
          <div className="mb-4 bg-green-50 rounded-xl p-2.5">
            <p className="text-xs text-green-700 font-700 flex items-center gap-2">
              <Icon name="CheckCircleIcon" size={15} />
              You&apos;ve unlocked FREE shipping!
            </p>
          </div>
        )
      )}

      <div className="border-t border-border my-3" />

      {/* Promo code */}
      <PromoCodeRow />

      {/* Total */}
      <div className="flex justify-between items-baseline mb-4">
        <span className="text-base font-800 text-foreground">Total</span>

        <span className="text-2xl font-800 text-primary">{money(total)}</span>
      </div>

      {/* Checkout */}
      <Link
        href="/checkout"
        className="btn-primary w-full justify-center text-sm py-3 rounded-full"
      >
        Proceed to Checkout
        <Icon name="LockClosedIcon" size={16} />
      </Link>

      {/* Payment Method */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="px-2.5 py-1 rounded-lg bg-muted text-xs font-700">Cash on Delivery</span>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
        <Icon name="ShieldCheckIcon" size={13} />
        Your order is validated before confirmation.
      </p>
    </div>
  );
}
