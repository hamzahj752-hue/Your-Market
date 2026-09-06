'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

/*
 * Customer-facing order tracker.
 *
 * Two levels, driven ONLY by real YourMarket order data:
 *
 *   LEVEL 1 — COMPACT SUMMARY (default)
 *     A short progress strip (node dots + connecting line) with the current
 *     milestone labelled and a clear chevron affordance. No five-label row, so
 *     it can never collapse into PendingConfirmedProcessingShippedDelivered on
 *     narrow screens.
 *
 *   LEVEL 2 — FULL TIMELINE (tap to expand)
 *     A vertical timeline with distinct completed / current / future states.
 *     Timestamps are shown ONLY where the order actually stores them:
 *     created_at (order placed), shipped_at, delivered_at, cancelled_at.
 *
 * Nothing here invents couriers, tracking numbers, hubs, cities, or scan
 * events — YourMarket does not store those, so they are never shown.
 */

const FULL_STEPS = [
  { key: 'Placed', label: 'Order placed', desc: 'We received your order.' },
  { key: 'Confirmed', label: 'Confirmed', desc: 'Your order is confirmed.' },
  { key: 'Processing', label: 'Processing', desc: 'We are preparing your order.' },
  { key: 'Shipped', label: 'Shipped', desc: 'Your order has been dispatched.' },
  { key: 'Delivered', label: 'Delivered', desc: 'Your order has been delivered.' },
];

interface TrackerOrder {
  status?: string;
  created_at: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
}

function formatDate(v?: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderTracker({ order }: { order: TrackerOrder }) {
  const [expanded, setExpanded] = useState(false);

  const status = order.status === 'Placed' ? 'Pending' : order.status || 'Pending';
  const isCancelled = status === 'Cancelled';
  const isRefunded = status === 'Refunded';
  const isTerminal = isCancelled || isRefunded;

  const currentStep = FULL_STEPS.findIndex(
    (s) => s.key === (status === 'Pending' ? 'Placed' : status)
  );
  const placedAt = formatDate(order.created_at);

  /* ---------- toggle - only presentation; never changes order status ---------- */
  const toggle = () => setExpanded((e) => !e);

  /* ---------- Level 1: compact summary ---------- */
  if (!expanded) {
    // Cancelled / refunded get a terminal compact state, not a green path running
    // toward Delivery.
    if (isTerminal) {
      return (
        <section className="bg-card rounded-2xl card-shadow p-4 sm:p-5">
          <h2 className="text-sm font-800 uppercase tracking-wide text-muted-foreground mb-3">
            Tracking
          </h2>
          <button
            type="button"
            onClick={toggle}
            className="w-full flex items-center gap-3 text-left"
            aria-expanded={false}
            aria-controls="tracking-timeline"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icon name="XCircleIcon" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-800 text-red-700">
                {isRefunded ? 'Order refunded' : 'Order cancelled'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(order.cancelled_at) ?? `Placed on ${placedAt ?? ''}`}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-primary font-700 text-xs">
              Details
              <Icon name="ChevronDownIcon" size={16} />
            </span>
          </button>
        </section>
      );
    }

    const reached = currentStep >= 0 ? currentStep : 0;

    return (
      <section className="bg-card rounded-2xl card-shadow p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-800 uppercase tracking-wide text-muted-foreground">
            Tracking
          </h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-800 text-primary">
            {status}
          </span>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={false}
          aria-controls="tracking-timeline"
          className="w-full text-left"
        >
          {/* node dots + connecting line — labels live in the expanded view only,
              so nothing can collide on 360px */}
          <div className="flex items-center">
            {FULL_STEPS.map((step, i) => {
              const isDone = i < reached;
              const isCurrent = i === reached;
              return (
                <div key={step.key} className="flex flex-1 items-center last:flex-none">
                  {i > 0 && (
                    <div
                      className={`h-0.5 flex-1 ${i <= reached ? 'bg-green-500' : 'bg-border'}`}
                    />
                  )}
                  <span className="shrink-0">
                    {isDone ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                        <Icon name="CheckIcon" size={11} />
                      </span>
                    ) : isCurrent ? (
                      <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white ring-4 ring-green-500/20">
                        <span className="h-2 w-2 rounded-full bg-white" />
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-border bg-white" />
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-800 text-foreground">{FULL_STEPS[reached]?.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {reached >= 3
                  ? (formatDate(reached === 4 ? order.delivered_at : order.shipped_at) ?? placedAt)
                  : placedAt}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-primary font-700 text-xs">
              View tracking
              <Icon name="ChevronDownIcon" size={16} />
            </span>
          </div>
        </button>
      </section>
    );
  }

  /* ---------- Level 2: full vertical timeline ---------- */

  const renderedSteps = isTerminal
    ? [
        { ...FULL_STEPS[0], completed: true, ts: placedAt },
        {
          key: 'Cancelled',
          label: isRefunded ? 'Refunded' : 'Cancelled',
          desc: isRefunded ? 'This order was refunded.' : 'This order was cancelled.',
          completed: true,
          terminal: true,
          ts: formatDate(order.cancelled_at),
        },
      ]
    : FULL_STEPS.map((step, i) => ({
        ...step,
        completed: i < currentStep,
        current: i === currentStep,
        ts:
          step.key === 'Placed'
            ? placedAt
            : step.key === 'Shipped'
              ? formatDate(order.shipped_at)
              : step.key === 'Delivered'
                ? formatDate(order.delivered_at)
                : null,
      }));

  return (
    <section className="bg-card rounded-2xl card-shadow p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-800 uppercase tracking-wide text-muted-foreground">
          Tracking Details
        </h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={true}
          aria-controls="tracking-timeline"
          className="inline-flex shrink-0 items-center gap-1 text-primary font-700 text-xs"
        >
          Collapse
          <Icon name="ChevronUpIcon" size={16} />
        </button>
      </div>

      <ol id="tracking-timeline" className="relative">
        {renderedSteps.map((step, i) => {
          const isLast = i === renderedSteps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
              {/* connecting line */}
              {!isLast && (
                <div
                  className={`absolute left-[11px] top-5 bottom-0 w-0.5 ${
                    step.completed || step.terminal ? 'bg-green-500' : 'bg-border'
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* node */}
              <div className="relative z-10 shrink-0">
                {step.terminal ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                    <Icon name="XMarkIcon" size={11} />
                  </span>
                ) : step.completed ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                    <Icon name="CheckIcon" size={11} />
                  </span>
                ) : step.current ? (
                  <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white ring-4 ring-green-500/20">
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-border bg-white" />
                )}
              </div>

              {/* content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`text-sm font-800 ${
                    step.terminal
                      ? 'text-red-600'
                      : step.completed || step.current
                        ? 'text-foreground'
                        : 'text-muted-foreground/60'
                  }`}
                >
                  {step.label}
                </p>
                {step.ts ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.ts}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground/60 italic">
                    {step.completed || step.current ? 'Status updated' : 'Pending'}
                  </p>
                )}
                {step.desc && (
                  <p className="mt-0.5 text-xs text-muted-foreground/80">{step.desc}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
