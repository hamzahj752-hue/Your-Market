'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-md px-3 pb-1">
        <div className="flex items-end justify-around bg-white rounded-2xl shadow-[0_-2px_20px_-4px_rgba(0,0,0,0.12)] border border-black/5 px-1 pt-1.5 pb-1.5">
          {/* Home */}
          <Link
            href="/"
            aria-label="Home"
            aria-current={isActive('/') ? 'page' : undefined}
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-colors ${
              isActive('/') ? 'text-primary' : 'text-gray-400 active:text-foreground'
            }`}
          >
            <Icon name="HomeIcon" variant={isActive('/') ? 'solid' : 'outline'} size={22} />
            <span className="text-[9px] font-600 leading-tight mt-0.5">Home</span>
          </Link>

          {/* Center raised action: Send Your Product */}
          <Link
            href="/account/send-product"
            aria-label="Send Your Product"
            className="flex flex-col items-center justify-center -mt-4"
          >
            <span
              className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all ${
                pathname.startsWith('/account/send-product')
                  ? 'bg-primary text-white shadow-primary/30'
                  : 'bg-primary text-white shadow-primary/25 hover:bg-primary/90 active:scale-95'
              }`}
            >
              <Icon name="PaperAirplaneIcon" variant="solid" size={22} className="text-white" />
            </span>
            <span className="text-[9px] font-600 text-primary leading-tight mt-0.5">Send</span>
          </Link>

          {/* Cart */}
          <Link
            href="/cart"
            aria-label="Cart"
            aria-current={isActive('/cart') ? 'page' : undefined}
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-colors ${
              isActive('/cart') ? 'text-primary' : 'text-gray-400 active:text-foreground'
            }`}
          >
            <span className="relative">
              <Icon
                name="ShoppingCartIcon"
                variant={isActive('/cart') ? 'solid' : 'outline'}
                size={22}
              />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] bg-accent text-white text-[8px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </span>
            <span className="text-[9px] font-600 leading-tight mt-0.5">Cart</span>
          </Link>

          {/* Account */}
          <Link
            href="/account"
            aria-label="Account"
            aria-current={isActive('/account') ? 'page' : undefined}
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-colors ${
              isActive('/account') ? 'text-primary' : 'text-gray-400 active:text-foreground'
            }`}
          >
            <Icon
              name="UserCircleIcon"
              variant={isActive('/account') ? 'solid' : 'outline'}
              size={22}
            />
            <span className="text-[9px] font-600 leading-tight mt-0.5">Account</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
