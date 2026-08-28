'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/context/CartContext';

const featuredProducts = [
{
  id: 'p1',
  name: 'Sony WH-1000XM5 Wireless Headphones',
  price: 37299,
  originalPrice: 46599,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12c20386e-1772727883790.png",
  alt: 'Black Sony over-ear wireless headphones on white background, product studio shot',
  category: 'Electronics',
  rating: 4.8,
  reviews: 3241,
  discount: 20,
  badge: 'Best Seller',
  variant: 'Midnight Black'
},
{
  id: 'p2',
  name: 'Instant Pot Duo 7-in-1 Pressure Cooker',
  price: 10643,
  originalPrice: 13293,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1cdb5ce95-1784978159680.png",
  alt: 'Stainless steel electric pressure cooker on kitchen counter, bright natural light',
  category: 'Home & Kitchen',
  rating: 4.7,
  reviews: 8921,
  discount: 20,
  badge: 'Top Rated',
  variant: 'Stainless Steel'
},
{
  id: 'p3',
  name: 'Nike Air Max 270 Running Shoes',
  price: 14623,
  originalPrice: 19943,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1ab57f281-1772754797746.png",
  alt: 'White Nike running shoe side profile on clean white surface, bright studio lighting',
  category: 'Fashion',
  rating: 4.6,
  reviews: 5678,
  discount: 27,
  badge: 'Sale',
  variant: 'White / Max Orange'
},
{
  id: 'p4',
  name: 'Kindle Paperwhite 16GB E-Reader',
  price: 18619,
  originalPrice: 21279,
  image: "https://images.unsplash.com/photo-1652717492938-82920653e04b",
  alt: 'E-reader device displaying book page on white background, minimal product shot',
  category: 'Electronics',
  rating: 4.9,
  reviews: 12034,
  discount: 13,
  badge: 'Amazon Choice',
  variant: 'Black'
},
{
  id: 'p5',
  name: 'Neutrogena Hydro Boost Skincare Set',
  price: 4653,
  originalPrice: 7313,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_191f10152-1764825393789.png",
  alt: 'Skincare products cosmetics bottles on white marble surface, soft beauty lighting',
  category: 'Beauty',
  rating: 4.5,
  reviews: 2109,
  discount: 36,
  badge: 'Deal',
  variant: 'Normal to Dry'
},
{
  id: 'p6',
  name: 'Wilson NBA Official Basketball',
  price: 5983,
  originalPrice: 8643,
  image: "https://images.unsplash.com/photo-1554010213-f66dbc0acbe0",
  alt: 'Orange basketball on hardwood gym floor, dramatic sports lighting from above',
  category: 'Sports',
  rating: 4.7,
  reviews: 1893,
  discount: 31,
  badge: 'New',
  variant: 'Size 7'
}];


function StarRating({ rating }: {rating: number;}) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) =>
      <Icon
        key={i}
        name={i <= Math.floor(rating) ? 'StarIcon' : 'StarIcon'}
        variant={i <= Math.floor(rating) ? 'solid' : 'outline'}
        size={12}
        className={i <= Math.floor(rating) ? 'star-filled' : 'text-muted-foreground/30'} />

      )}
    </div>);

}

export default function FeaturedProducts() {
  const { addToCart } = useCart();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [addedIds, setAddedIds] = React.useState<Set<string>>(new Set());

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const cards = section.querySelectorAll<HTMLElement>('.prod-card');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
            setTimeout(() => {
              el.classList.add('animate-fade-up');
              el.style.opacity = '1';
            }, idx * 100);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    cards.forEach((card) => {
      card.style.opacity = '0';
      observer.observe(card);
    });
    return () => observer.disconnect();
  }, []);

  const handleAddToCart = (p: (typeof featuredProducts)[0]) => {
    addToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      image: p.image,
      category: p.category,
      rating: p.rating,
      discount: p.discount,
      variant: p.variant
    });
    setAddedIds((prev) => new Set([...prev, p.id]));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }, 1800);
  };

  return (
    <section className="section-pad bg-muted/40" ref={sectionRef} aria-labelledby="featured-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-accent font-700 text-sm uppercase tracking-widest mb-2 block">Curated for You</span>
            <h2 id="featured-heading" className="text-section-title font-800 text-foreground leading-tight">
              Featured Products
            </h2>
          </div>
          <Link href="/products" className="hidden sm:flex items-center gap-1 text-primary font-600 text-sm hover:gap-2 transition-all">
            See all
            <span>→</span>
          </Link>
        </div>

        {/* BENTO AUDIT:
           Row 1: [col-1: P1] [col-2: P2] [col-3: P3]
           Row 2: [col-1: P4] [col-2: P5] [col-3: P6]
           Placed 6/6 ✓
          */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featuredProducts.map((p, i) =>
          <div
            key={p.id}
            data-idx={i}
            className="prod-card animate-on-scroll">
            
              <div className="bg-card rounded-2xl overflow-hidden card-shadow product-card-hover group flex flex-col h-full">
                {/* Image */}
                <div className="relative h-52 overflow-hidden bg-muted/30">
                  <AppImage
                  src={p.image}
                  alt={p.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
                
                  {/* Discount Badge */}
                  {p.discount &&
                <div className="absolute top-3 left-3">
                      <span className="badge-deal">-{p.discount}%</span>
                    </div>
                }
                  {/* Type Badge */}
                  <div className="absolute top-3 right-3">
                    <span className="bg-white/90 backdrop-blur-sm text-primary text-[10px] font-700 px-2 py-1 rounded-full">
                      {p.badge}
                    </span>
                  </div>
                  {/* Quick add overlay */}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300" />
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1">
                  <span className="text-xs text-muted-foreground font-600 uppercase tracking-wider mb-1">
                    {p.category}
                  </span>
                  <h3 className="text-sm font-700 text-foreground leading-snug mb-2 line-clamp-2 flex-1">
                    {p.name}
                  </h3>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-3">
                    <StarRating rating={p.rating} />
                    <span className="text-xs text-muted-foreground">
                      {p.rating} ({p.reviews.toLocaleString()})
                    </span>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-lg font-800 price-deal">रू{p.price.toLocaleString()}</span>
                    {p.originalPrice &&
                  <span className="price-original">रू{p.originalPrice.toLocaleString()}</span>
                  }
                  </div>

                  {/* Add to Cart */}
                  <button
                  onClick={() => handleAddToCart(p)}
                  className={`w-full py-2.5 rounded-xl font-700 text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                  addedIds.has(p.id) ?
                  'bg-green-500 text-white' : 'bg-primary text-primary-foreground hover:bg-blue-600 active:scale-95'}`
                  }
                  aria-label={`Add ${p.name} to cart`}>
                  
                    {addedIds.has(p.id) ?
                  <>
                        <Icon name="CheckIcon" size={16} />
                        Added!
                      </> :

                  <>
                        <Icon name="ShoppingCartIcon" size={16} />
                        Add to Cart
                      </>
                  }
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile see all */}
        <div className="mt-8 flex justify-center sm:hidden">
          <Link href="/products">
            <button className="btn-outline">
              See All Products
              <Icon name="ArrowRightIcon" size={16} />
            </button>
          </Link>
        </div>
      </div>
    </section>);

}