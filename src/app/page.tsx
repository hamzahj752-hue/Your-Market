import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/HeroSection';
import PromoBannerSection from '@/components/PromoBannerSection';
import SendProductBanner from '@/components/SendProductBanner';
import CategoriesSection from '@/components/CategoriesSection';
import FeaturedProducts from '@/components/FeaturedProducts';
import DealsSection from '@/components/DealsSection';
import TrustSection from '@/components/TrustSection';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pb-16 lg:pb-0">
        <HeroSection />

        {/* Secondary promo banner — distinct from hero, Admin-managed */}
        <PromoBannerSection />

        {/* Send Your Product — directly below the promotional area */}
        <SendProductBanner />

        <CategoriesSection />
        <FeaturedProducts />
        <DealsSection />
        <TrustSection />
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
