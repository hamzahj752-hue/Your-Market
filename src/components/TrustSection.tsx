'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import {
  fetchTestimonials,
  fetchTrustItems,
  BriefTestimonial,
  BriefTrust,
} from '@/lib/homepageCms';

interface DisplayTestimonial {
  quote: string;
  author: string;
  role: string;
  avatar?: string;
  rating?: number;
}

interface DisplayTrust {
  icon: string;
  label: string;
  sub: string;
}

const defaultTrustBadges: DisplayTrust[] = [
  { icon: 'ShieldCheckIcon', label: 'Buyer Protection', sub: 'Secure purchases' },
  { icon: 'TruckIcon', label: 'Fast Delivery', sub: 'Quick doorstep shipping' },
  { icon: 'ArrowPathIcon', label: 'Easy Returns', sub: 'Simple return policy' },
  { icon: 'LockClosedIcon', label: 'Secure Payment', sub: 'Encrypted checkout' },
];

function toDisplayTestimonial(t: BriefTestimonial): DisplayTestimonial {
  return {
    quote: t.testimonial_text,
    author: t.customer_name,
    role: 'Customer',
    avatar: t.customer_image_url || undefined,
    rating: t.rating || undefined,
  };
}

function toDisplayTrust(t: BriefTrust): DisplayTrust {
  return {
    icon: t.icon || 'ShieldCheckIcon',
    label: t.title,
    sub: t.description || '',
  };
}

function Avatar({
  src,
  alt,
  name,
  size,
  className = '',
}: {
  src?: string;
  alt?: string;
  name: string;
  size: number;
  className?: string;
}) {
  if (!src) {
    const initials = name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return (
      <div
        className={`flex items-center justify-center bg-primary/10 text-primary font-800 ${className}`}
        style={{ width: size, height: size }}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || name}
      className={`object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export default function TrustSection() {
  const [idx, setIdx] = useState(0);
  const [testimonials, setTestimonials] = useState<DisplayTestimonial[]>([]);
  const [trustBadges, setTrustBadges] = useState<DisplayTrust[]>(defaultTrustBadges);

  useEffect(() => {
    let active = true;
    Promise.all([fetchTestimonials(), fetchTrustItems()]).then(([cmsTestimonials, cmsTrust]) => {
      if (!active) return;
      if (cmsTestimonials.length > 0) {
        setTestimonials(cmsTestimonials.map(toDisplayTestimonial));
        setIdx(0);
      }
      if (cmsTrust.length > 0) setTrustBadges(cmsTrust.map(toDisplayTrust));
    });
    return () => {
      active = false;
    };
  }, []);

  const t = testimonials[idx];

  return (
    <section className="section-pad bg-muted/30" aria-labelledby="trust-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {trustBadges.map((badge) => (
            <div
              key={badge.label}
              className="bg-white rounded-2xl p-4 md:p-5 card-shadow flex flex-col items-center text-center"
            >
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Icon
                  name={badge.icon as Parameters<typeof Icon>[0]['name']}
                  size={24}
                  className="text-primary"
                />
              </div>
              <h3 className="text-sm font-700 text-foreground mb-0.5">{badge.label}</h3>
              <p className="text-xs text-muted-foreground">{badge.sub}</p>
            </div>
          ))}
        </div>

        {/* Testimonials (only from CMS — never fabricated) */}
        {testimonials.length > 0 && (
          <>
            <div className="flex flex-col lg:flex-row items-center gap-10 mt-16">
              {/* Left: heading */}
              <div className="lg:w-1/3 flex-shrink-0 w-full">
                <span className="text-accent font-700 text-sm uppercase tracking-widest mb-3 block">
                  What Shoppers Say
                </span>
                <h2
                  id="trust-heading"
                  className="text-section-title font-800 text-foreground leading-tight mb-4"
                >
                  Real reviews from real customers
                </h2>
              </div>

              {/* Right: testimonial card */}
              <div className="lg:w-2/3 w-full">
                <div className="bg-white rounded-3xl p-6 md:p-8 card-shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between mb-5">
                    {t.rating ? (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Icon
                            key={i}
                            name="StarIcon"
                            variant="solid"
                            size={14}
                            className={
                              i <= Math.floor(t.rating) ? 'star-filled' : 'text-muted-foreground/30'
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <span />
                    )}
                    <span className="font-mono text-muted-foreground text-sm">
                      {String(idx + 1).padStart(2, '0')} /{' '}
                      {String(testimonials.length).padStart(2, '0')}
                    </span>
                  </div>

                  <blockquote className="text-lg md:text-xl font-400 text-foreground leading-relaxed mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-accent/30 flex-shrink-0">
                      <Avatar
                        src={t.avatar}
                        name={t.author}
                        size={48}
                        className="w-12 h-12 rounded-full"
                      />
                    </div>
                    <div className="border-l-2 border-accent pl-4">
                      <span className="block font-700 text-foreground text-sm">{t.author}</span>
                      <span className="block text-xs text-muted-foreground font-500 uppercase tracking-wider">
                        {t.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Navigation dots */}
                <div className="flex justify-center gap-2 mt-4">
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setIdx(i)}
                      aria-label={`Testimonial ${i + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i === idx ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
