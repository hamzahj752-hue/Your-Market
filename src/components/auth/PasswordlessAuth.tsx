'use client';

import React, { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';
import { normalizePhoneToE164, getSafeOAuthRedirect } from '@/lib/auth';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const OTP_EXPIRY_SECONDS = 300; // informative only; Supabase governs actual expiry

type Step = 'phone' | 'otp';

interface Props {
  onClose: () => void;
  onAuthenticated: () => void;
}

export default function PasswordlessAuth({ onClose, onAuthenticated }: Props) {
  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [normalized, setNormalized] = useState<ReturnType<typeof normalizePhoneToE164> | null>(
    null
  );
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otpSentAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    const tick = () => {
      setCooldown((prev) => {
        if (prev <= 1) return 0;
        cooldownRef.current = setTimeout(tick, 1000);
        return prev - 1;
      });
    };
    cooldownRef.current = setTimeout(tick, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    const result = normalizePhoneToE164(phoneInput);
    if (!result.valid) {
      setError(result.error || 'Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: result.e164,
    });

    if (otpError) {
      console.error('SUPABASE OTP ERROR:', otpError);
      setError('Unable to send the verification code. Please try again.');
      setLoading(false);
      return;
    }

    setNormalized(result);
    setOtp('');
    setStep('otp');
    otpSentAtRef.current = Date.now();
    setInfo(`We sent a 6-digit code to ${result.display}.`);
    startCooldown();
    setLoading(false);
  };

  const handleResend = async () => {
    if (cooldown > 0 || !normalized) return;
    setError('');
    setInfo('');
    setLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: normalized.e164,
    });
    if (otpError) {
      console.error('SUPABASE OTP RESEND ERROR:', otpError);
      setError('Unable to resend the code. Please try again shortly.');
      setLoading(false);
      return;
    }
    setOtp('');
    otpSentAtRef.current = Date.now();
    setInfo(`A new code was sent to ${normalized.display}.`);
    startCooldown();
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!normalized) {
      setError('Please re-enter your phone number and request a code.');
      return;
    }

    const token = otp.trim();
    if (!/^\d{6}$/.test(token)) {
      setError('Please enter the 6-digit code from your SMS.');
      return;
    }

    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalized.e164,
      token,
      type: 'sms',
    });

    if (verifyError) {
      console.error('SUPABASE OTP VERIFY ERROR:', verifyError);
      setError('Incorrect or expired code. Please check the code and try again.');
      setVerifying(false);
      return;
    }

    setVerifying(false);
    onAuthenticated();
    onClose();
  };

  const handleChangePhone = () => {
    setStep('phone');
    setOtp('');
    setError('');
    setInfo('');
    setNormalized(null);
  };

  const handleGoogle = async () => {
    setError('');
    setInfo('');
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
      // On success the browser navigates to Google; do not reset loading here.
    } catch (err) {
      console.error('GOOGLE OAUTH EXCEPTION:', err);
      setError('Unable to start Google sign-in. Please try again.');
      setGoogleLoading(false);
    }
  };

  const remainingOtpSeconds =
    otpSentAtRef.current != null
      ? Math.max(0, OTP_EXPIRY_SECONDS - Math.floor((Date.now() - otpSentAtRef.current) / 1000))
      : null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-800">{step === 'otp' ? 'Enter your code' : 'Sign in'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign-in"
            className="p-2 rounded-full hover:bg-muted"
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {step === 'phone' ? (
          <>
            <p className="text-sm text-muted-foreground mb-5">
              Sign in with your phone number or Google. No password needed.
            </p>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3 font-700 text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              <GoogleG />
              {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3 my-5">
              <span className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground font-600">or use a phone number</span>
              <span className="h-px bg-border flex-1" />
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="phone-input" className="block text-xs text-muted-foreground mb-1">
                  Phone number
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+977 98XXXXXXXX"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  We&apos;ll text you a secure login code. Standard SMS rates may apply.
                </p>
              </div>

              {error && <p className="text-sm text-red-500 font-600">{error}</p>}
              {info && <p className="text-sm text-green-600 font-600">{info}</p>}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50"
              >
                {loading ? 'Sending code...' : 'Send code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">
              Enter the 6-digit code sent to{' '}
              <span className="font-700 text-foreground">{normalized?.display}</span>.
            </p>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="otp-input" className="block text-xs text-muted-foreground mb-1">
                  Verification code
                </label>
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl font-800 tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex items-center justify-between mt-2">
                  {otpSentAtRef.current != null && remainingOtpSeconds != null ? (
                    <p className="text-xs text-muted-foreground">
                      Code expires in {remainingOtpSeconds}s
                    </p>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={handleChangePhone}
                    className="text-xs font-700 text-primary hover:underline"
                  >
                    Change phone number
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-500 font-600">{error}</p>}
              {info && <p className="text-sm text-green-600 font-600">{info}</p>}

              <button
                type="submit"
                disabled={verifying}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className="w-full py-2 text-sm font-700 text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : loading
                    ? 'Sending...'
                    : 'Resend code'}
              </button>
            </form>
          </>
        )}
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
