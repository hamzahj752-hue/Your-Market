'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
  location: { lat: number; lng: number } | null;
  onLocationChange: (location: { lat: number; lng: number }) => void;
}

export default function LocationMap({ location, onLocationChange }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const defaultLocation: [number, number] = [27.7172, 85.324];

    const map = L.map(mapRef.current).setView(
      location ? [location.lat, location.lng] : defaultLocation,
      location ? 15 : 12
    );

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
        markerRef.current = L.marker(event.latlng).addTo(map);
      }
    });

    mapInstance.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !location) return;

    const latLng: L.LatLngExpression = [location.lat, location.lng];

    mapInstance.current.setView(latLng, 16);

    if (markerRef.current) {
      markerRef.current.setLatLng(latLng);
    } else {
      markerRef.current = L.marker(latLng).addTo(mapInstance.current);
    }
  }, [location]);

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-56 rounded-xl overflow-hidden border border-border" />

      <div className="absolute bottom-3 left-3 right-3 z-[1000] pointer-events-none">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-foreground shadow-md">
          📍 Click on the map to select your delivery location
        </div>
      </div>
    </div>
  );
}
