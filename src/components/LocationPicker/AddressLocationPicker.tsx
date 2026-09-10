'use client';

import React, { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/AppIcon';

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[170px] sm:h-[200px] rounded-2xl bg-muted flex items-center justify-center text-sm text-muted-foreground">
      Loading map...
    </div>
  ),
});

function pickLocality(addr: Record<string, string | undefined>): string {
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.hamlet ||
    addr.quarter ||
    ''
  );
}

function pickDistrict(addr: Record<string, string | undefined>): string {
  return addr.county || addr.state_district || addr.state || '';
}

function buildAddressLine(addr: Record<string, string | undefined>): string {
  const parts: string[] = [];
  if (addr.house_number && addr.road) {
    parts.push(`${addr.house_number} ${addr.road}`);
  } else if (addr.road) {
    parts.push(addr.road);
  }
  const area = addr.neighbourhood || addr.suburb || addr.quarter || '';
  if (area && !parts.includes(area)) parts.push(area);
  return parts.join(', ');
}

function buildPreview(addr: Record<string, string | undefined>, displayName: string): string {
  const locality = pickLocality(addr);
  const district = pickDistrict(addr);
  if (locality && district && district !== locality) {
    return `${locality}, ${district}`;
  }
  if (locality) return locality;
  if (district) return district;
  if (displayName) {
    const segments = displayName.split(',').slice(0, 2);
    return segments.join(',').trim();
  }
  return '';
}

/** Structured Nepal address components captured from reverse geocoding.
 *  `landmark` is intentionally never geocoded — it is a human-only input. */
export interface StructuredAddressInfo {
  street: string | null;
  locality: string | null;
  district: string | null;
  province: string | null;
  ward: string | null;
  postalCode: string | null;
  country: string | null;
  formattedAddress: string | null;
}

interface AddressLocationPickerProps {
  onStreetChange: (street: string) => void;
  onCityChange: (city: string) => void;
  onLocationChange?: (location: { lat: number; lng: number } | null) => void;
  /** Fired on every reliable reverse-geocode result with the structured
   *  components. A field is null when the geocoder had no value for it. */
  onStructuredAddress?: (info: StructuredAddressInfo) => void;
  /** Coordinates already saved on this address. When editing an existing
   *  address the map opens on the saved pin instead of starting empty, so
   *  GPS data is never lost or hidden after a reopen/edit. */
  initialLocation?: { lat: number; lng: number } | null;
}

export default function AddressLocationPicker({
  onStreetChange,
  onCityChange,
  onLocationChange,
  onStructuredAddress,
  initialLocation,
}: AddressLocationPickerProps) {
  // Open on the saved pin when editing an existing address. A manual GPS tap or
  // map pin move updates this, preserving the latest coordinates for save.
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    initialLocation && Number.isFinite(initialLocation.lat) && Number.isFinite(initialLocation.lng)
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : null
  );
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [accuracyWarning, setAccuracyWarning] = useState('');
  const [detectedLocation, setDetectedLocation] = useState('');
  // When true, current GPS result is unreliable and must NOT overwrite the
  // customer's manually entered address/city. Manual pin placement clears it.
  const weakAccuracyRef = useRef(false);
  const [weakAccuracy, setWeakAccuracy] = useState(false);

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );

        if (!response.ok) {
          setDetectedLocation('');
          setLocationError(
            "We found your GPS location but couldn't determine the address. Please enter it manually."
          );
          return;
        }

        const data = await response.json();
        const addr = data.address || {};

        const addressLine = buildAddressLine(addr);
        const locality = pickLocality(addr);
        const preview = buildPreview(addr, data.display_name);

        setDetectedLocation(preview);

        const ward =
          (typeof addr.ward === 'string' && addr.ward.trim()) ||
          (typeof addr.city_district === 'string' && addr.city_district.trim()) ||
          '';
        const structured: StructuredAddressInfo = {
          street: addressLine || null,
          locality: locality || null,
          district: pickDistrict(addr) || null,
          province: typeof addr.state === 'string' && addr.state.trim() ? addr.state.trim() : null,
          ward: ward || null,
          postalCode:
            typeof addr.postcode === 'string' && addr.postcode.trim() ? addr.postcode.trim() : null,
          country:
            typeof addr.country === 'string' && addr.country.trim() ? addr.country.trim() : null,
          formattedAddress:
            typeof data.display_name === 'string' && data.display_name.trim()
              ? data.display_name.trim()
              : null,
        };

        // Only auto-fill the customer's fields when the reading is reliable.
        // A manual pin placement is a deliberate, exact selection and may fill.
        if (!weakAccuracyRef.current) {
          if (addressLine) {
            onStreetChange(addressLine);
          }
          if (locality) {
            onCityChange(locality);
          }
          onStructuredAddress?.(structured);
        }
      } catch {
        setDetectedLocation('');
        setLocationError(
          "We found your GPS location but couldn't determine the address. Please enter it manually."
        );
      }
    },
    [onStreetChange, onCityChange, onStructuredAddress]
  );

  const handleMapMove = useCallback(
    (newLocation: { lat: number; lng: number }) => {
      // Manual selection is exact — clear weak-accuracy gating and allow fill.
      weakAccuracyRef.current = false;
      setWeakAccuracy(false);
      setLocation(newLocation);
      onLocationChange?.(newLocation);
      setAccuracyWarning('');
      setDetectedLocation('');
      reverseGeocode(newLocation.lat, newLocation.lng);
    },
    [reverseGeocode, onLocationChange]
  );

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('GPS is not supported by this browser.');
      return;
    }

    setLoading(true);
    setLocationError('');
    setAccuracyWarning('');
    setDetectedLocation('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        const newLocation = { lat, lng };
        setLocation(newLocation);
        onLocationChange?.(newLocation);

        const weak = accuracy > 500;
        weakAccuracyRef.current = weak;
        setWeakAccuracy(weak);

        if (weak) {
          setAccuracyWarning(
            'Your GPS signal is weak, so we cannot confirm the exact address. Please enter your address and city manually, or move the pin on the map to confirm a precise location.'
          );
        }

        // Reverse-geocode for preview/marker, but fields are not overwritten
        // when accuracy is weak (handled inside reverseGeocode).
        await reverseGeocode(lat, lng);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) {
          setLocationError(
            'Location permission was denied. Please allow GPS access and try again.'
          );
        } else if (err.code === 2) {
          setLocationError(
            'Unable to determine your location. Please try again or enter your address manually.'
          );
        } else if (err.code === 3) {
          setLocationError(
            'Location request timed out. Please try again or enter your address manually.'
          );
        } else {
          setLocationError(
            'Unable to determine your location. Please try again or enter your address manually.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  const showDetected = detectedLocation && !weakAccuracy;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-700 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Finding your location...
            </>
          ) : location ? (
            <>
              <Icon name="ArrowPathIcon" size={14} />
              Update location
            </>
          ) : (
            <>
              <Icon name="MapPinIcon" size={14} />
              Use Current Location
            </>
          )}
        </button>
        {location && !loading && !weakAccuracy && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-600">
            <Icon name="CheckCircleIcon" size={13} className="text-green-600" />
            Location detected
          </span>
        )}
        {location && !loading && weakAccuracy && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-600">
            <Icon name="ExclamationTriangleIcon" size={13} className="text-amber-600" />
            Approximate location
          </span>
        )}
      </div>

      {locationError && <p className="text-xs text-red-500 font-600">{locationError}</p>}

      {accuracyWarning && (
        <div className="flex items-start gap-2 text-xs text-amber-600 font-600 bg-amber-50 rounded-xl px-3 py-2">
          <span className="mt-0.5">⚠</span>
          <span>{accuracyWarning}</span>
        </div>
      )}

      {weakAccuracy && detectedLocation && (
        <p className="text-xs text-amber-700 font-600 bg-amber-50 rounded-xl px-3 py-2">
          Approximate area: {detectedLocation}. Your address and city were not auto-filled because
          the GPS signal is weak — drag the pin on the map to confirm the exact delivery point.
        </p>
      )}

      {showDetected && (
        <p className="text-xs text-green-700 font-600 bg-green-50 rounded-xl px-3 py-2">
          Detected location: {detectedLocation}
        </p>
      )}

      {location && (
        <div className="rounded-2xl overflow-hidden border border-border">
          <LocationMap location={location} onLocationChange={handleMapMove} />
        </div>
      )}
    </div>
  );
}
