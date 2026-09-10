'use client';

import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { ResolvedCategoryCardStyle } from '@/lib/categoryCardStyle';

export interface CategoryCardSpec {
  key: string;
  name: string;
  image: string | null;
  href: string;
}

/**
 * Reusable, admin-appearance-aware category card. Used by the homepage
 * "Shop by Category" strip, the homepage "Food" row, and the Product Details
 * Fast Foods strip. Appearance is driven by a ResolvedCategoryCardStyle
 * (bounded presets from Admin → Homepage), while navigation stays exactly the
 * provided href — appearance and navigation are separate concerns.
 */
export default function CategoryCard({
  spec,
  style,
}: {
  spec: CategoryCardSpec;
  style: ResolvedCategoryCardStyle;
}) {
  return (
    <Link
      key={spec.key}
      href={spec.href}
      className={`group flex ${style.widthClass} flex-shrink-0 flex-col gap-1.5 ${style.cardClass} ${style.paddingClass} overflow-hidden border border-border/60 bg-card transition-colors hover:border-primary/40 hover:shadow-sm`}
    >
      <div
        className={`relative aspect-square w-full ${style.imageClass} overflow-hidden bg-[#f7f4ee]`}
      >
        {spec.image ? (
          <AppImage
            src={spec.image}
            alt={spec.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="130px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 text-primary">
            <Icon name="FolderIcon" size={style.iconSize} />
          </div>
        )}
      </div>
      <span
        className={`${style.labelClass} line-clamp-2 min-h-0 text-center font-700 text-foreground leading-tight`}
      >
        {spec.name}
      </span>
    </Link>
  );
}
