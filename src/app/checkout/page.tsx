'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import LocationPicker from '@/components/LocationPicker/LocationPicker';
import { supabase } from '@/lib/supabase';

interface Address {
  id: string;
  label?: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  is_default: boolean;
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

const PAYMENT_METHODS: Array<[string, string]> = [['cod', 'Cash on Delivery']];

interface StoreSettings {
  currency: string;
  shipping_charge: number;
  free_shipping_threshold: number;
  tax_percent: number;
  cod_enabled: boolean;
  online_payment_enabled: boolean;
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNewAddress, setUseNewAddress] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [method, setMethod] = useState('cod');
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  const shippingCharge = settings?.shipping_charge ?? 200;
  const freeShippingThreshold = settings?.free_shipping_threshold ?? 6500;
  const taxPercent = settings?.tax_percent ?? 13;
  const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCharge;
  const tax = subtotal * (taxPercent / 100);
  const total = subtotal + shipping + tax;

  const availableMethods = PAYMENT_METHODS.filter(
    ([id]) => id === 'cod' && (settings?.cod_enabled ?? true)
  );

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
      } else {
        if (!cancelled) setLoginRequired(true);
      }
      if (!cancelled) setLoadingUser(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from('store_settings').select('*').limit(1).maybeSingle();
      if (!cancelled && data) {
        setSettings(data as StoreSettings);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const available = availableMethods.map(([id]) => id);
    if (!available.includes(method)) {
      setMethod(available[0] || 'cod');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const placeOrder = async () => {
    setError('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('Please login before placing an order.');
      setLoginRequired(true);
      router.push('/account');
      return;
    }

    // Resolve the delivery address.
    let recipient_name = name.trim();
    let phoneValue = phone.trim();
    let addressLine = address.trim();
    let cityValue = city.trim();
    let addressError = '';

    if (!selectedAddressId || useNewAddress) {
      if (!recipient_name) addressError = 'Please enter the recipient name.';
      else if (!phoneValue) addressError = 'Please enter a phone number.';
      else if (!addressLine) addressError = 'Please enter the delivery address.';
      else if (!cityValue) addressError = 'Please enter the city.';
    } else {
      const selected = addresses.find((a) => a.id === selectedAddressId);
      if (selected) {
        recipient_name = selected.recipient_name;
        phoneValue = selected.phone;
        addressLine = selected.address_line;
        cityValue = selected.city;
      } else {
        addressError = 'Please select a valid delivery address.';
      }
    }

    if (addressError) {
      setError(addressError);
      return;
    }

    setSubmitting(true);

    const settingsMethods = availableMethods.map(([id]) => id);
    if (!settingsMethods.includes(method)) {
      setSubmitting(false);
      setError('This payment method is unavailable. Please choose another.');
      return;
    }

    const itemsPayload = items.map((i) => ({
      product_id: i.id,
      quantity: i.quantity,
    }));

    const addressPayload = {
      recipient_name,
      phone: phoneValue,
      address_line: addressLine,
      city: cityValue,
    };

    const { data, error: rpcError } = await supabase.rpc('place_order', {
      p_items: itemsPayload,
      p_address: addressPayload,
      p_payment_method: method,
      p_coupon_code: couponCode.trim() || null,
    });

    if (rpcError) {
      console.error('Place order error:', rpcError);
      setError(rpcError.message || 'Unable to place order. Please try again.');
      setSubmitting(false);
      return;
    }

    const created = data as PlacedOrder;
    clearCart();
    setPlacedOrder(created);
    setSubmitting(false);
  };

  if (placedOrder) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 pb-20 px-4">
          <div className="max-w-2xl mx-auto bg-card rounded-3xl card-shadow p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-5">
              <Icon name="CheckCircleIcon" size={32} className="text-green-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-800 mb-2">Order Placed!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for your purchase. Your order has been confirmed.
            </p>
            <div className="bg-muted/60 rounded-2xl p-5 mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Order Number
              </p>
              <p className="text-xl font-800 text-primary">{placedOrder.order_number}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Total: रू{Number(placedOrder.total).toLocaleString('en-IN')} · Status:{' '}
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
              <Link href="/account" className="btn-primary justify-center">
                <Icon name="ShoppingBagIcon" size={18} />
                View My Orders
              </Link>
              <Link href="/products" className="btn-outline justify-center">
                Continue Shopping
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
        <main className="min-h-screen pt-32 text-center px-4">
          <div className="max-w-md mx-auto">
            <Icon
              name="LockClosedIcon"
              size={44}
              className="mx-auto mb-5 text-muted-foreground/40"
            />
            <h1 className="text-2xl font-800 mb-3">Login to Checkout</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to your account before placing an order.
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

  if (!items.length) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-32 text-center px-4">
          <h1 className="text-2xl font-800">Your cart is empty</h1>
          <Link href="/products" className="btn-primary inline-flex mt-5">
            Shop Products
          </Link>
        </main>
        <Footer />
        <BottomNav />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-900 mb-8">Checkout</h1>

          <div className="grid lg:grid-cols-3 gap-7">
            <section className="lg:col-span-2 bg-card rounded-2xl card-shadow p-6">
              {loadingUser ? (
                <p className="text-sm text-muted-foreground">Loading delivery details...</p>
              ) : (
                <>
                  {addresses.length > 0 && (
                    <>
                      <h2 className="text-xl font-800 mb-4">Delivery Address</h2>
                      <div className="space-y-3 mb-6">
                        {addresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                              selectedAddressId === addr.id && !useNewAddress
                                ? 'border-primary bg-primary/5'
                                : 'border-border'
                            }`}
                          >
                            <input
                              type="radio"
                              name="saved-address"
                              className="mt-1"
                              checked={selectedAddressId === addr.id && !useNewAddress}
                              onChange={() => {
                                setUseNewAddress(false);
                                setSelectedAddressId(addr.id);
                                setError('');
                              }}
                            />
                            <div className="flex-1">
                              {addr.label && (
                                <span className="text-xs font-700 text-primary uppercase tracking-wider">
                                  {addr.label}
                                </span>
                              )}
                              <p className="font-700 text-sm mt-0.5">{addr.recipient_name}</p>
                              <p className="text-sm text-muted-foreground">{addr.address_line}</p>
                              <p className="text-sm text-muted-foreground">{addr.city}</p>
                              <p className="text-sm text-muted-foreground">{addr.phone}</p>
                              {addr.is_default && (
                                <span className="text-xs font-700 text-green-600">Default</span>
                              )}
                            </div>
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setUseNewAddress(true);
                            setSelectedAddressId(null);
                          }}
                          className="text-sm font-700 text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Icon name="PlusIcon" size={15} />
                          Use a new address
                        </button>
                      </div>
                    </>
                  )}

                  {(addresses.length === 0 || useNewAddress) && (
                    <div>
                      <h2 className="text-xl font-800 mb-5">Delivery Details</h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <input
                          className="input-search"
                          placeholder="Full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                        <input
                          className="input-search"
                          placeholder="Phone number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                        <LocationPicker
                          address={address}
                          onAddressChange={setAddress}
                          onLocationChange={setLocation}
                        />
                        <input
                          className="input-search"
                          placeholder="City"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <h2 className="text-xl font-800 mt-8 mb-4">Payment Method</h2>

              <div className="grid sm:grid-cols-3 gap-3">
                {availableMethods.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMethod(id)}
                    className={`p-4 rounded-xl border text-left font-700 ${
                      method === id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    {label}
                    <span className="block text-xs font-600 text-muted-foreground mt-1">
                      Pay in cash on delivery
                    </span>
                  </button>
                ))}

                {settings?.online_payment_enabled && (
                  <div className="p-4 rounded-xl border border-dashed border-border text-left font-700 opacity-70">
                    Online Payment
                    <span className="block text-xs font-600 text-muted-foreground mt-1">
                      Coming soon
                    </span>
                  </div>
                )}
              </div>

              {availableMethods.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Cash on Delivery is currently unavailable. Please check back later.
                </p>
              )}

              <div className="mt-6">
                <label
                  htmlFor="checkout-coupon"
                  className="text-xs font-700 uppercase tracking-widest text-muted-foreground block mb-2"
                >
                  Coupon Code (optional)
                </label>
                <input
                  id="checkout-coupon"
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="w-full sm:w-72 rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Coupon is validated when you place your order.
                </p>
              </div>

              {error && <p className="text-red-500 text-sm font-600 mt-4">{error}</p>}
            </section>

            <aside className="bg-card rounded-2xl card-shadow p-6 h-fit">
              <h2 className="text-xl font-800 mb-5">Order Summary</h2>

              <div className="space-y-3">
                {items.map((i) => (
                  <div key={i.id} className="flex justify-between gap-3 text-sm">
                    <span className="line-clamp-1">
                      {i.name} × {i.quantity}
                    </span>
                    <b>रू{(i.price * i.quantity).toLocaleString()}</b>
                  </div>
                ))}

                <hr className="border-border" />

                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <b>रू{subtotal.toLocaleString()}</b>
                </div>

                <div className="flex justify-between">
                  <span>Shipping</span>
                  <b>{shipping ? `रू${shipping}` : 'FREE'}</b>
                </div>

                <div className="flex justify-between">
                  <span>Estimated Tax</span>
                  <b>रू{tax.toLocaleString()}</b>
                </div>

                {couponCode.trim() && (
                  <p className="text-xs text-muted-foreground">Discount applied at confirmation.</p>
                )}

                <div className="flex justify-between text-lg font-900 pt-2">
                  <span>Total</span>
                  <span className="text-primary">रू{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={placeOrder}
                disabled={submitting || loadingUser}
                className="btn-primary w-full justify-center mt-6 py-4 disabled:opacity-50"
              >
                {submitting ? 'Placing order...' : 'Place Order'}
                {!submitting && <Icon name="CheckIcon" size={18} />}
              </button>

              <p className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                <Icon name="ShieldCheckIcon" size={13} />
                Your order is validated securely before confirmation.
              </p>

              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="px-3 py-1.5 rounded-lg bg-muted text-xs font-700">COD</span>
                <span className="px-3 py-1.5 rounded-lg bg-muted text-xs font-700">
                  Online (coming soon)
                </span>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
