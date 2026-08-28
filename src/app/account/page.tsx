'use client';

import React from 'react';
import { CartProvider } from '@/context/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';


const menuItems = [
  { icon: 'ShoppingBagIcon', label: 'My Orders', desc: 'Track, return or buy again' },
  { icon: 'HeartIcon', label: 'Wishlist', desc: 'Your saved items' },
  { icon: 'MapPinIcon', label: 'Addresses', desc: 'Manage delivery addresses' },
  { icon: 'CreditCardIcon', label: 'Payment Methods', desc: 'Cards, wallets & more' },
  { icon: 'BellIcon', label: 'Notifications', desc: 'Deals, offers & updates' },
  { icon: 'Cog6ToothIcon', label: 'Settings', desc: 'App preferences & privacy' },
];

function AccountContent() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-card p-6 flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name="UserCircleIcon" size={40} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-700 text-foreground truncate">Guest User</p>
          <p className="text-sm text-muted-foreground">Sign in to access your account</p>
        </div>
        <button className="btn-primary text-sm px-4 py-2 flex-shrink-0">
          Sign In
        </button>
      </div>

      {/* Menu Items */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-border">
        {menuItems?.map((item) => (
          <button
            key={item?.label}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
              <Icon name={item?.icon} size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-600 text-foreground text-sm">{item?.label}</p>
              <p className="text-xs text-muted-foreground">{item?.desc}</p>
            </div>
            <Icon name="ChevronRightIcon" size={16} className="text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Help */}
      <div className="mt-4 bg-white rounded-2xl shadow-card overflow-hidden">
        <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors text-left">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <Icon name="QuestionMarkCircleIcon" size={20} className="text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-600 text-foreground text-sm">Help & Support</p>
            <p className="text-xs text-muted-foreground">FAQs, contact us</p>
          </div>
          <Icon name="ChevronRightIcon" size={16} className="text-muted-foreground flex-shrink-0" />
        </button>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 pt-24 md:pt-28 pb-16 lg:pb-0">
          <AccountContent />
        </main>
        <Footer />
        <BottomNav />
      </div>
    </CartProvider>
  );
}
