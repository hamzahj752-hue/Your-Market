'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { ProductDetails } from '@/lib/productDetails';

/**
 * "All details" accordion for Product Details.
 *
 * The page used to show Description as the only rich block. This compact,
 * collapsed-by-default section organizes EVERY real piece of admin product
 * information into a structured list instead — description, brand/model, the
 * full grouped specification sheets, package contents, warranty and returns.
 *
 * - Default state: collapsed (a short "All details / Features, description and
 *   more" row). Tapping expands a premium complete details area.
 * - Only meaningful saved values are rendered. Empty fields are never shown as
 *   "Brand: —".
 * - Reduced motion is respected: the short expand/shrink transition is skipped.
 * - No heavy animation and no duplicate rendering of already-visible sections.
 */

interface AllDetailsSectionProps {
  description?: string | null;
  brand?: string;
  sku?: string;
  details: ProductDetails;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

export default function AllDetailsSection({
  description,
  brand,
  sku,
  details,
}: AllDetailsSectionProps) {
  const [open, setOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const hasDescription = Boolean(description?.trim());
  const hasGeneral = Boolean(brand?.trim()) || Boolean(sku?.trim());

  if (
    !hasDescription &&
    !hasGeneral &&
    details.specifications.length === 0 &&
    details.packageContents.length === 0 &&
    !details.warranty &&
    !details.returns
  ) {
    return null;
  }

  const panelId = 'all-details-panel';

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 sm:px-4"
      >
        <span className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-950">All details</h2>

          <p className="text-[11px] text-slate-500">Features, description and more</p>
        </span>

        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          <Icon name="ChevronDownIcon" size={14} />
        </span>
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] ${
          reducedMotion ? '' : 'duration-200 ease-out'
        } ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="divide-y divide-slate-100 border-t border-slate-100 px-3 sm:px-4">
            {/* Description */}
            {hasDescription && (
              <div className="py-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Description
                </h3>

                <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-600">
                  {description?.trim()}
                </p>
              </div>
            )}

            {/* General (brand / model) */}
            {hasGeneral && (
              <div className="py-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  General
                </h3>

                <dl className="mt-1 divide-y divide-slate-100">
                  {brand?.trim() && (
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 py-2 text-[11px] sm:text-xs">
                      <dt className="break-words text-slate-500">Brand</dt>

                      <dd className="break-words font-semibold text-slate-800">{brand.trim()}</dd>
                    </div>
                  )}

                  {sku?.trim() && (
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 py-2 text-[11px] sm:text-xs">
                      <dt className="break-words text-slate-500">Model / SKU</dt>

                      <dd className="break-words font-semibold text-slate-800">{sku.trim()}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Specifications */}
            {details.specifications.length > 0 && (
              <div className="py-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Specifications
                </h3>

                <div className="mt-1 space-y-3">
                  {details.specifications.map((group, groupIndex) => (
                    <div key={groupIndex}>
                      {group.group && (
                        <h4 className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          {group.group}
                        </h4>
                      )}

                      <dl className="divide-y divide-slate-100 border-y border-slate-100">
                        {group.items.map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 py-2 text-[11px] sm:text-xs"
                          >
                            <dt className="break-words text-slate-500">{item.key}</dt>

                            <dd className="break-words font-semibold text-slate-800">
                              {item.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Package contents */}
            {details.packageContents.length > 0 && (
              <div className="py-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  What&apos;s in the Box
                </h3>

                <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {details.packageContents.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />

                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warranty */}
            {details.warranty && (
              <div className="py-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Warranty
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-600">{details.warranty}</p>
              </div>
            )}

            {/* Returns */}
            {details.returns && (
              <div className="py-3">
                <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Returns
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-600">{details.returns}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
