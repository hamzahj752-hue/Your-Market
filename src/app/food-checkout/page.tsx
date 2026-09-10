'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useFoodCart } from '@/context/FoodCartContext';
import LocationPicker from '@/components/LocationPicker/LocationPicker';
import NepalPhoneInput from '@/components/NepalPhoneInput';
import { supabase } from '@/lib/supabase';
import { isValidNepalMobile, toCanonicalNepalMobile } from '@/lib/nepalPhone';
import { DEFAULT_SETTINGS } from '@/lib/useStoreSettings';

/*
 * Food Checkout — a SEPARATE checkout for the Food marketplace flow.
 *
 * It never reads the normal product cart: line items come ONLY from the
 * dedicated Food cart or a Food Buy-Now intent (`/food-checkout?buyNow=1`).
 * Food products have no numeric stock (Sold Out ON/OFF is their only
 * availability), so the seller-side resolver validates food availability with
 * `sold_out` and rejects anything that is not actually a Food product.
 *
 * The server-side `place_order` RPC derives `order_type` from the items and
 * rejects a mixed Food + normal basket, so the two flows can never combine into
 * an ambiguous order.
 */

interface Address {
  id: string;
  label?: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  is_default: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

interface PlacedOrder {
  id: string;
  order_number: string;
  status: string;
  payment_method?: string;
  payment_status?: string;
  total: number;
  created_at: string;
}

interface LineItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  variantId?: string;
  variantSize?: string;
  variantColor?: string;
  variantImage?: string;
}

const PAYMENT_METHODS: Array<[string, string]> = [
  ['cod', 'Cash on Delivery'],
  ['esewa', 'eSewa'],
];

const FRIENDLY_ERRORS: Array<[RegExp, string]> = [
  [/must be signed in/i, 'Please sign in before placing a food order.'],
  [/cart is empty/i, 'Your food order is empty.'],
  [/invalid or expired coupon/i, 'The coupon code you entered is invalid or has expired.'],
  [/no longer active/i, 'The coupon code you entered is no longer active.'],
  [/has expired/i, 'The coupon code you entered has expired.'],
  [/usage limit/i, 'The coupon code you entered has reached its usage limit.'],
  [/minimum order/i, 'This coupon requires a minimum order value to apply.'],
  [/no longer exists/i, 'One of the items in your food order is no longer available.'],
  [
    /no longer available/i,
    'An item in your food order is no longer available. Please review your order.',
  ],
  [/sold out/i, 'One of the items in your food order is currently sold out.'],
  [/out of stock/i, 'One of the items in your food order is currently out of stock.'],
  [
    /mixed basket|includes both food and non-food\n/i,
    'Food and non-food items cannot be ordered together. Please place separate orders.',
  ],
  [
    /cash on delivery is currently unavailable/i,
    'Cash on Delivery is currently unavailable. Please contact support.',
  ],
  [/invalid payment method/i, 'The selected payment method is invalid.'],
  [
    /invalid quantity/i,
    'There was a problem with your food order. Please review the items and try again.',
  ],
  [
    /row-level security policy|permission denied for function/i,
    'Your food order could not be processed right now. Please try again in a moment, or contact support.',
  ],
  [
    /invalid input syntax for type (uuid|integer)/i,
    'There was a problem with an item in your food order. Please remove it and add it again.',
  ],
];

function friendlyOrderError(raw: string): string {
  const msg = typeof raw === 'string' ? raw : 'Unable to place your food order. Please try again.';
  const matched = FRIENDLY_ERRORS.find(([re]) => re.test(msg));
  return matched ? matched[1] : 'Unable to place your food order. Please try again.';
}

interface StoreSettings {
  currency: string;
  shipping_charge: number;
  free_shipping_threshold: number;
  tax_percent: number;
  cod_enabled: boolean;
}

const money = (value: number) => `रू${Math.round(value).toLocaleString('en-IN')}`;

export default function FoodCheckoutPage() {
  const {
    items: foodItems,
    subtotal: foodSubtotal,
    clearFoodCart,
    setFoodQty,
    removeFood,
  } = useFoodCart();
  const router = useRouter();

  // Food Buy Now intent: a dedicated line-item set originating from Product
  // Details / cards. Resolved server-side (canonical price, sold-out guard,
  // food-only check) and kept separate from the Food cart.
  const [buyNowIntent, setBuyNowIntent] = useState(false);
  const [buyNowItems, setBuyNowItems] = useState<LineItem[] | null>(null);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [buyNowError, setBuyNowError] = useState('');

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNewAddress, setUseNewAddress] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [_location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [esewaConfig, setEsewaConfig] = useState<{
    configured: boolean;
    environment: string;
  } | null>(null);
  const [esewaLoading, setEsewaLoading] = useState(true);

  const shippingCharge = settings?.shipping_charge ?? DEFAULT_SETTINGS.shippingCharge;
  const freeShippingThreshold =
    settings?.free_shipping_threshold ?? DEFAULT_SETTINGS.freeShippingThreshold;
  const taxPercent = settings?.tax_percent ?? DEFAULT_SETTINGS.taxPercent;

  const [method, setMethod] = useState('cod');

  // The effective line items come from a Food Buy Now intent when present,
  // otherwise from the dedicated Food cart. They are NEVER mixed with the
  // normal product cart.
  const checkoutItems: LineItem[] = buyNowItems ?? foodItems.map((i) => ({ ...i }));

  const checkoutSubtotal = buyNowItems
    ? buyNowItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    : foodSubtotal;

  const shipping = checkoutSubtotal >= freeShippingThreshold ? 0 : shippingCharge;
  const tax = checkoutSubtotal * (taxPercent / 100);
  const total = checkoutSubtotal + shipping + tax;

  const codAvailable = settings?.cod_enabled ?? true;

  // Prefill the coupon box from a carry-over code so the same code the customer
  // started with is what actually gets validated. No validity is claimed here —
  // place_order is the only authority.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const coupon = (params.get('coupon') || '').trim().toUpperCase();
    if (coupon) setCouponCode(coupon);
  }, []);

  // Food Buy Now intent resolution: `/food-checkout?buyNow=1&product=<id>&qty=<n>`.
  // Re-resolves the canonical product server-side so a tampered client price can
  // never reach place_order. ONLY food products (products.food_category_id set)
  // are accepted here; a tampered link to a normal product is rejected.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('buyNow') !== '1') return;

    setBuyNowIntent(true);
    let active = true;

    const loadBuyNow = async () => {
      const rawProductId = params.get('product');
      const rawQty = Number(params.get('qty'));
      const rawVariantId = params.get('variant');

      const qty = Number.isFinite(rawQty) && Number.isInteger(rawQty) && rawQty >= 1 ? rawQty : 1;

      if (!rawProductId) {
        if (active) setBuyNowError('This food item is no longer available.');
        setBuyNowLoading(false);
        return;
      }

      setBuyNowLoading(true);
      setBuyNowError('');

      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', rawProductId)
        .eq('active', true)
        .maybeSingle();

      if (active && (error || !product)) {
        setBuyNowError('This food item is no longer available.');
        setBuyNowLoading(false);
        return;
      }
      if (!active || !product) return;

      const isFoodProduct = !!(product as Record<string, unknown>).food_category_id;
      if (!isFoodProduct) {
        if (active) {
          setBuyNowError(
            'This item is not a Food product. Please order it through the regular checkout.'
          );
        }
        setBuyNowLoading(false);
        return;
      }

      const baseSoldOut = (product as Record<string, unknown>).sold_out === true;
      if (baseSoldOut) {
        if (active) {
          setBuyNowError('This food item is currently sold out and cannot be ordered right now.');
        }
        setBuyNowLoading(false);
        return;
      }

      let variant: Record<string, unknown> | null = null;
      if (rawVariantId) {
        const { data: vr, error: vErr } = await supabase
          .from('product_variants')
          .select('*')
          .eq('id', rawVariantId)
          .eq('product_id', rawProductId)
          .eq('active', true)
          .maybeSingle();

        if (active && (vErr || !vr)) {
          setBuyNowError(
            'The selected option is no longer available. Please review your selection.'
          );
          setBuyNowLoading(false);
          return;
        }
        if (!active) return;
        variant = vr;
      }

      const price = variant ? Number(variant.price ?? product.price) : Number(product.price);
      const originalPrice = variant
        ? variant.original_price != null
          ? Number(variant.original_price)
          : product.original_price != null
            ? Number(product.original_price)
            : undefined
        : product.original_price != null
          ? Number(product.original_price)
          : undefined;

      const item: LineItem = {
        id: String(product.id),
        name: String(product.name || 'Food item'),
        price,
        originalPrice,
        image:
          variant && variant.image_url ? String(variant.image_url) : String(product.image || ''),
        quantity: qty,
        variantId: variant ? String(variant.id) : undefined,
        variantSize: variant && variant.size ? String(variant.size) : undefined,
        variantColor: variant && variant.color_name ? String(variant.color_name) : undefined,
        variantImage: variant && variant.image_url ? String(variant.image_url) : undefined,
      };

      if (active) {
        setBuyNowItems([item]);
        setBuyNowLoading(false);
      }
    };

    void loadBuyNow();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          if (!cancelled) {
            setAddresses(data as Address[]);
            setSelectedAddressId(data[0].id);
          }
        }

        if (!cancelled && name === '' && phone === '' && city === '') {
          const meta = (user.user_metadata || {}) as Record<string, unknown>;
          const metaPhone = typeof meta.phone === 'string' ? meta.phone : '';
          setPhone(metaPhone.replace(/^\+?977/, ''));
          if (typeof meta.full_name === 'string' && meta.full_name) {
            setName(meta.full_name);
          }
          if (typeof meta.city === 'string' && meta.city) {
            setCity(meta.city);
          }
        }
      } else {
        if (!cancelled) setLoginRequired(true);
      }
      if (!cancelled) setLoadingUser(false);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      const { data } = await supabase.from('store_settings').select('*').limit(1).maybeSingle();
      if (!cancelled && data) {
        setSettings(data as StoreSettings);
      }
    };
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/payment/esewa/config');
        if (!cancelled && res.ok) {
          const data = await res.json();
          setEsewaConfig({ configured: data.configured, environment: data.environment });
        }
      } catch {
        // eSewa not available — keep configured as false
      } finally {
        if (!cancelled) setEsewaLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedPhone = useMemo(() => {
    if (!selectedAddressId || useNewAddress) {
      return phone.trim();
    }
    const selected = addresses.find((a) => a.id === selectedAddressId);
    return selected?.phone?.trim() || '';
  }, [phone, selectedAddressId, useNewAddress, addresses]);

  const resolvedPhoneValid = useMemo(() => isValidNepalMobile(resolvedPhone), [resolvedPhone]);

  const requiredValid = useMemo(() => {
    const usingSaved = !!selectedAddressId && !useNewAddress;
    if (usingSaved) {
      const selected = addresses.find((a) => a.id === selectedAddressId);
      if (!selected) return false;
      return (
        selected.recipient_name.trim() !== '' &&
        selected.address_line.trim() !== '' &&
        selected.city.trim() !== '' &&
        isValidNepalMobile(selected.phone)
      );
    }
    return name.trim() !== '' && address.trim() !== '' && city.trim() !== '' && resolvedPhoneValid;
  }, [useNewAddress, selectedAddressId, addresses, name, address, city, resolvedPhoneValid]);

  useEffect(() => {
    if (!resolvedPhone) {
      setPhoneError('');
      return;
    }
    if (!resolvedPhoneValid) {
      setPhoneError('Enter a valid 10-digit Nepal mobile number.');
    } else {
      setPhoneError('');
    }
  }, [resolvedPhone, resolvedPhoneValid]);

  const availableMethods = PAYMENT_METHODS.filter(([id]) => {
    if (id === 'cod') return codAvailable;
    if (id === 'esewa') return esewaConfig?.configured ?? false;
    return false;
  });

  const canSubmit =
    !submitting &&
    !loadingUser &&
    !esewaLoading &&
    availableMethods.length > 0 &&
    checkoutItems.length > 0 &&
    requiredValid &&
    availableMethods.some(([id]) => id === method);

  const placeFoodOrder = async () => {
    // Block duplicate submissions (double-tap / rapid clicks) so a single tap
    // can never create more than one food order.
    if (submittingRef.current) return;
    submittingRef.current = true;

    setError('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      submittingRef.current = false;
      setError('Please login before placing a food order.');
      setLoginRequired(true);
      router.push('/account');
      return;
    }

    // Resolve the delivery address.
    let recipient_name = name.trim();
    let phoneValue = phone.trim();
    let addressLine = address.trim();
    let cityValue = city.trim();
    let addressLat: number | null = _location ? _location.lat : null;
    let addressLng: number | null = _location ? _location.lng : null;
    let addressError = '';

    if (!selectedAddressId || useNewAddress) {
      if (!recipient_name) addressError = 'Please enter the recipient name.';
      else if (!isValidNepalMobile(phoneValue)) {
        addressError = 'Enter a valid 10-digit Nepal mobile number.';
        setPhoneError('Enter a valid 10-digit Nepal mobile number.');
      }
      if (!addressError && !addressLine) addressError = 'Please enter the delivery address.';
      if (!addressError && !cityValue) addressError = 'Please enter the city.';
    } else {
      const selected = addresses.find((a) => a.id === selectedAddressId);
      if (selected) {
        recipient_name = selected.recipient_name;
        phoneValue = selected.phone;
        addressLine = selected.address_line;
        cityValue = selected.city;
        addressLat = selected.latitude ?? null;
        addressLng = selected.longitude ?? null;
        if (!isValidNepalMobile(phoneValue)) {
          addressError = 'The saved delivery phone is invalid. Please use a new address.';
        }
      } else {
        addressError = 'Please select a valid delivery address.';
      }
    }

    if (addressError) {
      submittingRef.current = false;
      setError(addressError);
      return;
    }

    phoneValue = toCanonicalNepalMobile(phoneValue) || phoneValue;

    setSubmitting(true);

    if (method === 'cod' && !codAvailable) {
      setSubmitting(false);
      submittingRef.current = false;
      setError('Cash on Delivery is currently unavailable. Please contact support.');
      return;
    }

    const itemsPayload = checkoutItems.map((i) => {
      const rawVariant = i.variantId || null;
      const variantId =
        typeof rawVariant === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawVariant)
          ? rawVariant
          : null;
      return { product_id: i.id, quantity: i.quantity, variant_id: variantId };
    });

    const addressPayload = {
      recipient_name,
      phone: phoneValue,
      address_line: addressLine,
      city: cityValue,
      latitude: addressLat,
      longitude: addressLng,
    };

    const { data, error: rpcError } = await supabase.rpc('place_order', {
      p_items: itemsPayload,
      p_address: addressPayload,
      p_payment_method: method,
      p_coupon_code: couponCode.trim() || null,
    });

    if (rpcError) {
      console.error('Place food order error:', {
        message: rpcError?.message,
        code: rpcError?.code,
        details: rpcError?.details,
        hint: rpcError?.hint,
      });
      setError(friendlyOrderError(rpcError.message || ''));
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }

    const created = data as PlacedOrder;
    if (!created || !created.id || !created.order_number) {
      console.error('Place food order returned no order:', data);
      setError(
        'Your food order could not be confirmed. Please try again, or contact support before retrying to avoid a duplicate.'
      );
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }
    // A Food Buy Now purchase is a dedicated, separate order: it never clears
    // the customer's Food cart. Only a Food-cart checkout clears the cart after
    // the order is confirmed.
    if (!buyNowItems) {
      clearFoodCart();
    }

    if (method === 'esewa') {
      setSubmitting(false);
      submittingRef.current = false;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const callbackUrl = `${origin}/api/payment/esewa/callback`;
      try {
        const res = await fetch('/api/payment/esewa/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: created.id,
            orderNumber: created.order_number,
            totalAmount: Number(created.total),
            taxAmount: tax,
            productServiceCharge: 0,
            productDeliveryCharge: shipping,
            successUrl: callbackUrl,
            failureUrl: callbackUrl,
          }),
        });
        if (!res.ok) {
          throw new Error('Failed to initiate eSewa payment');
        }
        const esewaData = await res.json();
        if (esewaData.formData && esewaData.formBase) {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = `${esewaData.formBase}/api/epay/main/v2/form`;
          form.style.display = 'none';
          Object.entries(esewaData.formData).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = String(value);
            form.appendChild(input);
          });
          document.body.appendChild(form);
          form.submit();
          return;
        }
      } catch (e) {
        console.error('eSewa redirect failed:', e);
        setError('Payment initiation failed. Please try again or use Cash on Delivery.');
        setSubmitting(false);
        submittingRef.current = false;
        return;
      }
    }

    setPlacedOrder(created);
    setSubmitting(false);
    submittingRef.current = false;
  };

  if (placedOrder) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pb-24 lg:pb-0 px-4">
          <div className="max-w-2xl mx-auto bg-card rounded-3xl card-shadow p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-5">
              <Icon name="CheckCircleIcon" size={32} className="text-green-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-800 mb-2">Food Order Placed!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you. Your food order has been confirmed.
            </p>
            <div className="bg-muted/60 rounded-2xl p-5 mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Order Number
              </p>
              <p className="text-xl font-800 text-primary">{placedOrder.order_number}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Total: {money(Number(placedOrder.total))} • Status:{' '}
                <span className="font-700 text-green-600">{placedOrder.status}</span>
              </p>
              <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <p className="text-muted-foreground">
                  Payment: <span className="font-700 text-foreground">Cash on Delivery</span>
                </p>
                <p className="text-muted-foreground">
                  Payment Status:{' '}
                  <span className="font-700 capitalize text-amber-600">
                    {placedOrder.payment_status || 'pending'}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/account/food-orders" className="btn-primary justify-center">
                <Icon name="FireIcon" size={18} />
                View My Food Orders
              </Link>
              <Link href="/food" className="btn-outline justify-center">
                Browse More Food
              </Link>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (loginRequired) {
    return (
      <>
        <Header />
        <main className="min-h-screen pb-24 lg:pb-0 text-center px-4">
          <div className="max-w-md mx-auto">
            <Icon
              name="LockClosedIcon"
              size={44}
              className="mx-auto mb-5 text-muted-foreground/40"
            />
            <h1 className="text-2xl font-800 mb-3">Login to Checkout</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to your account before placing a food order.
            </p>
            <Link href="/account" className="btn-primary inline-flex">
              Go to Account
            </Link>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </>
    );
  }

  if (buyNowIntent && buyNowLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pb-24 lg:pb-0 text-center px-4">
          <div className="max-w-md mx-auto">
            <div className="w-10 h-10 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-5" />
            <h1 className="text-2xl font-800 mb-3">Preparing Food Checkout</h1>
            <p className="text-muted-foreground mb-6">Reserving your selected food item...</p>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </>
    );
  }

  if (!checkoutItems.length) {
    if (buyNowError) {
      return (
        <>
          <Header />
          <main className="min-h-screen pb-24 lg:pb-0 text-center px-4">
            <div className="max-w-md mx-auto">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 flex items-center justify-center mb-5">
                <Icon name="ExclamationTriangleIcon" size={26} className="text-red-500" />
              </div>
              <h1 className="text-2xl font-800 mb-3">Order unavailable</h1>
              <p className="text-muted-foreground mb-6">{buyNowError}</p>
              <Link href="/food" className="btn-primary inline-flex">
                Browse Food
              </Link>
            </div>
          </main>
          <Footer />
          <BottomNav />
        </>
      );
    }

    return (
      <>
        <Header />
        <main className="min-h-screen pb-24 lg:pb-0 text-center px-4">
          <h1 className="text-2xl font-800">Your food cart is empty</h1>
          <Link href="/food" className="btn-primary inline-flex mt-5">
            Browse Food
          </Link>
        </main>
        <Footer />
        <BottomNav />
      </>
    );
  }

  const itemCount = checkoutItems.reduce((sum, it) => sum + it.quantity, 0);
  const savings = checkoutItems.reduce((acc, it) => {
    if (it.originalPrice && it.originalPrice > it.price) {
      return acc + (it.originalPrice - it.price) * it.quantity;
    }
    return acc;
  }, 0);
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - checkoutSubtotal);
  const shippingProgress =
    freeShippingThreshold > 0
      ? Math.min((checkoutSubtotal / freeShippingThreshold) * 100, 100)
      : 100;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pb-[160px] lg:pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-xl sm:text-2xl font-900 mb-1">Food Checkout</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Complete your delivery details to place your food order.
          </p>

          <div className="grid lg:grid-cols-[1fr_400px] gap-6 lg:gap-7 items-start">
            {/* -- Left column: form -- */}
            <section className="space-y-6">
              {/* Contact / delivery details */}
              <div className="bg-card rounded-2xl card-shadow p-3.5 sm:p-5">
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-800 text-sm">
                    1
                  </span>
                  <h2 className="text-base font-800">Delivery Details</h2>
                </div>

                {loadingUser ? (
                  <p className="text-sm text-muted-foreground">Loading delivery details...</p>
                ) : (
                  <>
                    {addresses.length > 0 && (
                      <div className="mb-5">
                        <p className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3">
                          Saved addresses
                        </p>
                        <div className="space-y-3">
                          {addresses.map((addr) => {
                            const addrPhoneValid = isValidNepalMobile(addr.phone);
                            const active = selectedAddressId === addr.id && !useNewAddress;
                            return (
                              <label
                                key={addr.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  active ? 'border-primary bg-primary/5' : 'border-border'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="saved-address"
                                  className="mt-1"
                                  checked={active}
                                  onChange={() => {
                                    setUseNewAddress(false);
                                    setSelectedAddressId(addr.id);
                                    setError('');
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  {addr.label && (
                                    <span className="text-xs font-700 text-primary uppercase tracking-wider">
                                      {addr.label}
                                    </span>
                                  )}
                                  <p className="font-700 text-sm mt-0.5">{addr.recipient_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {addr.address_line}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{addr.city}</p>
                                  <p className="text-sm text-muted-foreground">{addr.phone}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    {addr.is_default && (
                                      <span className="text-xs font-700 text-green-600">
                                        Default
                                      </span>
                                    )}
                                    {!addrPhoneValid && (
                                      <span className="text-xs font-600 text-red-500">
                                        Invalid phone — use a new address
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUseNewAddress(true);
                            setSelectedAddressId(null);
                          }}
                          className="mt-3 text-sm font-700 text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Icon name="PlusIcon" size={15} />
                          Use a new address
                        </button>
                      </div>
                    )}

                    {(addresses.length === 0 || useNewAddress) && (
                      <div>
                        <p className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3">
                          New address
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-600 mb-1.5">Full name</label>
                            <input
                              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Full name"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-600 mb-1.5">Mobile number</label>
                            <NepalPhoneInput
                              value={phone}
                              onChange={(local) => {
                                setPhone(local);
                                setPhoneError('');
                              }}
                              placeholder="98XXXXXXXX"
                              error={phoneError}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <LocationPicker
                              address={address}
                              onAddressChange={setAddress}
                              onCityChange={setCity}
                              onLocationChange={setLocation}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-600 mb-1.5">City</label>
                            <input
                              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="City"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Payment method */}
              <div className="bg-card rounded-2xl card-shadow p-3.5 sm:p-5">
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-800 text-sm">
                    2
                  </span>
                  <h2 className="text-base font-800">Payment Method</h2>
                </div>

                <div className="grid gap-3">
                  {availableMethods.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMethod(id)}
                      className={`w-full p-3 rounded-lg border text-left font-700 transition-colors ${
                        method === id ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      {label}
                      <span className="block text-xs font-600 text-muted-foreground mt-1">
                        {id === 'cod'
                          ? 'Pay in cash when your food is delivered'
                          : id === 'esewa'
                            ? 'Pay online with eSewa'
                            : ''}
                      </span>
                    </button>
                  ))}

                  {!esewaLoading && !esewaConfig?.configured && (
                    <p className="text-sm text-muted-foreground">
                      Online payment is not available yet. Please use Cash on Delivery.
                    </p>
                  )}

                  {!codAvailable && (
                    <p className="text-sm text-muted-foreground">
                      Cash on Delivery is currently unavailable. Please check back later.
                    </p>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="bg-card rounded-2xl card-shadow p-3.5 sm:p-5">
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-800 text-sm">
                    3
                  </span>
                  <h2 className="text-base font-800">Food Items ({itemCount})</h2>
                </div>

                <div className="divide-y divide-border">
                  {checkoutItems.map((i) => (
                    <div
                      key={i.id + ':' + (i.variantId || 'default')}
                      className="flex flex-wrap items-center gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-muted/30 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={i.variantImage || i.image}
                          alt={i.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-700 text-sm sm:text-base line-clamp-1">{i.name}</p>
                        {(i.variantSize || i.variantColor) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[i.variantColor, i.variantSize].filter(Boolean).join(' • ')}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {money(i.price)} each
                        </p>
                      </div>
                      {/* Cart mode (no Buy Now intent): adjust quantity / remove */}
                      {!buyNowItems ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-stretch border border-border rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setFoodQty(i.id, Math.max(1, i.quantity - 1))}
                              className="w-8 flex items-center justify-center text-sm font-bold bg-muted/40 hover:bg-muted"
                              aria-label={`Decrease quantity of ${i.name}`}
                            >
                              −
                            </button>
                            <span className="w-9 flex items-center justify-center text-sm font-800">
                              {i.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => setFoodQty(i.id, i.quantity + 1)}
                              className="w-8 flex items-center justify-center text-sm font-bold bg-muted/40 hover:bg-muted"
                              aria-label={`Increase quantity of ${i.name}`}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFood(i.id)}
                            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-red-600 hover:border-red-200"
                            aria-label={`Remove ${i.name} from food cart`}
                            title="Remove"
                          >
                            <Icon name="TrashIcon" size={16} />
                          </button>
                          <b className="text-[13px] flex-shrink-0 w-20 text-right">
                            {money(i.price * i.quantity)}
                          </b>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Qty {i.quantity}</span>
                          <b className="text-[13px] flex-shrink-0">{money(i.price * i.quantity)}</b>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Coupon */}
              <div className="bg-card rounded-2xl card-shadow p-3.5 sm:p-5">
                <label
                  htmlFor="food-checkout-coupon"
                  className="text-xs font-700 uppercase tracking-widest text-muted-foreground block mb-2"
                >
                  Coupon Code (optional)
                </label>
                <input
                  id="food-checkout-coupon"
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Coupon is validated when you place your order. Any discount is applied to the
                  final total on your order confirmation.
                </p>
              </div>

              {error && (
                <p className="text-red-500 text-sm font-600 flex items-center gap-2">
                  <Icon name="ExclamationTriangleIcon" size={16} />
                  {error}
                </p>
              )}

              {/* Desktop place order */}
              <button
                onClick={placeFoodOrder}
                disabled={!canSubmit}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50 hidden lg:inline-flex"
              >
                {submitting ? 'Placing food order...' : 'Place Food Order'}
                {!submitting && <Icon name="FireIcon" size={18} />}
              </button>
            </section>

            {/* -- Right column: sticky order summary -- */}
            <aside className="bg-card rounded-2xl card-shadow p-4 lg:sticky lg:top-20">
              <h2 className="text-lg font-800 mb-5">Order Summary</h2>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                  <span className="font-600">{money(checkoutSubtotal)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  {shipping === 0 ? (
                    <span className="text-green-600 font-700">FREE</span>
                  ) : (
                    <span className="font-600">{money(shipping)}</span>
                  )}
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Tax</span>
                  <span className="font-600">{money(tax)}</span>
                </div>

                {savings > 0 && (
                  <div className="flex justify-between text-sm bg-green-50 rounded-xl px-3 py-2">
                    <span className="text-green-700 font-600 flex items-center gap-1">
                      <Icon name="CheckBadgeIcon" size={14} />
                      You&apos;re saving
                    </span>
                    <span className="text-green-700 font-800">{money(savings)}</span>
                  </div>
                )}
              </div>

              {shipping > 0 ? (
                <div className="mb-5 bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-600 mb-2">
                    Add{' '}
                    <span className="text-primary font-800">{money(remainingForFreeShipping)}</span>{' '}
                    more for FREE delivery
                  </p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${shippingProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                freeShippingThreshold > 0 && (
                  <div className="mb-5 bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-green-700 font-700 flex items-center gap-2">
                      <Icon name="CheckCircleIcon" size={15} />
                      You&apos;ve unlocked FREE delivery!
                    </p>
                  </div>
                )
              )}

              <div className="rounded-xl bg-primary/5 px-4 py-3 mb-6">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-base font-800 text-primary">Total</span>
                  <span className="text-2xl font-800 text-primary">{money(total)}</span>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <Icon name="ShieldCheckIcon" size={13} />
                Your food order is validated securely before confirmation.
              </p>
            </aside>
          </div>
        </div>
      </main>

      {/* -- Mobile sticky place-order bar -- */}
      <div
        className="lg:hidden fixed left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 pt-3"
        style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-stretch gap-3">
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider leading-tight">
              Total
            </p>
            <p className="text-lg font-800 text-primary leading-tight truncate">{money(total)}</p>
          </div>
          <button
            onClick={placeFoodOrder}
            disabled={!canSubmit}
            className="btn-primary flex-1 justify-center px-4 min-h-[46px] disabled:opacity-50"
          >
            {submitting ? 'Placing food order...' : 'Place Food Order'}
            {!submitting && <Icon name="FireIcon" size={18} />}
          </button>
        </div>
      </div>

      <Footer />
      <BottomNav />
    </div>
  );
}
