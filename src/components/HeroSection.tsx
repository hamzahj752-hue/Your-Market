import React from 'react';
import AppImage from '@/components/ui/AppImage';

export default function HeroSection() {
  return (
    <section className="pt-16 sm:pt-20 md:pt-24" aria-label="Homepage banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-0 md:pb-12">
        {/* Fixed brand banner — the artwork is the complete Hero (2048x768). */}
        <div className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden bg-muted/40 shadow-card-lg">
          <AppImage
            src="/assets/yourmarket-main-banner.png"
            alt="Your Market online shopping"
            width={2048}
            height={768}
            priority
            className="block w-full h-auto object-contain"
          />
        </div>
      </div>
    </section>
  );
}
