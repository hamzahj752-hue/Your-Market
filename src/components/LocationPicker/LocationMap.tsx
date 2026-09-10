'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
  location: { lat: number; lng: number } | null;
  onLocationChange: (location: { lat: number; lng: number }) => void;
  className?: string;
}

export default function LocationMap({ location, onLocationChange, className }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const defaultLocation: [number, number] = [27.7172, 85.324];

    const map = L.map(mapRef.current, {
      zoomControl: true,
      touchZoom: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
    }).setView(location ? [location.lat, location.lng] : defaultLocation, location ? 15 : 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      const newLocation = {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };

      onLocationChange(newLocation);

      if (markerRef.current) {
        markerRef.current.setLatLng(event.latlng);
      } else {
        markerRef.current = L.marker(event.latlng, { draggable: true }).addTo(map);
      }
    });

    mapInstance.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create/replace the draggable marker and keep it in sync with `location`.
  useEffect(() => {
    if (!mapInstance.current || !location) return;

    const latLng: L.LatLngExpression = [location.lat, location.lng];

    const existing = mapInstance.current.getPane('markerPane');
    if (existing) {
      mapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          mapInstance.current?.removeLayer(layer);
        }
      });
    }

    markerRef.current = L.marker(latLng, { draggable: true }).addTo(mapInstance.current);
    markerRef.current.on('dragend', () => {
      const pos = markerRef.current?.getLatLng();
      if (pos) {
        onLocationChange({ lat: pos.lat, lng: pos.lng });
      }
    });

    mapInstance.current.setView(latLng, 16);
    mapInstance.current.invalidateSize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <div>
      <div
        ref={mapRef}
        className={`w-full h-[170px] sm:h-[200px] rounded-2xl overflow-hidden border border-border ${className || ''}`}
      />
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Drag the pin or tap the map to set the exact delivery location.
      </p>
    </div>
  );
}
