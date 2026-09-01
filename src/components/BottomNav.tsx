'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

const navItems = [
  { label: 'Home', href: '/', icon: 'HomeIcon' },
  { label: 'Products', href: '/products', icon: 'Squares2X2Icon' },
  { label: 'Wishlist', href: '/wishlist', icon: 'HeartIcon' },
  { label: 'Cart', href: '/cart', icon: 'ShoppingCartIcon' },
  { label: 'Account', href: '/account', icon: 'UserCircleIcon' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const getBadge = (label: string) => {
    if (label === 'Cart') return totalItems > 0 ? totalItems : null;
    if (label === 'Wishlist') return wishlist.length > 0 ? wishlist.length : null;
    return null;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border shadow-[0_-2px_12px_-4px_rgba(30,58,95,0.12)] lg:hidden">
      <div
        className="flex items-stretch justify-around"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          const badge = getBadge(item.label);

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-[60px] transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground active:text-foreground'
              }`}
            >
              <span
                className={`relative flex items-center justify-center w-11 h-7 rounded-full transition-colors ${
                  active ? 'bg-primary/10' : ''
                }`}
              >
                <Icon
                  name={item.icon}
                  variant={active ? 'solid' : 'outline'}
                  size={22}
                  className={active ? 'text-primary' : 'text-muted-foreground'}
                />

                {badge && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-[16px] h-[16px] text-[9px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none ${
                      item.label === 'Cart'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>

              <span
                className={`text-[10px] font-600 leading-none ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
