'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: 'HomeIcon' },
  { href: '/account/send-product', label: 'Request', icon: 'PaperAirplaneIcon', isRaised: true },
  { href: '/cart', label: 'Cart', icon: 'ShoppingCartIcon' },
  { href: '/account', label: 'Account', icon: 'UserCircleIcon' },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const barRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeIdx = NAV_ITEMS.findIndex((item) => isActive(item.href));

  const measure = useCallback(() => {
    if (activeIdx < 0 || !barRef.current) {
      setIndicator(null);
      return;
    }
    // The raised Request button already communicates its own active state via
    // the always-primary circular badge, so no sliding bar is drawn over it.
    if (activeIdx === NAV_ITEMS.findIndex((item) => 'isRaised' in item && item.isRaised)) {
      setIndicator(null);
      return;
    }
    const item = itemRefs.current[activeIdx];
    if (!item) return;
    const bar = barRef.current.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    setIndicator({
      left: rect.left - bar.left + rect.width / 2 - 12,
      width: 24,
    });
  }, [activeIdx]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    requestAnimationFrame(measure);
  }, [pathname, measure]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-md px-3 pb-1">
        <div
          ref={barRef}
          className="relative flex items-end justify-around bg-white rounded-2xl shadow-[0_-2px_20px_-4px_rgba(0,0,0,0.12)] border border-black/5 px-1 pt-1.5 pb-1.5"
        >
          {/* Animated active indicator */}
          {indicator && (
            <div
              className="absolute top-0 h-[3px] rounded-full bg-primary transition-all duration-300 ease-in-out"
              style={{
                left: indicator.left,
                width: indicator.width,
              }}
            />
          )}

          {NAV_ITEMS.map((item, idx) => {
            const active = isActive(item.href);
            const isRaised = 'isRaised' in item && item.isRaised;

            if (isRaised) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  className="flex flex-col items-center justify-center -mt-4"
                >
                  <span
                    className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all ${
                      pathname.startsWith(item.href)
                        ? 'bg-primary text-white shadow-primary/30'
                        : 'bg-primary text-white shadow-primary/25 hover:bg-primary/90 active:scale-95'
                    }`}
                  >
                    <Icon name={item.icon} variant="solid" size={22} className="text-white" />
                  </span>
                  <span className="text-[9px] font-600 text-primary leading-tight mt-0.5">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-colors relative ${
                  active ? 'text-primary' : 'text-muted-foreground active:text-foreground'
                }`}
              >
                <span className="relative">
                  <Icon name={item.icon} variant={active ? 'solid' : 'outline'} size={22} />
                  {item.icon === 'ShoppingCartIcon' && totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] bg-accent text-white text-[8px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                      {totalItems > 99 ? '99+' : totalItems}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[9px] leading-tight mt-0.5 ${
                    active ? 'font-800 text-primary' : 'font-600 text-muted-foreground'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
