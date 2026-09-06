'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function SendProductBanner() {
  return (
    <section className="px-3 sm:px-4 pt-2 pb-2">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/account/send-product"
          className="group relative flex items-center gap-2.5 overflow-hidden rounded-[18px] border border-slate-200/70 bg-white px-3 py-2.5 shadow-[0_1px_8px_rgba(15,23,42,0.05)] transition-all duration-300 hover:shadow-md sm:px-4 sm:gap-3 sm:py-3"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/10 opacity-80" />

          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9">
            <Icon name="PackageIcon" size={18} />
          </div>

          <div className="relative min-w-0 flex-1">
            <span className="block truncate text-[12px] font-bold text-foreground sm:text-[13px]">
              Request a Product
            </span>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
              Can&apos;t find what you&apos;re looking for? Send us a photo or details and
              we&apos;ll help you find it.
            </p>
          </div>

          <div className="relative flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-background/60 px-2.5 text-[10px] font-semibold text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:h-8 sm:px-3 sm:text-[11px]">
            Request
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
