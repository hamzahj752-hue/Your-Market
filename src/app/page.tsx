import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/HeroSection';
import PromoBannerSection from '@/components/PromoBannerSection';
import SendProductBanner from '@/components/SendProductBanner';
import CategoriesSection from '@/components/CategoriesSection';
import DealsSection from '@/components/DealsSection';
import FeaturedProducts from '@/components/FeaturedProducts';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pb-28 lg:pb-0">
        <HeroSection />

        <PromoBannerSection />

        <SendProductBanner />

        <CategoriesSection />
        <DealsSection />
        <FeaturedProducts />
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
