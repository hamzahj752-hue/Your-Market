import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const footerLinks = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Cart', href: '/cart' },
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
];

const socialLinks = [
  { label: 'Twitter', icon: 'GlobeAltIcon', href: '#' },
  { label: 'Instagram', icon: 'CameraIcon', href: '#' },
  { label: 'Facebook', icon: 'UserGroupIcon', href: '#' },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* Arc Browser Split Pattern */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
          {/* Left: Logo + tagline */}
          <div className="flex flex-col gap-4 max-w-xs">
            <div className="flex items-center gap-2">
              <AppLogo size={36} />
              <span className="font-display text-xl font-800 text-primary">ShopAll</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Everything you need, one place. Millions of products, trusted sellers, fast delivery.
            </p>
          </div>

          {/* Right: Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 md:justify-end items-start">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-muted-foreground hover:text-foreground font-500 text-sm transition-colors focus:outline-none focus:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">© 2026 ShopAll Inc. All rights reserved.</p>
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
