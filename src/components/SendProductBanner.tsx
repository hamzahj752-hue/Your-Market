'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function SendProductBanner() {
  return (
    <section className="px-2 sm:px-4 pt-2">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/account/send-product"
          className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-border/60 bg-card/70 px-3 py-2.5 shadow-sm transition-all duration-300 hover:shadow-md sm:px-4 sm:gap-3 sm:py-3"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/10 opacity-80" />

          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9">
            <Icon name="PackageIcon" size={18} />
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[12px] font-bold text-foreground sm:text-[13px]">
                Send Your Product
              </span>
              <span className="hidden rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary sm:inline-flex">
                Earn with YourMarket
              </span>
            </div>
            <p className="mt-0 truncate text-[10px] text-muted-foreground sm:text-[11px]">
              Have a product to sell? Submit your details for review.
            </p>
          </div>

          <div className="relative flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-background/60 px-2.5 text-[10px] font-semibold text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:h-8 sm:px-3 sm:text-[11px]">
            Send
            <Icon
              name="ArrowRightIcon"
              size={12}
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </div>
        </Link>
      </div>
    </section>
  );
}
