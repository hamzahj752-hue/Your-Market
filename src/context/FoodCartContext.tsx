'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Dedicated Food cart — SEPARATE from the normal product cart on purpose.
 *
 * Food ordering is a distinct marketplace flow in YourMarket: food items live
 * in their own localStorage key so a Food product can never leak into the
 * normal cart/checkout and vice-versa. The server-side `place_order` RPC also
 * rejects a mixed Food + normal basket, so these two carts stay fully
 * independent by design.
 *
 * Note: cart contents are stored locally for the customer (like the normal
 * cart). There is no server-side cart persistence for either flow.
 */

export interface FoodCartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
}

export interface FoodCartAddInput {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
}

interface FoodCartContextValue {
  hydrated: boolean;
  items: FoodCartItem[];
  count: number;
  subtotal: number;
  addFood: (input: FoodCartAddInput, qty?: number) => void;
  setFoodQty: (id: string, qty: number) => void;
  removeFood: (id: string) => void;
  clearFoodCart: () => void;
}

const FoodCartContext = createContext<FoodCartContextValue | null>(null);

const STORAGE_KEY = 'yourmarket-food-cart';

function readStored(): FoodCartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: typeof item?.id === 'string' ? item.id : '',
        name: typeof item?.name === 'string' ? item.name : '',
        price: Number(item?.price ?? 0),
        originalPrice: item?.originalPrice != null ? Number(item.originalPrice) : undefined,
        image: typeof item?.image === 'string' ? item.image : '',
        quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(1, Number(item.quantity)) : 1,
      }))
      .filter((item) => item.id && item.name);
  } catch {
    return [];
  }
}

export function FoodCartProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<FoodCartItem[]>([]);

  // Hydrate from localStorage after mount (SSR safety: window is not defined
  // during the first render).
  useEffect(() => {
    setItems(readStored());
    setHydrated(true);
  }, []);

  // Persist every change once hydrated.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / blocked — cart still works in memory for the session */
    }
  }, [items, hydrated]);

  const addFood = useCallback((input: FoodCartAddInput, qty = 1) => {
    const quantity = Number.isFinite(Number(qty)) && Number(qty) >= 1 ? Math.round(qty) : 1;
    setItems((prev) => {
      const existing = prev.find((i) => i.id === input.id);
      if (existing) {
        return prev.map((i) => (i.id === input.id ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { ...input, quantity }];
    });
  }, []);

  const setFoodQty = useCallback((id: string, qty: number) => {
    const quantity = Number.isFinite(Number(qty)) && Number(qty) >= 1 ? Math.round(qty) : 1;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
  }, []);

  const removeFood = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearFoodCart = useCallback(() => {
    setItems([]);
  }, []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  return (
    <FoodCartContext.Provider
      value={{ hydrated, items, count, subtotal, addFood, setFoodQty, removeFood, clearFoodCart }}
    >
      {children}
    </FoodCartContext.Provider>
  );
}

export function useFoodCart(): FoodCartContextValue {
  const ctx = useContext(FoodCartContext);
  if (!ctx) throw new Error('useFoodCart must be used within FoodCartProvider');
  return ctx;
}
