'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';
import { getSafeOAuthRedirect } from '@/lib/auth';

interface Props {
  onClose: () => void;
  onAuthenticated: () => void;
}

export default function PasswordlessAuth({ onClose, onAuthenticated }: Props) {
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getSafeOAuthRedirect(),
        },
      });

      if (oauthError) {
        console.error('SUPABASE GOOGLE OAUTH ERROR:', oauthError);
        setError('Unable to start Google sign-in. Please try again.');
        setGoogleLoading(false);
      }
    } catch (err) {
      console.error('GOOGLE OAUTH EXCEPTION:', err);
      setError('Unable to start Google sign-in. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-800">Sign in</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign-in"
            className="p-2 rounded-full hover:bg-muted"
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Sign in securely with your Google account.
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3 font-700 text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          <GoogleG />
          {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
        </button>

        {error && <p className="text-sm text-red-500 font-600 mt-4">{error}</p>}
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
