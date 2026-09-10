'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { supabase } from '@/lib/supabase';
import { useStoreSettings } from '@/lib/useStoreSettings';

/**
 * Compact "Delivery details" block shown right below the product's main
 * information on Product Details.
 *
 * - Uses the SAME canonical delivery-location data as Checkout (the customer's
 *   saved `addresses` rows). There is deliberately NO second location system:
 *   tapping the row opens the existing address/location flow on the account
 *   page (GPS map picker included).
 * - The visible feature lines come from a single source of truth:
 *     1. Admin's store-wide Delivery Information items (store_settings
 *        .delivery_information, managed in Admin → Settings → Delivery
 *        Information) when any active item exists — each item renders as its
 *        OWN row so lines never merge into a paragraph;
 *     2. otherwise the Admin-defined per-product products.details.delivery
 *        (still one row per line);
 *     3. otherwise a truthful neutral message. No fabricated delivery dates,
 *        no invented seller/shipper data.
 * - When Admin enables store service hours and both times are set, an "Open
 *   Daily …" store row is appended to the Delivery Information list.
 */

interface DeliveryDetailsSectionProps {
  /** Admin-defined delivery information text (products.details.delivery). */
  deliveryText: string | null;
}

interface AddressRow {
  label?: string | null;
  recipient_name?: string | null;
  address_line?: string | null;
  city?: string | null;
}

interface DeliveryRowData {
  text: string;
  icon?: string | null;
}

function formatLocationSummary(address: AddressRow): string {
  const city = address.city?.trim();
  if (city) return city;

  const label = address.label?.trim();
  if (label) return label;

  const line = address.address_line?.trim();
  if (line) return line.slice(0, 80);

  return '';
}

export default function DeliveryDetailsSection({ deliveryText }: DeliveryDetailsSectionProps) {
  const router = useRouter();
  const { settings, loading: settingsLoading } = useStoreSettings();

  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationKnown, setLocationKnown] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLocation() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;

      if (!userData.user) {
        setLocationKnown(false);
        return;
      }

      const { data, error } = await supabase
        .from('addresses')
        .select('label, recipient_name, address_line, city, is_default')
        .eq('user_id', userData.user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (active) {
        if (!error && data && data.length > 0) {
          const row = data[0] as unknown as AddressRow;
          const summary = formatLocationSummary(row);
          setLocationLabel(summary || 'Location set');
          setLocationKnown(true);
        } else {
          setLocationKnown(false);
        }
      }
    }

    void loadLocation();

    return () => {
      active = false;
    };
  }, []);

  const openLocationFlow = () => {
    router.push('/account');
  };

  if (locationKnown === null || settingsLoading) {
    return null;
  }

  const neutralDelivery = 'Delivery availability is based on your location.';

  // 1) Store-wide Admin Delivery Information items are authoritative when any
  //    active item is configured.
  const globalItems = settings?.delivery_information ?? [];

  // 2) Otherwise keep the per-product Admin text, one row per line.
  const productLines = (deliveryText?.trim() ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  // Optional store-wide service-hours row from Admin → Settings → Service
  // Hours. It is only rendered as part of the store-wide list (or standalone
  // when neither the store list nor the product has its own delivery lines).
  const hoursRow: DeliveryRowData | null =
    settings?.service_hours_enabled === true &&
    settings.service_open_time &&
    settings.service_close_time
      ? {
          text: `${settings.service_hours_label?.trim() || 'Open Daily'}: ${settings.service_open_time.trim()} – ${settings.service_close_time.trim()}`,
          icon: '🕙',
        }
      : null;

  let rows: DeliveryRowData[] = [];
  if (globalItems.length > 0) {
    rows = globalItems.map((item) => ({ text: item.text, icon: item.icon ?? null }));
    if (hoursRow) rows = [...rows, hoursRow];
  } else if (productLines.length > 0) {
    rows = productLines.map((text) => ({ text }));
  } else if (hoursRow) {
    rows = [hoursRow];
  }

  // Leading-emoji detector (common for admin-authored delivery rows). Stays a
  // simple unicode-range set so the fixed icon column keeps every row aligned.
  // Variation selector (FE0F) and ZWJ (200D) are handled as their own branches
  // (not inside the character class) to satisfy eslint no-misleading-character-class.
  const leadingEmoji =
    /^((?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]|\u{FE0F}|\u{200D})+)\s*/u;

  function DeliveryRow({ item }: { item?: DeliveryRowData }) {
    const content = item?.text ?? '';
    const explicitIcon = item?.icon ?? null;

    const match = content.match(leadingEmoji);
    const hasLeadingEmoji =
      !!match && match[1].trim().length > 0 && content.slice(match[1].length).trim().length > 0;
    const emoji = hasLeadingEmoji ? match![1].trim() : null;
    const icon = explicitIcon || emoji;
    const text = hasLeadingEmoji ? content.slice(match![1].length).trim() : content;

    return (
      <li className="flex items-start gap-2">
        <span className="flex w-4 shrink-0 items-center justify-center">
          {icon ? (
            <span className="text-[12px] leading-[1.3]" aria-hidden="true">
              {icon}
            </span>
          ) : (
            <Icon name="TruckIcon" size={14} className="text-slate-400" />
          )}
        </span>

        <span className="min-w-0 flex-1 text-[11px] leading-4 text-slate-500 break-words">
          {text || content}
        </span>
      </li>
    );
  }

  return (
    <section
      className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-label="Delivery details"
    >
      <button
        type="button"
        onClick={openLocationFlow}
        className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 sm:px-4"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="MapPinIcon" size={16} className="shrink-0 text-primary" />

          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Location
            </span>

            <span
              className={`truncate text-xs font-extrabold ${
                locationKnown ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              {locationKnown ? locationLabel : 'Location not set'}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-primary">
          {locationKnown ? 'Change' : 'Select delivery location'}

          <Icon name="ArrowRightIcon" size={12} />
        </span>
      </button>

      <div className="flex items-start gap-2 border-t border-slate-100 px-3 py-2.5 sm:px-4">
        <Icon name="TruckIcon" size={16} className="mt-0.5 shrink-0 text-slate-400" />

        <div className="min-w-0 flex-1">
          <h2 className="text-[11px] font-bold text-slate-900">Delivery information</h2>

          {rows.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {rows.map((row, idx) => (
                <DeliveryRow key={`${row.text}-${idx}`} item={row} />
              ))}
            </ul>
          ) : (
            <ul className="mt-1.5">
              <DeliveryRow item={{ text: neutralDelivery }} />
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
