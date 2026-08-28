import React from 'react';
import { CartProvider } from '@/context/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/HeroSection';
import CategoriesSection from '@/components/CategoriesSection';
import FeaturedProducts from '@/components/FeaturedProducts';
import DealsSection from '@/components/DealsSection';
import TrustSection from '@/components/TrustSection';

export default function HomePage() {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">
          <HeroSection />
          <CategoriesSection />
          <FeaturedProducts />
          <DealsSection />
          <TrustSection />
        </main>
        <Footer />
        <BottomNav />
      </div>
    </CartProvider>
  );
}
