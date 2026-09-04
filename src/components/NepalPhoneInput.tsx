'use client';

import React from 'react';
import { NEPAL_COUNTRY_CODE, NEPAL_MOBILE_LENGTH } from '@/lib/nepalPhone';

interface NepalPhoneInputProps {
  value: string;
  onChange: (localDigits: string) => void;
  placeholder?: string;
  id?: string;
  error?: string;
  disabled?: boolean;
}

// Fixed +977 prefix + numeric input for the 10-digit Nepal local mobile.
// The customer types only the local number; the country prefix is display-only.
export default function NepalPhoneInput({
  value,
  onChange,
  placeholder = '98XXXXXXXX',
  id,
  error,
  disabled,
}: NepalPhoneInputProps) {
  return (
    <div>
      <div className="flex w-full rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary overflow-hidden transition-colors">
        <span className="flex items-center px-3 sm:px-4 shrink-0 border-r border-border bg-muted/40 text-sm font-700 text-muted-foreground select-none">
          {NEPAL_COUNTRY_CODE}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={placeholder}
          value={value}
          maxLength={NEPAL_MOBILE_LENGTH + 4}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            if (next.length > NEPAL_MOBILE_LENGTH) return;
            const cleaned = next.replace(/[^\d]/g, '');
            if (cleaned.length > NEPAL_MOBILE_LENGTH) return;
            onChange(cleaned);
          }}
          className="w-full min-w-0 px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground bg-transparent outline-none disabled:opacity-60"
        />
      </div>
      {error && <p className="text-xs text-red-500 font-600 mt-1">{error}</p>}
    </div>
  );
}
