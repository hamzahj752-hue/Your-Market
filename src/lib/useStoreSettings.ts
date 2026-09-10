'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Single customer-side source of truth for store-wide BUSINESS settings.
 *
 * All commercial rules (currency, flat delivery charge, free delivery
 * threshold, tax) are persisted in the canonical `store_settings` row and
 * edited only from Admin → Settings. The DEFAULT_SETTINGS below are purely a
 * migration / backward-compatibility fallback: they are used ONLY when the
 * settings row (or a specific column in it) is missing. A saved Admin value
 * ALWAYS wins because it is read from the row first.
 *
 * The service-hours + delivery-information fields live behind a prepare-only
 * migration; the reads below are guarded so the storefront keeps working
 * unchanged before that migration is applied.
 */

export const DEFAULT_SETTINGS = {
  currency: 'NPR',
  shippingCharge: 200,
  freeShippingThreshold: 6500,
  taxPercent: 13,
} as const;

export interface DeliveryInfoItem {
  text: string;
  icon?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface StoreSettings {
  currency: string;
  shipping_charge: number;
  free_shipping_threshold: number;
  tax_percent: number;
  service_hours_enabled: boolean | null;
  service_open_time: string | null;
  service_close_time: string | null;
  service_hours_label: string | null;
  delivery_information: DeliveryInfoItem[] | null;
}

// Coerce an arbitrary value from the jsonb column into a safe item list.
// Broken rows are dropped instead of crashing the renderer.
export function normalizeDeliveryInfo(raw: unknown): DeliveryInfoItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      text: typeof entry.text === 'string' ? entry.text.trim() : '',
      icon: typeof entry.icon === 'string' && entry.icon.trim() ? entry.icon.trim() : null,
      is_active: entry.is_active === true,
      sort_order: Number(entry.sort_order) || 0,
    }))
    .filter((item) => item.text.length > 0 && item.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Core columns always exist.
      const { data: core } = await supabase
        .from('store_settings')
        .select('currency, shipping_charge, free_shipping_threshold, tax_percent')
        .limit(1)
        .maybeSingle();

      // Optional columns (prepare-only migration). If the column does not
      // exist the whole select fails, so this is guarded and nullable.
      let extras: {
        service_hours_enabled?: unknown;
        service_open_time?: unknown;
        service_close_time?: unknown;
        service_hours_label?: unknown;
        delivery_information?: unknown;
      } | null = null;
      try {
        const extrasRes = await supabase
          .from('store_settings')
          .select(
            'service_hours_enabled, service_open_time, service_close_time, service_hours_label, delivery_information'
          )
          .limit(1)
          .maybeSingle();
        extras = extrasRes.data;
      } catch {
        extras = null;
      }

      if (cancelled) return;

      const merged: StoreSettings = {
        currency:
          typeof core?.currency === 'string' && core.currency.trim()
            ? core.currency.trim()
            : DEFAULT_SETTINGS.currency,
        // 0 is a LEGITIMATE Admin value (free delivery / free shipping always /
        // tax disabled) and must never be overridden by the fallback, so each
        // numeric uses an explicit null check, not `||`.
        shipping_charge:
          core?.shipping_charge != null
            ? Number(core.shipping_charge)
            : DEFAULT_SETTINGS.shippingCharge,
        free_shipping_threshold:
          core?.free_shipping_threshold != null
            ? Number(core.free_shipping_threshold)
            : DEFAULT_SETTINGS.freeShippingThreshold,
        tax_percent:
          core?.tax_percent != null ? Number(core.tax_percent) : DEFAULT_SETTINGS.taxPercent,
        service_hours_enabled: extras?.service_hours_enabled === true,
        service_open_time:
          typeof extras?.service_open_time === 'string' ? extras.service_open_time : null,
        service_close_time:
          typeof extras?.service_close_time === 'string' ? extras.service_close_time : null,
        service_hours_label:
          typeof extras?.service_hours_label === 'string' ? extras.service_hours_label : null,
        delivery_information: normalizeDeliveryInfo(extras?.delivery_information),
      };

      setSettings(merged);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}
