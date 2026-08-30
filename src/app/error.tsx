'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const handleReset = () => {
    reset?.();
  };

  return (
    <div className="min-h-[60vh] bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-5">
          <Icon name="ExclamationTriangleIcon" size={32} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-800 mb-3">Something went wrong</h1>
        <p className="text-muted-foreground mb-8">
          We ran into an unexpected problem. Please try again. If the issue persists, contact
          support.
        </p>
        <button onClick={handleReset} className="btn-primary inline-flex items-center gap-2">
          <Icon name="ArrowPathIcon" size={18} />
          Try Again
        </button>
      </div>
    </div>
  );
}
