'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import Image from 'next/image';

interface AppImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  fill?: boolean;
  sizes?: string;
  onClick?: () => void;
  loading?: 'lazy' | 'eager';
  unoptimized?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  [key: string]: any;
}

function PlaceholderBlock() {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-muted/60 text-muted-foreground/40 select-none"
      aria-hidden="true"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="M3.3 7 12 12l8.7-5" />
        <path d="M12 22V12" />
      </svg>
      <span className="text-[10px] font-600 uppercase tracking-wider">No image</span>
    </div>
  );
}

const AppImage = memo(function AppImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 85,
  placeholder = 'empty',
  blurDataURL,
  fill = false,
  sizes,
  onClick,
  loading = 'lazy',
  unoptimized = false,
  objectFit = 'cover',
  ...props
}: AppImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isExternalUrl = useMemo(() => typeof src === 'string' && src.startsWith('http'), [src]);
  const resolvedUnoptimized = unoptimized || isExternalUrl;

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const imageClassName = useMemo(() => {
    const classes = [className];
    if (isLoading && !hasError) classes.push('bg-muted/40');
    if (onClick) classes.push('cursor-pointer hover:opacity-90 transition-opacity duration-200');
    return classes.filter(Boolean).join(' ');
  }, [className, isLoading, hasError, onClick]);

  const imageProps = useMemo(() => {
    const baseProps: any = {
      src,
      alt,
      className: imageClassName,
      quality,
      placeholder,
      unoptimized: resolvedUnoptimized,
      onError: handleError,
      onLoad: handleLoad,
      onClick,
    };

    if (priority) {
      baseProps.priority = true;
    } else {
      baseProps.loading = loading;
    }

    if (blurDataURL && placeholder === 'blur') {
      baseProps.blurDataURL = blurDataURL;
    }

    return baseProps;
  }, [
    src,
    alt,
    imageClassName,
    quality,
    placeholder,
    blurDataURL,
    resolvedUnoptimized,
    priority,
    loading,
    handleError,
    handleLoad,
    onClick,
  ]);

  if (hasError) {
    if (fill) {
      return (
        <div className="absolute inset-0 overflow-hidden bg-muted/40">
          <PlaceholderBlock />
        </div>
      );
    }
    return (
      <div
        className={`relative overflow-hidden bg-muted/40 ${className}`}
        style={{ width: width || 400, height: height || 300 }}
      >
        <PlaceholderBlock />
      </div>
    );
  }

  // External URLs (e.g. Supabase Storage public objects, Unsplash, Pexels) are
  // rendered through a plain <img> instead of next/image. The app already opts
  // out of the Next image optimizer globally (images.unoptimized: true), so
  // next/image provides no optimization/security benefit here — but it DOES add
  // production-only remote-source validation on top that can incorrectly fail
  // CMS/Supabase URLs and trigger the error fallback. A plain <img> fetches the
  // exact public URL directly, preserving object-fit, alt, loading and the
  // on-error fallback while remaining just as secure.
  if (isExternalUrl && !hasError) {
    const imgStyle: React.CSSProperties = { objectFit };
    const imgClassName = `${imageClassName} ${
      isLoading ? 'opacity-0' : 'opacity-100'
    } transition-opacity duration-200`;

    if (fill) {
      return (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={src}
            alt={alt}
            className={`w-full h-full ${imgClassName}`}
            style={imgStyle}
            loading={priority ? 'eager' : loading}
            onLoad={handleLoad}
            onError={handleError}
            onClick={onClick}
            {...props}
          />
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={alt}
        width={width || 400}
        height={height || 300}
        className={imgClassName}
        style={imgStyle}
        sizes={sizes}
        loading={priority ? 'eager' : loading}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        {...props}
      />
    );
  }

  if (fill) {
    return (
      <div className="absolute inset-0">
        <Image
          {...imageProps}
          fill
          sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
          style={{ objectFit }}
          {...props}
        />
      </div>
    );
  }

  return (
    <Image {...imageProps} width={width || 400} height={height || 300} sizes={sizes} {...props} />
  );
});

AppImage.displayName = 'AppImage';

export default AppImage;
