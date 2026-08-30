'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
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
  const router = useRouter();
  const pathname = usePathname();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [authed, setAuthed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const query = searchValue.trim();

    if (!query) {
      window.location.href = '/products';
      return;
    }

    window.location.href = `/products?search=${encodeURIComponent(query)}`;
    setMobileOpen(false);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-xl shadow-card py-3'
            : 'bg-white/80 backdrop-blur-md py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <AppLogo size={36} />
            <span className="font-display text-xl font-800 text-primary tracking-tight hidden sm:block">
              Your Market
            </span>
          </Link>

          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Icon name="MagnifyingGlassIcon" size={18} />
            </span>

            <input
              type="text"
              className="input-search pr-12"
              placeholder="Search products, brands, categories..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              aria-label="Search products"
            />

            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Search"
            >
              <Icon name="ArrowRightIcon" size={17} />
            </button>
          </form>

          <nav className="hidden lg:flex items-center gap-6 flex-shrink-0">
            {navLinks.slice(0, 3).map((link) => (
              <Link key={link.label} href={link.href} className="nav-link-hover">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            <button
              className="md:hidden p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Search"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>(
                  'input[aria-label="Search products mobile"]'
                );
                input?.focus();
              }}
            >
              <Icon name="MagnifyingGlassIcon" size={20} className="text-foreground" />
            </button>

            <Link
              href="/account"
              className="hidden sm:flex p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Account"
            >
              <Icon name="UserCircleIcon" size={22} className="text-foreground" />
            </Link>

            {authed && (
              <Link
                href="/account/notifications"
                className="relative p-2 rounded-full hover:bg-muted transition-colors"
                aria-label={
                  unreadCount > 0 ? `Notifications with ${unreadCount} unread` : 'Notifications'
                }
              >
                <Icon name="BellIcon" size={22} className="text-foreground" />

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-800 rounded-full flex items-center justify-center px-1 leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )}

            <Link
              href="/wishlist"
              className="relative p-2 rounded-full hover:bg-muted transition-colors"
              aria-label={`Wishlist with ${wishlist.length} items`}
            >
              <Icon name="HeartIcon" size={22} className="text-foreground" />

              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-800 rounded-full flex items-center justify-center px-1 leading-none">
                  {wishlist.length > 99 ? '99+' : wishlist.length}
                </span>
              )}
            </Link>

            <Link
              href="/cart"
              className="relative p-2 rounded-full hover:bg-muted transition-colors"
              aria-label={`Cart with ${totalItems} items`}
            >
              <Icon name="ShoppingCartIcon" size={22} className="text-foreground" />

              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-accent text-accent-foreground text-[10px] font-800 rounded-full flex items-center justify-center px-1 leading-none">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            <button
              className="lg:hidden p-2 rounded-full hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <Icon name="Bars3Icon" size={22} className="text-foreground" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="md:hidden px-4 pb-3 relative">
          <span className="absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={16} />
          </span>

          <input
            type="text"
            className="input-search text-sm pr-12"
            placeholder="Search products..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search products mobile"
          />

          <button
            type="submit"
            className="absolute right-6 top-1/2 -translate-y-1/2 p-2"
            aria-label="Search"
          >
            <Icon name="ArrowRightIcon" size={16} />
          </button>
        </form>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-card-lg flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <AppLogo size={32} />
                <span className="font-display text-lg font-700 text-primary">Your Market</span>
              </div>

              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Close menu"
              >
                <Icon name="XMarkIcon" size={22} className="text-foreground" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-foreground font-600"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <Link
                href="/wishlist"
                className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-colors text-foreground font-600"
                onClick={() => setMobileOpen(false)}
              >
                <span className="flex items-center gap-3">
                  <Icon name="HeartIcon" size={19} />
                  Wishlist
                </span>

                {wishlist.length > 0 && (
                  <span className="bg-red-500 text-white text-xs font-800 rounded-full px-2 py-0.5">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              <Link
                href="/account"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-foreground font-600"
                onClick={() => setMobileOpen(false)}
              >
                <Icon name="UserCircleIcon" size={19} />
                Account
              </Link>
            </nav>

            <div className="p-4 border-t border-border">
              <Link href="/cart" onClick={() => setMobileOpen(false)}>
                <button className="btn-primary w-full justify-center">
                  <Icon name="ShoppingCartIcon" size={18} />
                  View Cart
                  {totalItems > 0 && (
                    <span className="ml-1 bg-accent text-accent-foreground text-xs font-800 rounded-full px-2 py-0.5">
                      {totalItems}
                    </span>
                  )}
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
