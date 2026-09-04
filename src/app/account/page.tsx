'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import PasswordlessAuth from '@/components/auth/PasswordlessAuth';
import AddressLocationPicker from '@/components/LocationPicker/AddressLocationPicker';
import NepalPhoneInput from '@/components/NepalPhoneInput';
import { normalizeNepalMobile, toCanonicalNepalMobile } from '@/lib/nepalPhone';

interface Order {
  id: string;
  status?: string;
  orderNumber?: string;
  createdAt: string;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  items?: any[];
  itemCount?: number;
}

interface Address {
  id: string;
  user_id: string;
  label?: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  is_default: boolean;
}

function safeErrorMessage(error?: { message?: string } | null): string {
  return error?.message || 'Something went wrong. Please try again.';
}

export default function AccountPage() {
  const { user, loading: authLoading, loggedIn, profile, logout } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [profileName, setProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profilePhoneError, setProfilePhoneError] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: '',
    recipient_name: '',
    phone: '',
    address_line: '',
    city: '',
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMessage, setAddressMessage] = useState('');
  const [addressError, setAddressError] = useState('');
  const [addressPhoneError, setAddressPhoneError] = useState('');

  const loadOrders = async (userId: string) => {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase orders error:', error);
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    const orders = data ?? [];
    let itemCountMap: Record<string, number> = {};

    if (orders.length > 0) {
      const ids = orders.map((o) => o.id);
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('order_id, quantity')
        .in('order_id', ids);

      if (!itemsError && orderItems) {
        itemCountMap = orderItems.reduce<Record<string, number>>((map, row) => {
          map[row.order_id] = (map[row.order_id] || 0) + Number(row.quantity || 0);
          return map;
        }, {});
      }
    }

    const mappedOrders: Order[] = orders.map((order) => ({
      id: order.id,
      status: order.status,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      total: Number(order.total || 0),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      items: order.items || [],
      itemCount: itemCountMap[order.id],
    }));

    setOrders(mappedOrders);
    setOrdersLoading(false);
  };

  const loadAddresses = async (userId: string) => {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase addresses error:', error);
      setAddresses([]);
      return;
    }
    setAddresses((data ?? []) as Address[]);
  };

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      setProfileName(profile.name);
      setProfilePhone(profile.phone ? profile.phone.replace(/^\+?977/, '') : '');
      setProfileCity(user.user_metadata?.city || '');
      setAvatarUrl(profile.avatarUrl);
      loadOrders(user.id);
      loadAddresses(user.id);
    } else {
      setOrders([]);
      setAddresses([]);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (user) {
      setProfileName(profile.name);
      setAvatarUrl(profile.avatarUrl);
    }
  }, [profile.name, profile.avatarUrl, user]);

  const openProfile = () => {
    setProfileName(profile.name);
    setProfilePhone(profile.phone ? profile.phone.replace(/^\+?977/, '') : '');
    setProfileAddress(user?.user_metadata?.address || '');
    setProfileCity(user?.user_metadata?.city || '');
    setProfileMessage('');
    setProfileError('');
    setProfilePhoneError('');
    setShowProfile(true);
  };

  const handleProfileCancel = () => {
    setProfileName(profile.name);
    setProfileMessage('');
    setProfileError('');
    setProfilePhoneError('');
    setShowProfile(false);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const updatedName = profileName.trim();
    if (!updatedName) {
      setProfileError('Please enter your full name.');
      return;
    }

    const phoneCanonical = toCanonicalNepalMobile(profilePhone);
    if (!phoneCanonical) {
      setProfilePhoneError('Enter a valid 10-digit Nepal mobile number.');
      setProfileError('Enter a valid 10-digit Nepal mobile number.');
      return;
    }

    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');
    setProfilePhoneError('');

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: updatedName,
        phone: phoneCanonical,
        address: profileAddress.trim(),
        city: profileCity.trim(),
      },
    });

    if (error) {
      setProfileError(safeErrorMessage(error));
      setProfileSaving(false);
      return;
    }

    setProfileMessage('Your profile has been updated successfully.');
    setProfileSaving(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSettingsError('Please choose an image file.');
      return;
    }
    setAvatarUploading(true);
    setSettingsError('');
    setSettingsMessage('');
    if (!user) {
      setSettingsError('Please sign in to update your profile photo.');
      setAvatarUploading(false);
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setSettingsError('Profile photo upload unavailable. Please try again.');
      setAvatarUploading(false);
      return;
    }
    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl.publicUrl } });
    if (error) setSettingsError(safeErrorMessage(error));
    else {
      setAvatarUrl(publicUrl.publicUrl);
      setSettingsMessage('Profile photo updated successfully.');
    }
    setAvatarUploading(false);
  };

  const handleRemoveAvatar = async () => {
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
    if (error) setSettingsError(safeErrorMessage(error));
    else {
      setAvatarUrl('');
      setSettingsMessage('Profile photo removed.');
    }
  };

  const openAddressForm = (address?: Address) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label || '',
        recipient_name: address.recipient_name,
        phone: address.phone.replace(/^\+?977/, ''),
        address_line: address.address_line,
        city: address.city,
      });
    } else {
      setEditingAddress(null);
      setAddressForm({ label: '', recipient_name: '', phone: '', address_line: '', city: '' });
    }
    setAddressMessage('');
    setAddressError('');
    setAddressPhoneError('');
    setShowAddressForm(true);
  };

  const handleAddressClose = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
    setAddressMessage('');
    setAddressError('');
    setAddressPhoneError('');
  };

  const handleAddressSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError('');
    setAddressMessage('');
    setAddressPhoneError('');

    const phoneCanonical = toCanonicalNepalMobile(addressForm.phone);

    const formData = {
      label: addressForm.label.trim() || null,
      recipient_name: addressForm.recipient_name.trim(),
      phone: phoneCanonical || addressForm.phone.trim(),
      address_line: addressForm.address_line.trim(),
      city: addressForm.city.trim(),
    };

    if (!formData.recipient_name || !formData.phone || !formData.address_line || !formData.city) {
      setAddressError('Please fill in all required address fields.');
      return;
    }

    if (!phoneCanonical) {
      setAddressPhoneError('Enter a valid 10-digit Nepal mobile number.');
      setAddressError('Enter a valid 10-digit Nepal mobile number.');
      return;
    }

    if (!user) {
      setAddressError('Please login to save an address.');
      return;
    }

    setAddressSaving(true);

    if (editingAddress) {
      const { error } = await supabase
        .from('addresses')
        .update(formData)
        .eq('id', editingAddress.id)
        .eq('user_id', user.id);
      if (error) {
        setAddressError(safeErrorMessage(error));
        setAddressSaving(false);
        return;
      }
      setAddressMessage('Address updated successfully.');
    } else {
      const { error } = await supabase.from('addresses').insert({ ...formData, user_id: user.id });
      if (error) {
        setAddressError(safeErrorMessage(error));
        setAddressSaving(false);
        return;
      }
      setAddressMessage('Address added successfully.');
    }

    setAddressSaving(false);
    setShowAddressForm(false);
    setEditingAddress(null);
    await loadAddresses(user.id);
  };

  const handleAddressDelete = async (address: Address) => {
    if (!window.confirm('Delete this address?')) return;
    if (!user) return;
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', address.id)
      .eq('user_id', user.id);
    if (error) {
      setAddressError(safeErrorMessage(error));
      return;
    }
    setAddressError('');
    await loadAddresses(user.id);
  };

  const handleSetDefaultAddress = async (address: Address) => {
    if (!user) return;

    const owner = addresses.find((a) => a.id === address.id);
    if (!owner || owner.user_id !== user.id) return;

    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
    await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', address.id)
      .eq('user_id', user.id);
    await loadAddresses(user.id);
  };

  const handleLogout = async () => {
    await logout();
    setOrders([]);
    setAddresses([]);
  };

  const handleAuthenticated = () => {
    setShowAuth(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-28 pb-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="bg-card rounded-3xl card-shadow overflow-hidden mb-6">
              <div className="p-6 md:p-8 flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-24" />
                  <div className="h-7 bg-muted rounded animate-pulse w-48" />
                  <div className="h-3 bg-muted rounded animate-pulse w-36" />
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-border">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="p-4 text-center space-y-1">
                    <div className="h-5 bg-muted rounded animate-pulse mx-auto w-12" />
                    <div className="h-3 bg-muted rounded animate-pulse mx-auto w-10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-28 pb-20">
          <div className="max-w-lg mx-auto px-4 sm:px-6">
            <section className="bg-card rounded-3xl card-shadow overflow-hidden mb-6">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Icon name="UserCircleIcon" size={52} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-primary font-700 mb-1">YourMarket Account</p>
                    <h1 className="text-2xl font-800 text-foreground">Guest</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                      Sign in to manage orders, save addresses, submit products, and more.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-card rounded-3xl card-shadow p-6 mb-6">
              <div className="text-center max-w-sm mx-auto">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon name="LockClosedIcon" size={26} className="text-primary" />
                </div>
                <h2 className="text-xl font-800 mb-2">Sign in to YourMarket</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Track orders, save addresses, manage submissions, and enjoy a personalized
                  experience.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  className="w-full btn-primary py-3"
                >
                  Continue with Google
                </button>
              </div>
            </section>

            <section className="mb-6">
              <Link
                href="/account/send-product"
                className="bg-card rounded-3xl card-shadow p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="PaperAirplaneIcon" size={26} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-800">Send Your Product</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Have something to sell? Submit your product for review.
                  </p>
                </div>
                <Icon name="ArrowRightIcon" size={20} className="text-primary shrink-0" />
              </Link>
            </section>
          </div>
        </main>

        {showAuth && (
          <PasswordlessAuth
            onClose={() => setShowAuth(false)}
            onAuthenticated={handleAuthenticated}
          />
        )}

        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <section className="bg-card rounded-3xl card-shadow overflow-hidden mb-6">
            <div className="p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                  {avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="UserCircleIcon" size={52} className="text-primary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary font-700 mb-1">Welcome back</p>
                  <h1 className="text-2xl md:text-3xl font-800 text-foreground truncate">
                    {profile.name}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2 truncate">
                    {profile.email || profile.phone || 'Member'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-5 py-3 rounded-xl border border-border text-sm font-700 hover:bg-muted transition-colors self-start shrink-0"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon name="ArrowRightOnRectangleIcon" size={17} />
                    Logout
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <div className="bg-card rounded-3xl card-shadow p-5 md:p-7">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-800">My Orders</h2>
                  <p className="text-sm text-muted-foreground mt-1">Your recent purchases</p>
                </div>
                <Link href="/products" className="text-sm font-700 text-primary">
                  Shop Products
                </Link>
              </div>

              {ordersLoading ? (
                <div className="py-14 text-center">
                  <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Loading your orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-14 text-center border border-dashed border-border rounded-2xl">
                  <Icon
                    name="ShoppingBagIcon"
                    size={42}
                    className="mx-auto mb-4 text-muted-foreground/30"
                  />
                  <h3 className="font-800 text-lg mb-2">No orders yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Your purchases will appear here after checkout.
                  </p>
                  <Link
                    href="/products"
                    className="btn-primary inline-flex items-center gap-2 px-6 py-3"
                  >
                    <Icon name="ShoppingBagIcon" size={17} />
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/account/orders/${order.id}`}
                      className="block border border-border rounded-2xl p-5 hover:border-primary/40 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                        <div>
                          <p className="font-800">
                            {order.orderNumber
                              ? `Order ${order.orderNumber}`
                              : `Order #${order.id}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(order.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="text-lg font-800">
                            रू{Number(order.total || 0).toLocaleString('en-IN')}
                          </p>
                          <span
                            className={`text-xs font-800 ${
                              order.status === 'Cancelled' || order.status === 'Refunded'
                                ? 'text-red-600'
                                : order.status === 'Delivered'
                                  ? 'text-green-600'
                                  : 'text-blue-600'
                            }`}
                          >
                            {order.status || 'Pending'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground flex items-center justify-between">
                        <span>
                          {order.itemCount ?? order.items?.length ?? 0} item(s)·{' '}
                          {order.paymentMethod === 'cod'
                            ? 'Cash on Delivery'
                            : (order.paymentMethod || 'cod').replace(/^./, (c) => c.toUpperCase())}
                          {order.paymentStatus ? (
                            <span className="ml-1 capitalize">· {order.paymentStatus}</span>
                          ) : null}
                        </span>
                        <span className="inline-flex items-center gap-1 text-primary font-700 text-xs">
                          View Details
                          <Icon name="ArrowRightIcon" size={14} />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="mb-6 space-y-3">
            <button
              type="button"
              onClick={openProfile}
              className="w-full bg-card rounded-3xl card-shadow p-5 md:p-6 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-transform"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="UserIcon" size={26} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-800">My Profile</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Edit your name, contact and delivery details.
                </p>
              </div>
              <Icon name="ArrowRightIcon" size={20} className="text-primary shrink-0" />
            </button>

            <Link
              href="/account/send-product"
              className="bg-card rounded-3xl card-shadow p-5 md:p-6 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="PaperAirplaneIcon" size={26} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-800">Send Your Product</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Have something to sell? Submit your product details.
                </p>
              </div>
              <Icon name="ArrowRightIcon" size={20} className="text-primary shrink-0" />
            </Link>

            <Link
              href="/account/submissions"
              className="bg-card rounded-3xl card-shadow p-5 md:p-6 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="DocumentTextIcon" size={26} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-800">My Submissions</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  View status of your product submissions.
                </p>
              </div>
              <Icon name="ArrowRightIcon" size={20} className="text-primary shrink-0" />
            </Link>
          </section>
        </div>
      </main>

      {showAuth && (
        <PasswordlessAuth
          onClose={() => setShowAuth(false)}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {showProfile && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-800">My Profile</h2>
              <button
                type="button"
                onClick={handleProfileCancel}
                className="p-2 rounded-full hover:bg-muted"
                aria-label="Close profile"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label htmlFor="profile-name" className="block text-xs text-muted-foreground mb-1">
                  Full Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 font-800 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="profile-phone"
                    className="block text-xs text-muted-foreground mb-1"
                  >
                    Phone number
                  </label>
                  <NepalPhoneInput
                    id="profile-phone"
                    value={profilePhone}
                    onChange={(local) => {
                      setProfilePhone(local);
                      setProfilePhoneError('');
                    }}
                    error={profilePhoneError}
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-city"
                    className="block text-xs text-muted-foreground mb-1"
                  >
                    Default city
                  </label>
                  <input
                    id="profile-city"
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="profile-address"
                  className="block text-xs text-muted-foreground mb-1"
                >
                  Default shipping address
                </label>
                <textarea
                  id="profile-address"
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="p-4 rounded-2xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="font-800 break-all">{profile.email}</p>
              </div>
              <div className="p-4 rounded-2xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Account Type</p>
                <p className="font-800">Member</p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2">Profile photo</p>
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon name="UserCircleIcon" size={30} className="text-primary" />
                    </div>
                  )}
                  <label className="btn-primary px-3 py-2 text-xs cursor-pointer">
                    {avatarUploading ? 'Uploading...' : 'Upload photo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={avatarUploading}
                      className="hidden"
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={avatarUploading}
                      className="text-xs font-700 text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {settingsError && <p className="text-sm text-red-500 font-600">{settingsError}</p>}
              {settingsMessage && (
                <p className="text-sm text-green-600 font-600">{settingsMessage}</p>
              )}
              {profileError && <p className="text-sm text-red-500 font-600">{profileError}</p>}
              {profileMessage && (
                <p className="text-sm text-green-600 font-600">{profileMessage}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleProfileCancel}
                  disabled={profileSaving}
                  className="flex-1 py-3 rounded-xl bg-muted font-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="btn-primary flex-1 justify-center py-3 disabled:opacity-50"
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-8">
        <div className="bg-card rounded-3xl card-shadow p-5 md:p-7">
          <h2 className="text-xl md:text-2xl font-800">Account Security</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Your account uses passwordless Google sign-in. No password to remember or reset.
          </p>
          {(settingsError || settingsMessage) && (
            <p
              className={`text-sm font-600 mt-4 ${settingsError ? 'text-red-500' : 'text-green-600'}`}
            >
              {settingsError || settingsMessage}
            </p>
          )}
        </div>
      </section>

      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-20">
        <div className="bg-card rounded-3xl card-shadow p-5 md:p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-800">My Addresses</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your saved delivery addresses
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddressForm()}
              className="btn-primary px-4 py-2 text-sm"
            >
              <Icon name="PlusIcon" size={16} />
              Add Address
            </button>
          </div>

          {addressError && <p className="text-sm text-red-500 font-600 mb-4">{addressError}</p>}

          {addresses.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-border rounded-2xl">
              <Icon name="MapPinIcon" size={36} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm mb-4">
                You haven&apos;t saved any addresses yet.
              </p>
              <button
                type="button"
                onClick={() => openAddressForm()}
                className="text-sm font-700 text-primary hover:underline"
              >
                Add your first address
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div key={addr.id} className="border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {addr.label && (
                        <span className="text-xs font-700 text-primary uppercase tracking-wider">
                          {addr.label}
                        </span>
                      )}
                      {addr.is_default && (
                        <span className="text-[10px] font-800 bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openAddressForm(addr)}
                        className="p-1.5 rounded-lg hover:bg-muted"
                        aria-label="Edit address"
                      >
                        <Icon name="PencilIcon" size={15} className="text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddressDelete(addr)}
                        className="p-1.5 rounded-lg hover:bg-red-50"
                        aria-label="Delete address"
                      >
                        <Icon name="TrashIcon" size={15} className="text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <p className="font-700 text-sm">{addr.recipient_name}</p>
                  <p className="text-sm text-muted-foreground">{addr.address_line}</p>
                  <p className="text-sm text-muted-foreground">{addr.city}</p>
                  <p className="text-sm text-muted-foreground">{addr.phone}</p>
                  {!addr.is_default && (
                    <button
                      type="button"
                      onClick={() => handleSetDefaultAddress(addr)}
                      className="mt-3 text-xs font-700 text-primary hover:underline"
                    >
                      Set as default
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {showAddressForm && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-[520px] sm:max-w-[540px] lg:max-w-[560px] bg-card rounded-3xl shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
              <h2 className="text-xl font-800">
                {editingAddress ? 'Edit Address' : 'Add Address'}
              </h2>
              <button
                type="button"
                onClick={handleAddressClose}
                className="p-2 rounded-full hover:bg-muted"
                aria-label="Close"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>
            <form
              onSubmit={handleAddressSave}
              className="space-y-3.5 px-6 pb-0 overflow-y-auto flex-1 min-h-0"
            >
              <div>
                <label htmlFor="addr-label" className="block text-xs text-muted-foreground mb-1">
                  Label (e.g. Home, Work) <span className="opacity-60">optional</span>
                </label>
                <input
                  id="addr-label"
                  type="text"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Home"
                  className="w-full rounded-xl border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-primary/20 h-11"
                />
              </div>
              <div>
                <label htmlFor="addr-name" className="block text-xs text-muted-foreground mb-1">
                  Recipient name
                </label>
                <input
                  id="addr-name"
                  type="text"
                  required
                  value={addressForm.recipient_name}
                  onChange={(e) =>
                    setAddressForm((f) => ({ ...f, recipient_name: e.target.value }))
                  }
                  placeholder="Full name"
                  className="w-full rounded-xl border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-primary/20 h-11"
                />
              </div>
              <div>
                <label htmlFor="addr-phone" className="block text-xs text-muted-foreground mb-1">
                  Phone
                </label>
                <NepalPhoneInput
                  id="addr-phone"
                  value={addressForm.phone}
                  onChange={(local) => setAddressForm((f) => ({ ...f, phone: local }))}
                  error={addressPhoneError}
                />
              </div>
              <div>
                <label htmlFor="addr-line" className="block text-xs text-muted-foreground mb-1">
                  Address
                </label>
                <textarea
                  id="addr-line"
                  required
                  rows={2}
                  value={addressForm.address_line}
                  onChange={(e) => setAddressForm((f) => ({ ...f, address_line: e.target.value }))}
                  placeholder="Street address, area"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 resize-none h-[72px]"
                />
              </div>
              <div>
                <label htmlFor="addr-city" className="block text-xs text-muted-foreground mb-1">
                  City
                </label>
                <input
                  id="addr-city"
                  type="text"
                  required
                  value={addressForm.city}
                  onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                  className="w-full rounded-xl border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-primary/20 h-11"
                />
              </div>

              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-2">
                  Your location is only used to help fill your delivery address.
                </p>
                <AddressLocationPicker
                  onStreetChange={(street) =>
                    setAddressForm((f) => ({ ...f, address_line: street }))
                  }
                  onCityChange={(city) => setAddressForm((f) => ({ ...f, city }))}
                />
              </div>

              {addressError && <p className="text-sm text-red-500 font-600">{addressError}</p>}
              {addressMessage && (
                <p className="text-sm text-green-600 font-600">{addressMessage}</p>
              )}
              <div className="py-4 border-t border-border flex gap-3 shrink-0 sticky bottom-0 bg-card">
                <button
                  type="button"
                  onClick={handleAddressClose}
                  disabled={addressSaving}
                  className="flex-1 h-11 rounded-xl bg-muted font-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addressSaving}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-700 justify-center inline-flex items-center disabled:opacity-50"
                >
                  {addressSaving ? 'Saving...' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
