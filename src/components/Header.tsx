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
  const { loggedIn: authed, loading: authLoading, profile } = useAuth();
  const pathname = usePathname();

  const [avatarError, setAvatarError] = useState(false);
  useEffect(() => {
    setAvatarError(false);
  }, [profile.avatarUrl]);

  const customerName = profile.name.trim();
  const customerInitial = customerName ? customerName.charAt(0).toUpperCase() : '?';

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

  const isAllActive =
    pathname === '/products' &&
    (typeof window === 'undefined' || !new URLSearchParams(window.location.search).get('category'));

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-border/40">
      {/* ── ROW 1: brand + search + actions ── */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 h-11 sm:h-12 flex items-center gap-2">
        {/* Identity: store brand (logged out / loading) or customer greeting (logged in) */}
        {!authLoading && authed ? (
          <Link
            href="/account"
            className="flex items-center gap-2 flex-shrink-0 min-w-0 max-w-[45%] sm:max-w-[260px]"
            aria-label="Your account"
          >
            {profile.avatarUrl && !avatarError ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={profile.avatarUrl}
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 rounded-full object-cover border border-border/70 flex-shrink-0"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-primary/15 bg-primary/10 font-800 leading-none text-primary text-[13px]">
                {customerInitial}
              </span>
            )}
            <span className="min-w-0 leading-none">
              <span className="block text-[10px] sm:text-[11px] font-600 text-muted-foreground whitespace-nowrap">
                Hello <span aria-hidden="true">👋</span>
              </span>
              <span
                className="block text-[13px] sm:text-sm font-800 text-foreground truncate max-w-[110px] sm:max-w-[160px]"
                title={customerName}
              >
                {customerName}
              </span>
            </span>
          </Link>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1.5 flex-shrink-0 min-w-0"
            aria-label={`${storeName} home`}
          >
            <AppLogo src={storeLogo ?? ''} size={22} iconName="ShoppingBagIcon" />
            <span className="font-display text-sm sm:text-base font-800 text-primary tracking-tight leading-none truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">
              {storeName}
            </span>
          </Link>
        )}

        {/* Search (desktop) */}
        <div className="hidden md:flex relative flex-1 min-w-0 max-w-2xl ml-4 items-center gap-2">
          <form onSubmit={handleSearch} className="relative flex-1 min-w-0" role="search">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Icon name="MagnifyingGlassIcon" size={15} />
            </span>
            <input
              type="text"
              className="w-full h-10 pl-9 pr-4 rounded-full bg-black/[0.04] border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all focus:bg-white focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/15"
              placeholder="Search for Products, Brands and More"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              aria-label="Search products"
            />
          </form>
          <Link
            href="/products"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm transition-transform active:scale-95"
            aria-label="Search filters"
          >
            <Icon name="AdjustmentsVerticalIcon" size={18} />
          </Link>
        </div>

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

        {/* Mobile actions: bell (notifications) + wishlist + cart + account */}
        <div className="flex md:hidden flex-1 items-center justify-end gap-0">
          {!authLoading && authed && (
            <Link
              href="/account/notifications"
              className="relative icon-btn !w-8 !h-8"
              aria-label={
                unreadCount > 0 ? `Notifications with ${unreadCount} unread` : 'Notifications'
              }
            >
              <Icon name="BellIcon" size={19} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}
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

      {/* ── ROW 2: mobile search + filter ── */}
      <div className="md:hidden px-2 sm:px-3 pb-2">
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative flex-1" role="search">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Icon name="MagnifyingGlassIcon" size={16} />
            </span>
            <input
              type="text"
              className="w-full h-10 pl-9 pr-3 rounded-full bg-black/[0.04] border border-border/60 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-all focus:bg-white focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/15"
              placeholder="Search for Products, Brands and More"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              aria-label="Search products"
            />
          </form>
          <Link
            href="/products"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm transition-transform active:scale-95"
            aria-label="Search filters"
          >
            <Icon name="AdjustmentsVerticalIcon" size={18} />
          </Link>
        </div>
      </div>

      {/* ── ROW 3: compact commerce-style category strip ── */}
      {navCategories.length > 0 && (
        <div className="border-t border-border/40 bg-white">
          <div className="max-w-7xl mx-auto">
            <div
              ref={catStripRef}
              className="flex items-stretch gap-1 overflow-x-auto scrollbar-hide px-2 sm:px-4 py-1.5"
              role="navigation"
              aria-label="Shop by category"
            >
              <Link
                href="/products"
                aria-current={isAllActive ? 'page' : undefined}
                className={`flex w-16 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-b-2 px-1 py-1 ${
                  isAllActive ? 'border-primary' : 'border-transparent hover:border-primary/40'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    isAllActive ? 'bg-primary/10 text-primary' : 'bg-card text-muted-foreground'
                  }`}
                >
                  <Icon name="Squares2X2Icon" size={16} />
                </span>
                <span
                  className={`max-w-full truncate text-center text-[9px] font-bold leading-tight ${
                    isAllActive ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  All
                </span>
              </Link>

              {navCategories.map((cat) => {
                const active = isActiveCategory(cat.name);
                return (
                  <Link
                    key={cat.id || cat.name}
                    href={`/products?category=${encodeURIComponent(cat.name)}`}
                    className={`flex w-16 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-b-2 px-1 py-1 ${
                      active ? 'border-primary' : 'border-transparent hover:border-primary/40'
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-card text-primary">
                      {cat.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={cat.image}
                          alt=""
                          width={32}
                          height={32}
                          className="object-cover h-8 w-8"
                        />
                      ) : (
                        <Icon name="FolderIcon" size={15} />
                      )}
                    </span>
                    <span
                      className={`max-w-full truncate text-center text-[9px] font-semibold leading-tight ${
                        active ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {cat.name}
                    </span>
                  </Link>
                );
              })}

              <Link
                href="/products"
                className="flex w-14 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-b-2 border-transparent px-1 py-1 hover:border-primary/40"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground">
                  <Icon name="EllipsisHorizontalIcon" size={16} />
                </span>
                <span className="max-w-full truncate text-center text-[9px] font-semibold leading-tight text-foreground">
                  More
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
