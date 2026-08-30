'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setReady(true);
      } else {
        setError('This password reset link is invalid or has expired. Please request a new one.');
      }

      setChecking(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setReady(true);
        setError('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError('Unable to update your password. Please try again.');
      setLoading(false);
      return;
    }

    setMessage('Password updated successfully. Redirecting to your account...');

    await supabase.auth.signOut();

    setTimeout(() => {
      router.push('/account');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-20 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-card rounded-3xl card-shadow p-6 md:p-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Icon name="LockClosedIcon" size={27} className="text-primary" />
          </div>

          <h1 className="text-2xl font-800 text-center">Reset Password</h1>

          <p className="text-sm text-muted-foreground text-center mt-2 mb-7">
            Create a new password for your Your Market account.
          </p>

          {checking ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground mt-4">Checking reset session...</p>
            </div>
          ) : !ready ? (
            <div className="text-center">
              <p className="text-sm text-red-500 font-600 mb-5">{error}</p>

              <button
                type="button"
                onClick={() => router.push('/account')}
                className="btn-primary px-6 py-3"
              >
                Back to Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <input
                type="password"
                required
                minLength={6}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              <input
                type="password"
                required
                minLength={6}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
              />

              {error && <p className="text-sm text-red-500 font-600">{error}</p>}

              {message && <p className="text-sm text-green-600 font-600">{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50"
              >
                {loading ? 'Updating password...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
