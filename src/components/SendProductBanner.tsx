'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function SendProductBanner() {
  return (
    <section className="px-3 sm:px-6 pt-3 pb-1 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/account/send-product"
          className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-3 py-3 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:px-5 sm:gap-4 sm:py-4"
        >
          {/* Glass highlight */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/10 opacity-80" />

          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
            <Icon name="PackageIcon" size={20} />
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[13px] font-bold text-foreground sm:text-base">
                Send Your Product
              </h2>

              <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary sm:inline-flex">
                Earn with YourMarket
              </span>
            </div>

            <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-sm">
              Have a product to sell? Send us your product details.
            </p>
          </div>

          <div className="relative flex h-8 shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/60 px-3 text-[11px] font-semibold text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:h-9 sm:px-4 sm:text-sm">
            Send
            <Icon
              name="ArrowRightIcon"
              size={14}
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </div>
        </Link>
      </div>
    </section>
  );
}
