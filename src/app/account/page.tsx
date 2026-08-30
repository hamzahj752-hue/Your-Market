'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';

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
  customer?: {
    address?: string;
    city?: string;
    name?: string;
    phone?: string;
  };
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

const SAFE_USER_MESSAGES = new Set([
  'Invalid login credentials',
  'Email not confirmed',
  'User already registered',
  'Password should be at least 6 characters',
  'For security purposes, you can only request this once after 60 seconds',
  'Password reset link sent',
]);

function safeErrorMessage(error?: { message?: string } | null): string {
  const raw = error?.message;
  if (raw && SAFE_USER_MESSAGES.has(raw)) return raw;
  return 'Something went wrong. Please try again.';
}

export default function AccountPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
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
      customer: {
        name: order.customer_name,
        phone: order.phone,
        address: order.address,
        city: order.city,
      },
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
    const loadAccount = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        if (user) {
          setName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your Market User');
          setEmail(user.email || '');
          setProfilePhone(user.user_metadata?.phone || '');
          setProfileAddress(user.user_metadata?.address || '');
          setProfileCity(user.user_metadata?.city || '');
          setAvatarUrl(user.user_metadata?.avatar_url || '');
          setEmailVerified(!!user.email_confirmed_at);
          setLoggedIn(true);

          await loadOrders(user.id);
          await loadAddresses(user.id);
        } else {
          setName('');
          setEmail('');
          setLoggedIn(false);
          setOrders([]);
        }
      } catch (error) {
        console.error('Account loading error:', error);
        setOrders([]);
        setLoggedIn(false);
      }
    };

    loadAccount();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user;

      if (user) {
        setName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your Market User');
        setEmail(user.email || '');
        setEmailVerified(!!user.email_confirmed_at);
        setLoggedIn(true);

        await loadOrders(user.id);
        await loadAddresses(user.id);
      } else {
        setName('');
        setEmail('');
        setEmailVerified(false);
        setOrders([]);
        setAddresses([]);
        setLoggedIn(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setAuthError('Please enter your email address first.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/account/reset-password`,
    });

    if (error) {
      console.error('SUPABASE PASSWORD RESET ERROR:', error);
      setAuthError(safeErrorMessage(error));
      setAuthLoading(false);
      return;
    }

    setAuthError('Password reset link sent! Please check your email.');

    setAuthLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) return;

    setAuthLoading(true);
    setAuthError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.error('SUPABASE AUTH ERROR:', error);
      setAuthError(safeErrorMessage(error));
      setAuthLoading(false);
      return;
    }

    setName(
      data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Your Market User'
    );
    setEmail(data.user.email || email);
    setLoggedIn(true);
    setPassword('');
    setShowLogin(false);
    setAuthLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) return;

    setAuthLoading(true);
    setAuthError('');

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    if (error) {
      console.error('SUPABASE AUTH ERROR:', error);
      setAuthError(safeErrorMessage(error));
      setAuthLoading(false);
      return;
    }

    if (data.session) {
      setLoggedIn(true);
      setShowSignup(false);
    } else {
      setAuthError('Account created. Please check your email to confirm your account.');
      setShowSignup(false);
    }

    setPassword('');
    setAuthLoading(false);
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setAuthError('No email address found.');
      return;
    }

    setResendLoading(true);
    setAuthError('');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });

    if (error) {
      console.error('SUPABASE VERIFICATION ERROR:', error);
      setAuthError(safeErrorMessage(error));
      setResendLoading(false);
      return;
    }

    setAuthError('Verification email sent! Please check your inbox.');

    setResendLoading(false);
  };

  const openProfile = () => {
    setProfileName(name);
    setProfileMessage('');
    setProfileError('');
    setShowProfile(true);
  };

  const handleProfileCancel = () => {
    setProfileName(name);
    setProfileMessage('');
    setProfileError('');
    setShowProfile(false);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const updatedName = profileName.trim();

    if (!updatedName) {
      setProfileError('Please enter your full name.');
      return;
    }

    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: updatedName,
        phone: profilePhone.trim(),
        address: profileAddress.trim(),
        city: profileCity.trim(),
      },
    });

    if (error) {
      setProfileError(safeErrorMessage(error));
      setProfileSaving(false);
      return;
    }

    setName(updatedName);
    setProfileName(updatedName);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsMessage('');
    if (passwordForm.password.length < 6) {
      setSettingsError('Password must be at least 6 characters.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setSettingsError('Passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
    if (error) setSettingsError(safeErrorMessage(error));
    else {
      setPasswordForm({ password: '', confirm: '' });
      setSettingsMessage('Password changed successfully.');
    }
    setPasswordSaving(false);
  };

  const openAddressForm = (address?: Address) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label || '',
        recipient_name: address.recipient_name,
        phone: address.phone,
        address_line: address.address_line,
        city: address.city,
      });
    } else {
      setEditingAddress(null);
      setAddressForm({ label: '', recipient_name: '', phone: '', address_line: '', city: '' });
    }
    setAddressMessage('');
    setAddressError('');
    setShowAddressForm(true);
  };

  const handleAddressClose = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
    setAddressMessage('');
    setAddressError('');
  };

  const handleAddressSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError('');
    setAddressMessage('');

    const formData = {
      label: addressForm.label.trim() || null,
      recipient_name: addressForm.recipient_name.trim(),
      phone: addressForm.phone.trim(),
      address_line: addressForm.address_line.trim(),
      city: addressForm.city.trim(),
    };

    if (!formData.recipient_name || !formData.phone || !formData.address_line || !formData.city) {
      setAddressError('Please fill in all required address fields.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    await supabase.auth.signOut();

    setLoggedIn(false);
    setName('');
    setEmail('');
    setPassword('');
    setAuthError('');
  };

  const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Account Header */}
          <section className="bg-card rounded-3xl card-shadow overflow-hidden mb-6">
            <div className="p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Icon name="UserCircleIcon" size={52} className="text-primary" />
                </div>

                <div className="flex-1">
                  <p className="text-sm text-primary font-700 mb-1">
                    {loggedIn ? 'Welcome back' : 'Welcome to Your Market'}
                  </p>

                  <h1 className="text-2xl md:text-3xl font-800 text-foreground">
                    {loggedIn ? name : 'My Account'}
                  </h1>

                  <p className="text-sm text-muted-foreground mt-2">
                    {loggedIn ? email : 'Login or create an account to manage your shopping.'}
                  </p>
                </div>

                {loggedIn ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-5 py-3 rounded-xl border border-border text-sm font-700 hover:bg-muted transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon name="ArrowRightOnRectangleIcon" size={17} />
                      Logout
                    </span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLogin(true)}
                      className="btn-primary px-5 py-3"
                    >
                      Login
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSignup(true)}
                      className="px-5 py-3 rounded-xl border border-border font-700 text-sm hover:bg-muted transition-colors"
                    >
                      Sign Up
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!emailVerified && loggedIn && (
              <section className="bg-card rounded-3xl card-shadow p-5 mb-6 border border-yellow-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
                    <Icon name="EnvelopeIcon" size={24} className="text-yellow-600" />
                  </div>

                  <div className="flex-1">
                    <h2 className="font-800 text-lg">Verify your email</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      We sent a verification link to <strong>{email}</strong>. Please verify your
                      email to secure your account.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="btn-primary px-5 py-3 whitespace-nowrap disabled:opacity-50"
                  >
                    {resendLoading ? 'Sending...' : 'Resend Email'}
                  </button>
                </div>
              </section>
            )}

            {emailVerified && loggedIn && (
              <section className="bg-card rounded-3xl card-shadow p-4 mb-6 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="CheckCircleIcon" size={22} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-800 text-green-700">Email verified</p>
                    <p className="text-xs text-muted-foreground">
                      Your email address has been successfully verified.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 border-t border-border">
              <div className="p-4 text-center">
                <p className="text-xl font-800">{orders.length}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>

              <div className="p-4 text-center border-x border-border">
                <p className="text-xl font-800">रू{totalSpent.toLocaleString('en-IN')}</p>
                <p className="text-xs text-muted-foreground">Total Spent</p>
              </div>

              <div className="p-4 text-center">
                <p className="text-xl font-800">{loggedIn ? 'Member' : 'Guest'}</p>
                <p className="text-xs text-muted-foreground">Account</p>
              </div>
            </div>
          </section>

          {/* Login / Signup Buttons */}
          {!loggedIn && (
            <section className="bg-card rounded-3xl card-shadow p-6 mb-6">
              <div className="text-center max-w-xl mx-auto">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon name="LockClosedIcon" size={26} className="text-primary" />
                </div>

                <h2 className="text-xl font-800 mb-2">Sign in to your account</h2>

                <p className="text-sm text-muted-foreground mb-6">
                  Access your profile, orders and saved shopping preferences.
                </p>

                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLogin(true)}
                    className="btn-primary px-6 py-3"
                  >
                    Login
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSignup(true)}
                    className="px-6 py-3 rounded-xl border border-border font-700 text-sm"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Quick Actions */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <button
              type="button"
              onClick={openProfile}
              className="bg-card rounded-2xl card-shadow p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="UserIcon" size={22} className="text-primary" />
              </div>

              <div>
                <p className="font-800">My Profile</p>
                <p className="text-xs text-muted-foreground">Account information</p>
              </div>
            </button>

            <Link
              href="/wishlist"
              className="bg-card rounded-2xl card-shadow p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                <Icon name="HeartIcon" variant="solid" size={22} className="text-red-500" />
              </div>

              <div>
                <p className="font-800">Wishlist</p>
                <p className="text-xs text-muted-foreground">Saved products</p>
              </div>
            </Link>

            <Link
              href="/cart"
              className="bg-card rounded-2xl card-shadow p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                <Icon name="ShoppingCartIcon" size={22} className="text-orange-500" />
              </div>

              <div>
                <p className="font-800">Shopping Cart</p>
                <p className="text-xs text-muted-foreground">Review your cart</p>
              </div>
            </Link>

            <Link
              href="/account/notifications"
              className="bg-card rounded-2xl card-shadow p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Icon name="BellIcon" size={22} className="text-blue-500" />
              </div>

              <div>
                <p className="font-800">Notifications</p>
                <p className="text-xs text-muted-foreground">Order updates</p>
              </div>
            </Link>
          </section>
        </div>

        {loggedIn && (
          <section className="bg-card rounded-3xl card-shadow p-5 md:p-7">
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
                          {order.orderNumber ? `Order ${order.orderNumber}` : `Order #${order.id}`}
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
          </section>
        )}
      </main>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-800">Login</h2>

              <button
                type="button"
                onClick={() => setShowLogin(false)}
                aria-label="Close login"
                className="p-2 rounded-full hover:bg-muted"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={authLoading}
                  className="text-sm font-700 text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authLoading ? 'Sending reset email...' : 'Forgot Password?'}
                </button>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50"
              >
                {authLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-5">
              {authError ? (
                <span
                  className={`font-600 ${authError.startsWith('Password reset link sent') ? 'text-green-600' : 'text-red-500'}`}
                >
                  {authError}
                </span>
              ) : (
                'Login with your Your Market account.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {showSignup && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-800">Create Account</h2>

              <button
                type="button"
                onClick={() => setShowSignup(false)}
                aria-label="Close signup"
                className="p-2 rounded-full hover:bg-muted"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              <input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              <button type="submit" className="btn-primary w-full justify-center py-3">
                Create Account
              </button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-5">
              Your account will be created securely with Supabase authentication.
            </p>
          </div>
        </div>
      )}

      {/* Profile Modal */}
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

            {loggedIn ? (
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div>
                  <label
                    htmlFor="profile-name"
                    className="block text-xs text-muted-foreground mb-1"
                  >
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
                    <input
                      id="profile-phone"
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
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
                  <p className="font-800 break-all">{email}</p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Account Type</p>
                  <p className="font-800">Member</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-2">Profile photo</p>
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
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
                  <p className="text-xs text-muted-foreground mt-2">
                    Requires the avatars Storage bucket and policies to be created separately.
                  </p>
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
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                  <p className="font-800">Guest User</p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="font-800">Not signed in</p>
                </div>
                <button
                  type="button"
                  onClick={handleProfileCancel}
                  className="w-full py-3 rounded-xl bg-muted font-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {loggedIn && (
        <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-20">
          <div className="bg-card rounded-3xl card-shadow p-5 md:p-7">
            <h2 className="text-xl md:text-2xl font-800">Account Security</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Manage your password and sign-in security.
            </p>
            <form onSubmit={handlePasswordChange} className="grid sm:grid-cols-2 gap-3 max-w-2xl">
              <input
                type="password"
                required
                minLength={6}
                placeholder="New password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Confirm new password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={passwordSaving}
                className="btn-primary sm:col-span-2 justify-center py-3 disabled:opacity-50"
              >
                {passwordSaving ? 'Changing password...' : 'Change Password'}
              </button>
            </form>
            {(settingsError || settingsMessage) && (
              <p
                className={`text-sm font-600 mt-4 ${settingsError ? 'text-red-500' : 'text-green-600'}`}
              >
                {settingsError || settingsMessage}
              </p>
            )}
          </div>
        </section>
      )}

      {loggedIn && (
        <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-10">
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
                <Icon
                  name="MapPinIcon"
                  size={36}
                  className="mx-auto mb-3 text-muted-foreground/40"
                />
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
      )}

      {/* Address Modal */}
      {showAddressForm && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-800">
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
            <form onSubmit={handleAddressSave} className="space-y-4">
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
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
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
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label htmlFor="addr-phone" className="block text-xs text-muted-foreground mb-1">
                  Phone
                </label>
                <input
                  id="addr-phone"
                  type="tel"
                  required
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
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
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
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
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {addressError && <p className="text-sm text-red-500 font-600">{addressError}</p>}
              {addressMessage && (
                <p className="text-sm text-green-600 font-600">{addressMessage}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddressClose}
                  disabled={addressSaving}
                  className="flex-1 py-3 rounded-xl bg-muted font-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addressSaving}
                  className="btn-primary flex-1 justify-center py-3 disabled:opacity-50"
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
