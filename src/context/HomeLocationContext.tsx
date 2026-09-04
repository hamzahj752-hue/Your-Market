'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface HomeLocationValue {
  locationLabel: string;
  setLocationLabel: (label: string) => void;
  clearLocation: () => void;
}

const STORAGE_KEY = 'ym_home_location';

const HomeLocationContext = createContext<HomeLocationValue | undefined>(undefined);

function readStored(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function HomeLocationProvider({ children }: { children: React.ReactNode }) {
  const [locationLabel, setLocationLabelState] = useState<string>(() =>
    typeof window === 'undefined' ? '' : readStored()
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locationLabel);
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  }, [locationLabel]);

  const setLocationLabel = (label: string) => setLocationLabelState(label.trim());
  const clearLocation = () => setLocationLabelState('');

  return (
    <HomeLocationContext.Provider value={{ locationLabel, setLocationLabel, clearLocation }}>
      {children}
    </HomeLocationContext.Provider>
  );
}

export function useHomeLocation(): HomeLocationValue {
  const ctx = useContext(HomeLocationContext);
  if (!ctx) {
    throw new Error('useHomeLocation must be used within a HomeLocationProvider');
  }
  return ctx;
}
