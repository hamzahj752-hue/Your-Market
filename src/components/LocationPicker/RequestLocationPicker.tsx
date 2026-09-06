'use client';

import React from 'react';
import LocationPicker from './LocationPicker';
import Icon from '@/components/ui/AppIcon';

export interface SavedAddress {
  id: string;
  label?: string | null;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  is_default: boolean;
}

export function resolveRequestLocation(params: {
  savedAddresses: SavedAddress[];
  selectedAddressId: string | null;
  useNewAddress: boolean;
  address: string;
  city: string;
}): { snapshot: string | null; error: string } {
  const { savedAddresses, selectedAddressId, useNewAddress, address, city } = params;
  const usingSaved = !useNewAddress && !!selectedAddressId;
  if (usingSaved) {
    const selected = savedAddresses.find((a) => a.id === selectedAddressId);
    if (!selected) {
      return { snapshot: null, error: 'Please select a valid delivery address.' };
    }
    return {
      snapshot: [selected.address_line, selected.city].filter(Boolean).join(', ') || null,
      error: '',
    };
  }
  const addressPart = address.trim();
  const cityPart = city.trim();
  if (!addressPart && !cityPart) {
    return { snapshot: null, error: 'Please enter a delivery address or city/location.' };
  }
  return { snapshot: [addressPart, cityPart].filter(Boolean).join(', ') || null, error: '' };
}

interface RequestLocationPickerProps {
  savedAddresses: SavedAddress[];
  selectedAddressId: string | null;
  useNewAddress: boolean;
  onSelectSaved: (id: string) => void;
  onUseNew: () => void;
  address: string;
  onAddressChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
}

export default function RequestLocationPicker({
  savedAddresses,
  selectedAddressId,
  useNewAddress,
  onSelectSaved,
  onUseNew,
  address,
  onAddressChange,
  city,
  onCityChange,
}: RequestLocationPickerProps) {
  return (
    <div className="space-y-4">
      {savedAddresses.length > 0 && (
        <div>
          <p className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3">
            Saved addresses
          </p>
          <div className="space-y-3">
            {savedAddresses.map((addr) => {
              const active = selectedAddressId === addr.id && !useNewAddress;
              return (
                <label
                  key={addr.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    active ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="request-saved-address"
                    className="mt-1"
                    checked={active}
                    onChange={() => {
                      onSelectSaved(addr.id);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {addr.label && (
                      <span className="text-xs font-700 text-primary uppercase tracking-wider">
                        {addr.label}
                      </span>
                    )}
                    <p className="font-700 text-sm mt-0.5">{addr.recipient_name}</p>
                    <p className="text-sm text-muted-foreground">{addr.address_line}</p>
                    <p className="text-sm text-muted-foreground">{addr.city}</p>
                    <p className="text-sm text-muted-foreground">{addr.phone}</p>
                    {addr.is_default && (
                      <span className="text-xs font-700 text-green-600 mt-1 inline-block">
                        Default
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onUseNew}
            className="mt-3 text-sm font-700 text-primary hover:underline inline-flex items-center gap-1"
          >
            <Icon name="PlusIcon" size={15} />
            Use a new address
          </button>
        </div>
      )}

      {(savedAddresses.length === 0 || useNewAddress) && (
        <div>
          <p className="text-xs font-700 uppercase tracking-widest text-muted-foreground mb-3">
            {savedAddresses.length > 0 ? 'New address' : 'Delivery location'}
          </p>
          <LocationPicker
            address={address}
            onAddressChange={onAddressChange}
            onCityChange={onCityChange}
          />
          <div className="mt-3">
            <label className="block text-sm font-600 mb-1.5">City</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="City"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
