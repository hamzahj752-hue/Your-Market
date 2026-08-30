'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';

const navItems = [
  { label: 'Home', href: '/', icon: 'HomeIcon' },
  { label: 'Category', href: '/products', icon: 'Squares2X2Icon' },
  { label: 'Cart', href: '/cart', icon: 'ShoppingCartIcon' },
  { label: 'Account', href: '/account', icon: 'UserCircleIcon' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg lg:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems?.map((item) => {
          const isActive = item?.href === '/' ? pathname === '/' : pathname?.startsWith(item?.href);

          return (
            <Link
              key={item?.label}
              href={item?.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={item?.label}
            >
              <div className="relative">
                <Icon
                  name={item?.icon}
                  size={22}
                  className={isActive ? 'text-primary' : 'text-muted-foreground'}
                />
                {item?.label === 'Cart' && totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-accent text-accent-foreground text-[9px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-600 leading-none ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {item?.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
