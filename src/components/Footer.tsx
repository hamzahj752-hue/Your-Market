import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const quickLinks = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Wishlist', href: '/wishlist' },
  { label: 'Cart', href: '/cart' },
];

const supportLinks = [
  { label: 'Account', href: '/account' },
  { label: 'Notifications', href: '/account/notifications' },
];

const socialLinks = [
  { label: 'Twitter', icon: 'GlobeAltIcon', href: '#' },
  { label: 'Instagram', icon: 'CameraIcon', href: '#' },
  { label: 'Facebook', icon: 'UserGroupIcon', href: '#' },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-white hidden lg:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-4 max-w-xs">
            <div className="flex items-center gap-2">
              <AppLogo size={34} />
              <span className="font-display text-xl font-800 text-primary">Your Market</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your one-stop local marketplace for electronics, fashion, home &amp; more — real
              products, fast checkout, easy returns.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3 md:justify-end items-start">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-1">
                Shop
              </span>
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground hover:text-primary font-500 text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-1">
                Account
              </span>
              {supportLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground hover:text-primary font-500 text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Your Market. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all"
              >
                <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={16} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
