'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import type { HighlightItem } from '@/lib/productDetails';

/**
 * Compact "Product highlights" rows (icon tile + real Admin highlight text).
 *
 * - Every row uses REAL products.details.highlights data. Nothing is invented.
 * - Each highlight is a small rounded icon tile next to its text. When no icon
 *   was chosen a consistent generic feature icon is used — a highlight never
 *   breaks because of a missing/unknown icon.
 * - The section renders nothing at all when no highlights are configured.
 * - Text is always present alongside the icon, so meaning never relies on
 *   icons alone (accessibility-safe).
 */
export default function ProductHighlightsSection({ highlights }: { highlights: HighlightItem[] }) {
  if (highlights.length === 0) {
    return null;
  }

  const headingId = 'product-highlights-heading';

  return (
    <section
      className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="text-sm font-extrabold text-slate-950">
        Product highlights
      </h2>

      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {highlights.map((highlight, index) => (
          <li
            key={`${highlight.text}-${index}`}
            className="flex min-w-0 items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
              aria-hidden="true"
            >
              <Icon name={highlight.icon ?? 'SparklesIcon'} size={14} />
            </span>

            <span className="min-w-0 break-words text-xs font-semibold leading-4 text-slate-700">
              {highlight.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
