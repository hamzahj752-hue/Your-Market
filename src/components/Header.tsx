'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { supabase } from '@/lib/supabase';
import { fetchNotifications } from '@/lib/notifications';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Electronics', href: '/products?category=Electronics' },
  { label: 'Fashion', href: '/products?category=Fashion' },
  { label: 'Home & Kitchen', href: '/products?category=Home' },
];

export default function Header() {
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();
  const pathname = usePathname();

  const [scrolled, setScrolled] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [authed, setAuthed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('Your Market');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('store_settings')
          .select('logo_url, store_name')
          .limit(1)
          .maybeSingle();
        if (active) {
          if (data?.logo_url) setStoreLogo(data.logo_url);
          if (data?.store_name) setStoreName(data.store_name);
        }
      } catch {
        // Ignore: fall back to the icon-based logo when settings are unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setAuthed(!!data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthed(!!session?.user);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authed) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    fetchNotifications('customer', 200).then((list) => {
      if (active) setUnreadCount(list.filter((n) => !n.is_read).length);
    });
    return () => {
      active = false;
    };
  }, [authed, pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const query = searchValue.trim();

    if (!query) {
      window.location.href = '/products';
      return;
    }

    window.location.href = `/products?search=${encodeURIComponent(query)}`;
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-border'
          : 'bg-white/90 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-2 sm:gap-4 h-14 sm:h-16">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 flex-shrink-0"
          aria-label={`${storeName} home`}
        >
          <AppLogo src={storeLogo ?? ''} size={30} iconName="ShoppingBagIcon" />
          <span className="font-display text-lg sm:text-xl font-800 text-primary tracking-tight leading-none hidden sm:block">
            {storeName}
          </span>
        </Link>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          className="relative flex-1 min-w-0 max-w-2xl ml-auto sm:ml-0"
          role="search"
        >
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={16} />
          </span>

          <input
            type="text"
            className="w-full h-10 pl-9 pr-4 rounded-full bg-muted/70 border-2 border-transparent text-sm text-foreground placeholder:text-muted-foreground transition-all focus:bg-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search products, brands..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search products"
          />

          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 h-8 rounded-full text-muted-foreground hover:text-primary hover:bg-white transition-colors"
            aria-label="Search"
          >
            <Icon name="ArrowRightIcon" size={15} />
          </button>
        </form>

        {/* Top nav (desktop) */}
        <nav
          className="hidden lg:flex items-center gap-5 flex-shrink-0 ml-4"
          aria-label="Main navigation"
        >
          {navLinks.slice(0, 3).map((link) => (
            <Link key={link.label} href={link.href} className="nav-link-hover">
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <Link href="/account" className="hidden sm:flex icon-btn" aria-label="Account">
            <Icon name="UserCircleIcon" size={22} />
          </Link>

          {authed && (
            <Link
              href="/account/notifications"
              className="relative icon-btn"
              aria-label={
                unreadCount > 0 ? `Notifications with ${unreadCount} unread` : 'Notifications'
              }
            >
              <Icon name="BellIcon" size={21} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          <Link
            href="/wishlist"
            className="relative icon-btn"
            aria-label={`Wishlist with ${wishlist.length} items`}
          >
            <Icon name="HeartIcon" size={22} />
            {wishlist.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                {wishlist.length > 99 ? '99+' : wishlist.length}
              </span>
            )}
          </Link>

          <Link
            href="/cart"
            className="relative icon-btn"
            aria-label={`Cart with ${totalItems} items`}
          >
            <Icon name="ShoppingCartIcon" size={22} />
            {totalItems > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-accent text-accent-foreground text-[9px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
