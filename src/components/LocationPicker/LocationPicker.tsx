'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="h-56 rounded-xl bg-muted flex items-center justify-center text-sm text-muted-foreground">
      Loading map...
    </div>
  ),
});

interface LocationPickerProps {
  address: string;
  onAddressChange: (address: string) => void;
  onLocationChange?: (location: { lat: number; lng: number }) => void;
}

export default function LocationPicker({
  address,
  onAddressChange,
  onLocationChange,
}: LocationPickerProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('GPS is not supported by this browser.');
      return;
    }

    setLoading(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const newLocation = { lat, lng };
        setLocation(newLocation);
        onLocationChange?.(newLocation);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
          );

          if (response.ok) {
            const data = await response.json();
            const displayAddress = data.display_name;

            if (displayAddress) {
              onAddressChange(displayAddress);
            }
          }
        } catch {
          // GPS location still works even if address lookup fails.
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLocationError('Location permission denied. Please allow GPS access and try again.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    return () => {};
  }, []);

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-700 text-foreground">Delivery Address</label>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-700 hover:bg-blue-600 transition-colors disabled:opacity-60"
        >
          <span>📍</span>
          {loading ? 'Finding location...' : 'Use My Location'}
        </button>
      </div>

      <textarea
        className="input-search w-full min-h-28"
        placeholder="Enter your delivery address or use your GPS location"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
      />

      {locationError && <p className="text-sm text-red-500 font-600">{locationError}</p>}

      {location && (
        <div className="text-xs text-muted-foreground">
          📍 GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </div>
      )}

      <LocationMap
        location={location}
        onLocationChange={(newLocation) => {
          setLocation(newLocation);
          onLocationChange?.(newLocation);
        }}
      />
    </div>
  );
}
