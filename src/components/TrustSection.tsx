'use client';

import React, { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';

const testimonials = [
{
  quote: "ShopAll completely changed how I shop online. The prices are unbeatable and delivery is always on time. I\'ve ordered over 40 times in the past year.",
  author: 'Priya Sharma',
  role: 'Verified Buyer',
  company: 'Chicago, IL',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_137992a44-1763292727193.png",
  avatarAlt: 'South Asian woman professional headshot, warm smile, natural light portrait',
  rating: 5
},
{
  quote: "The return process is hassle-free and customer service actually picks up. I switched from Amazon and haven\'t looked back since.",
  author: 'Marcus Johnson',
  role: 'Verified Buyer',
  company: 'Atlanta, GA',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_18d854688-1763295573707.png",
  avatarAlt: 'African American man professional headshot, confident smile, bright office background',
  rating: 5
},
{
  quote: "Found my whole home renovation shopping list in one place. The product descriptions are detailed and the photos are accurate — no surprises.",
  author: 'Linda Chen',
  role: 'Verified Buyer',
  company: 'San Francisco, CA',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_10d60e496-1763295319842.png",
  avatarAlt: 'East Asian woman smiling portrait, professional headshot, natural daylight',
  rating: 5
}];


const trustBadges = [
{ icon: 'ShieldCheckIcon', label: 'Buyer Protection', sub: '100% guaranteed' },
{ icon: 'TruckIcon', label: 'Fast Delivery', sub: '2-5 business days' },
{ icon: 'ArrowPathIcon', label: 'Easy Returns', sub: '30-day policy' },
{ icon: 'LockClosedIcon', label: 'Secure Payment', sub: 'SSL encrypted' }];


export default function TrustSection() {
  const [idx, setIdx] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {if (entry.isIntersecting) setVisible(true);},
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setWords(testimonials[idx].quote.split(' '));
  }, [idx]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [visible]);

  const t = testimonials[idx];
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section className="section-pad bg-muted/30" ref={sectionRef} aria-labelledby="trust-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {trustBadges.map((badge, i) =>
          <div
            key={badge.label}
            className={`bg-white rounded-2xl p-5 card-shadow flex flex-col items-center text-center transition-all duration-500 ${
            visible ? 'animate-fade-up' : 'opacity-0'}`
            }
            style={{ animationDelay: `${i * 100}ms` }}>
            
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Icon name={badge.icon as Parameters<typeof Icon>[0]['name']} size={24} className="text-primary" />
              </div>
              <h3 className="text-sm font-700 text-foreground mb-0.5">{badge.label}</h3>
              <p className="text-xs text-muted-foreground">{badge.sub}</p>
            </div>
          )}
        </div>

        {/* Testimonial */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Left: heading */}
          <div className="lg:w-1/3 flex-shrink-0">
            <span className="text-accent font-700 text-sm uppercase tracking-widest mb-3 block">What Shoppers Say</span>
            <h2 id="trust-heading" className="text-section-title font-800 text-foreground leading-tight mb-6">
              Trusted by Millions of Buyers
            </h2>
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((i) =>
              <Icon key={i} name="StarIcon" variant="solid" size={20} className="star-filled" />
              )}
              <span className="text-foreground font-700 ml-2">4.8/5</span>
              <span className="text-muted-foreground text-sm">from 1.2M reviews</span>
            </div>
            {/* Avatar row */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {testimonials.map((t2, i) =>
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full border-2 border-white overflow-hidden transition-all duration-300 cursor-pointer ${
                  i === idx ? 'scale-110 z-10 border-accent' : 'opacity-60'}`
                  }
                  onClick={() => setIdx(i)}
                  role="button"
                  aria-label={`View testimonial from ${t2.author}`}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setIdx(i)}>
                  
                    <AppImage
                    src={t2.avatar}
                    alt={t2.avatarAlt}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full" />
                  
                  </div>
                )}
              </div>
              <span className="text-muted-foreground text-xs font-600">+1.2M shoppers</span>
            </div>
          </div>

          {/* Right: testimonial card */}
          <div className="lg:w-2/3 w-full">
            <div className="bg-white rounded-3xl p-8 md:p-10 card-shadow-lg relative overflow-hidden">
              {/* Quote mark */}
              <div className="absolute top-6 right-8 opacity-5">
                <Icon name="ChatBubbleLeftRightIcon" size={80} className="text-primary" />
              </div>

              {/* Index */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((i) =>
                  <Icon key={i} name="StarIcon" variant="solid" size={14} className="star-filled" />
                  )}
                </div>
                <span className="font-mono text-muted-foreground text-sm">
                  {pad(idx + 1)} / {pad(testimonials.length)}
                </span>
              </div>

              {/* Animated quote */}
              <blockquote className="text-xl md:text-2xl font-400 text-foreground leading-relaxed mb-8 min-h-[120px]">
                {words.map((word, wi) =>
                <span
                  key={`${idx}-${wi}`}
                  className="inline-block mr-1.5 animate-on-scroll animate-fade-up"
                  style={{ animationDelay: `${wi * 25}ms` }}>
                  
                    {word}
                  </span>
                )}
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-accent/30 flex-shrink-0">
                  <AppImage
                    src={t.avatar}
                    alt={t.avatarAlt}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full" />
                  
                </div>
                <div className="border-l-2 border-accent pl-4">
                  <span className="block font-700 text-foreground text-sm">{t.author}</span>
                  <span className="block text-xs text-muted-foreground font-500 uppercase tracking-wider">
                    {t.role} · {t.company}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6 h-0.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${(idx + 1) / testimonials.length * 100}%` }} />
                
              </div>
            </div>

            {/* Navigation dots */}
            <div className="flex justify-center gap-2 mt-4">
              {testimonials.map((_, i) =>
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Testimonial ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                i === idx ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30'}`
                } />

              )}
            </div>
          </div>
        </div>
      </div>
    </section>);

}