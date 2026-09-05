'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchNotifications } from '@/lib/notifications';
import { fetchHomepageCategories, BriefCategory } from '@/lib/homepageCms';

export default function Header() {
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();
  const { loggedIn: authed, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const [searchValue, setSearchValue] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('Your Market');
  const [navCategories, setNavCategories] = useState<BriefCategory[]>([]);
  const catStripRef = useRef<HTMLDivElement>(null);

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
        /* ignore settings errors */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchHomepageCategories().then((cats) => {
      if (active && cats.length > 0) setNavCategories(cats);
    });
    return () => {
      active = false;
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchValue.trim();
    if (!query) {
      window.location.href = '/products';
      return;
    }
    window.location.href = `/products?search=${encodeURIComponent(query)}`;
  };

  const isActiveCategory = (catName: string) => {
    if (pathname !== '/products') return false;
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    return params?.get('category') === catName;
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-border/40">
      {/* ── ROW 1: brand + search + actions ── */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 h-11 sm:h-12 flex items-center gap-2">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-1.5 flex-shrink-0"
          aria-label={`${storeName} home`}
        >
          <AppLogo src={storeLogo ?? ''} size={22} iconName="ShoppingBagIcon" />
          <span className="font-display text-sm sm:text-base font-800 text-primary tracking-tight leading-none hidden sm:block">
            {storeName}
          </span>
        </Link>

        {/* Search (desktop) */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex relative flex-1 min-w-0 max-w-2xl ml-4"
          role="search"
        >
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={15} />
          </span>
          <input
            type="text"
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-muted/50 border border-border/80 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all focus:bg-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/15"
            placeholder="Search for Products, Brands and More"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search products"
          />
        </form>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-0.5 flex-shrink-0 ml-auto">
          <Link href="/account" className="icon-btn !w-9 !h-9" aria-label="Account">
            <Icon name="UserCircleIcon" size={20} />
          </Link>

          {!authLoading && authed && (
            <Link
              href="/account/notifications"
              className="relative icon-btn !w-9 !h-9"
              aria-label={
                unreadCount > 0 ? `Notifications with ${unreadCount} unread` : 'Notifications'
              }
            >
              <Icon name="BellIcon" size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          <Link
            href="/wishlist"
            className="relative icon-btn !w-9 !h-9"
            aria-label={`Wishlist with ${wishlist.length} items`}
          >
            <Icon name="HeartIcon" size={20} />
            {wishlist.length > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                {wishlist.length > 99 ? '99+' : wishlist.length}
              </span>
            )}
          </Link>

          <Link
            href="/cart"
            className="relative icon-btn !w-9 !h-9"
            aria-label={`Cart with ${totalItems} items`}
          >
            <Icon name="ShoppingCartIcon" size={20} />
            {totalItems > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-accent text-white text-[8px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>
        </div>

        {/* Mobile actions: account + wishlist + cart */}
        <div className="flex md:hidden flex-1 items-center justify-end gap-0">
          <Link href="/account" className="icon-btn !w-8 !h-8" aria-label="Account">
            <Icon name="UserCircleIcon" size={19} />
          </Link>
          <Link
            href="/wishlist"
            className="relative icon-btn !w-8 !h-8"
            aria-label={`Wishlist with ${wishlist.length} items`}
          >
            <Icon name="HeartIcon" size={18} />
            {wishlist.length > 0 && (
              <span className="absolute top-0 right-0 min-w-[13px] h-[13px] bg-red-500 text-white text-[7px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                {wishlist.length > 99 ? '99+' : wishlist.length}
              </span>
            )}
          </Link>
          <Link
            href="/cart"
            className="relative icon-btn !w-8 !h-8"
            aria-label={`Cart with ${totalItems} items`}
          >
            <Icon name="ShoppingCartIcon" size={18} />
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 min-w-[13px] h-[13px] bg-accent text-white text-[7px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* ── ROW 2: mobile search ── */}
      <div className="md:hidden px-2 sm:px-3 pb-2">
        <form onSubmit={handleSearch} className="relative" role="search">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={14} />
          </span>
          <input
            type="text"
            className="w-full h-[34px] pl-8 pr-3 rounded-lg border border-primary/40 bg-white text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/15"
            placeholder="Search for Products, Brands and More"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search products"
          />
        </form>
      </div>

      {/* ── ROW 3: category strip ── */}
      {navCategories.length > 0 && (
        <div className="border-t border-border/40 bg-white">
          <div className="max-w-7xl mx-auto relative">
            <div
              ref={catStripRef}
              className="flex items-stretch overflow-x-auto scrollbar-hide"
              role="navigation"
              aria-label="Shop by category"
            >
              <Link
                href="/products"
                className="flex flex-col items-center justify-center flex-shrink-0 px-3 py-1.5 min-w-[56px] text-[10px] font-600 text-foreground hover:text-primary transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-0.5">
                  <Icon name="Squares2X2Icon" size={12} />
                </span>
                <span className="leading-tight">All</span>
              </Link>

              {navCategories.map((cat) => {
                const active = isActiveCategory(cat.name);
                return (
                  <Link
                    key={cat.id || cat.name}
                    href={`/products?category=${encodeURIComponent(cat.name)}`}
                    className={`relative flex flex-col items-center justify-center flex-shrink-0 px-2.5 py-1.5 min-w-[56px] text-[10px] font-600 transition-colors ${
                      active ? 'text-primary' : 'text-foreground hover:text-primary'
                    }`}
                  >
                    {cat.image ? (
                      <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-border/60 mb-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cat.image}
                          alt=""
                          width={24}
                          height={24}
                          className="object-cover w-6 h-6"
                        />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mb-0.5">
                        <Icon name="FolderIcon" size={11} />
                      </span>
                    )}
                    <span className="leading-tight line-clamp-1 max-w-[52px]">{cat.name}</span>
                    {active && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}

              <Link
                href="/products"
                className="flex flex-col items-center justify-center flex-shrink-0 px-2.5 py-1.5 min-w-[56px] text-[10px] font-600 text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-0.5">
                  <Icon name="EllipsisHorizontalIcon" size={12} />
                </span>
                <span className="leading-tight">More</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
