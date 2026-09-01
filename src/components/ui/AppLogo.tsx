'use client';

import React, { memo, useEffect, useState, useMemo } from 'react';
import AppIcon from './AppIcon';
import AppImage from './AppImage';

interface AppLogoProps {
  src?: string; // Image source (optional). Empty => use icon fallback.
  iconName?: string; // Icon name when no image
  size?: number; // Size for icon/image
  className?: string; // Additional classes
  onClick?: () => void; // Click handler
}

// Neutral, on-brand fallback when no store logo is configured or the configured
// logo fails to load. Not the decorative/Sparkles icon and never a broken image.
const FALLBACK_ICON = 'ShoppingBagIcon';

const AppLogo = memo(function AppLogo({
  src = '',
  iconName = FALLBACK_ICON,
  size = 64,
  className = '',
  onClick,
}: AppLogoProps) {
  // If the logo image fails to load, fall back to the icon instead of showing
  // a broken-image icon. Reset the error state whenever the src changes.
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [src]);

  const containerClassName = useMemo(() => {
    const classes = ['flex items-center'];
    if (onClick) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [onClick, className]);

  const showImage = !!src && !imgError;

  return (
    <div className={containerClassName} onClick={onClick}>
      {showImage ? (
        <AppImage
          src={src}
          alt="Store logo"
          width={size}
          height={size}
          className="flex-shrink-0 object-contain"
          priority={true}
          unoptimized={true}
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="inline-flex items-center justify-center flex-shrink-0 rounded-xl bg-primary/10 text-primary"
          style={{ width: size + 4, height: size + 4 }}
          aria-hidden="true"
        >
          <AppIcon name={iconName || FALLBACK_ICON} size={size - 4} />
        </span>
      )}
    </div>
  );
});

export default AppLogo;
