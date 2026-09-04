'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { useHomeLocation } from '@/context/HomeLocationContext';
import { supabase } from '@/lib/supabase';
import { fetchNotifications } from '@/lib/notifications';
import { fetchHomepageCategories, BriefCategory } from '@/lib/homepageCms';

export default function Header() {
  const { totalItems } = useCart();
  const { wishlist } = useWishlist();
  const { loggedIn: authed, loading: authLoading } = useAuth();
  const { locationLabel, setLocationLabel, clearLocation } = useHomeLocation();
  const pathname = usePathname();

  const [scrolled, setScrolled] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('Your Market');
  const [navCategories, setNavCategories] = useState<BriefCategory[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');
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
        // Ignore: fall back to the icon-based logo when settings are unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Real active categories drive the desktop navigation (never fabricated links).
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

  const closeLocation = () => {
    setLocationOpen(false);
    setLocationDraft('');
  };

  const applyLocation = (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = locationDraft.trim();
    if (value) {
      setLocationLabel(value);
    } else {
      clearLocation();
    }
    closeLocation();
  };

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
      className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-border'
          : 'bg-white/95 backdrop-blur-md border-b border-border/60'
      }`}
    >
      {/* ── ROW 1: brand + actions (mobile: controls, desktop: full row) ── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-2 sm:gap-4 h-12 sm:h-14 md:h-16">
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

        {/* Search (desktop: large, takes major horizontal space) */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex relative flex-1 min-w-0 max-w-3xl"
          role="search"
        >
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={18} />
          </span>
          <input
            type="text"
            className="w-full h-11 pl-11 pr-24 rounded-lg bg-muted/70 border-2 border-transparent text-sm text-foreground placeholder:text-muted-foreground transition-all focus:bg-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={`Search products on ${storeName}...`}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search products"
          />
          <button
            type="submit"
            className="absolute right-1 top-1 shadow-sm rounded-lg bg-primary text-primary-foreground font-700 text-sm h-9 max-w-20 w-20 flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
            aria-label="Search"
          >
            Search
          </button>
        </form>

        {/* Actions (desktop): account + notifications + wishlist + cart */}
        <div className="hidden md:flex items-center gap-0.5 sm:gap-1 flex-shrink-0 ml-auto">
          <button
            onClick={() => setLocationOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2 sm:px-3 h-10 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors text-xs sm:text-sm"
            aria-haspopup="dialog"
            aria-expanded={locationOpen}
            aria-label={locationLabel ? `Deliver to ${locationLabel}` : 'Set delivery location'}
          >
            <Icon name="MapPinIcon" size={18} />
            <span className="hidden lg:block font-600 max-w-[120px] truncate">
              {locationLabel || 'Deliver to'}
            </span>
            <Icon name="ChevronDownIcon" size={14} className="hidden lg:block" />
          </button>

          <Link
            href="/account"
            className="icon-btn flex flex-col items-center gap-0.5 px-1.5 py-1"
            aria-label="Account"
          >
            <Icon name="UserCircleIcon" size={22} />
            <span className="hidden xl:block text-[10px] font-600 text-muted-foreground">
              {authed ? 'Account' : 'Login'}
            </span>
          </Link>

          {!authLoading && authed && (
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
            className="relative icon-btn hidden sm:inline-flex"
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

        {/* Mobile top row: account + wishlist + cart */}
        <div className="flex md:hidden flex-1 items-center justify-end gap-0 ml-2">
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
          <Link href="/account" className="icon-btn !w-9 !h-9" aria-label="Account">
            <Icon name="UserCircleIcon" size={20} />
          </Link>
          <Link
            href="/cart"
            className="relative icon-btn !w-9 !h-9"
            aria-label={`Cart with ${totalItems} items`}
          >
            <Icon name="ShoppingCartIcon" size={20} />
            {totalItems > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-accent text-accent-foreground text-[8px] font-800 rounded-full flex items-center justify-center px-0.5 leading-none">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile prominent search row (between controls and category strip) */}
      <div className="md:hidden px-3 pt-1.5 pb-2">
        <form onSubmit={handleSearch} className="relative" role="search">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon name="MagnifyingGlassIcon" size={16} />
          </span>
          <input
            type="text"
            className="w-full h-10 pl-9 pr-4 rounded-xl border-2 border-border/70 bg-white text-[13px] text-foreground placeholder:text-muted-foreground transition-all focus:bg-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search for Products, Brands and More"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search products"
          />
        </form>
      </div>

      {/* ── ROW 2: category navigation strip (desktop + mobile) ── */}
      <div className="border-t border-border/60 bg-white/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 relative">
          <div
            ref={catStripRef}
            className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-hide"
            role="navigation"
            aria-label="Shop by category"
          >
            <Link
              href="/products"
              className="flex flex-col items-center gap-0.5 flex-shrink-0 w-[64px] py-1 rounded-lg hover:bg-muted/60 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="Squares2X2Icon" size={16} />
              </span>
              <span className="text-[10px] font-600 text-foreground text-center leading-tight">
                All
              </span>
            </Link>

            {navCategories.map((cat) => (
              <Link
                key={cat.id || cat.name}
                href={`/products?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-0.5 flex-shrink-0 w-[68px] py-1 rounded-lg hover:bg-muted/60 transition-colors group"
              >
                {cat.image ? (
                  <span className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-border/70">
                    <AppImage
                      src={cat.image}
                      alt=""
                      width={32}
                      height={32}
                      className="object-cover w-8 h-8 group-hover:scale-110 transition-transform"
                    />
                  </span>
                ) : (
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Icon name="FolderIcon" size={14} />
                  </span>
                )}
                <span className="text-[10px] font-600 text-foreground text-center leading-tight line-clamp-2">
                  {cat.name}
                </span>
              </Link>
            ))}

            <Link
              href="/products"
              className="flex flex-col items-center gap-0.5 flex-shrink-0 w-[64px] py-1 rounded-lg hover:bg-muted/60 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                <Icon name="EllipsisHorizontalIcon" size={16} />
              </span>
              <span className="text-[10px] font-600 text-muted-foreground text-center leading-tight">
                More
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Location dialog (shared by desktop + mobile) */}
      {locationOpen && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 relative">
          <div className="absolute right-2 sm:right-6 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-border shadow-card-lg p-4 z-50">
            <p className="text-xs font-700 text-foreground mb-0.5">
              {locationLabel ? 'Update delivery location' : 'Where should we deliver?'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Enter your city or area. You can confirm the full address at checkout.
            </p>
            <form onSubmit={applyLocation} className="space-y-2">
              <input
                type="text"
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                placeholder={locationLabel || 'e.g. Kathmandu'}
                className="input-search w-full h-10 text-sm"
                autoFocus
              />
              <button type="submit" className="btn-primary w-full justify-center text-sm">
                Apply
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
