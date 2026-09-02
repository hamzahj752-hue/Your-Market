'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function SendProductBanner() {
  return (
    <section className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/account/send-product"
          className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card/70 px-4 py-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:px-5"
        >
          {/* Glass highlight */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/10 opacity-80" />

          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon name="package" size={22} />
          </div>

          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-bold text-foreground sm:text-base">
                Send Your Product
              </h2>

              <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary sm:inline-flex">
                Earn with YourMarket
              </span>
            </div>

            <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
              Have a product to sell? Send us your product details.
            </p>
          </div>

          <div className="relative flex h-9 shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/60 px-3 text-xs font-semibold text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:px-4 sm:text-sm">
            Send
            <Icon
              name="arrow-right"
              size={15}
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </div>
        </Link>
      </div>
    </section>
  );
}
