'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
  discount?: number;
  variant?: string;
  quantity: number;
  inStock?: boolean;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  cartError: string;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  clearCartError: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const KEY = 'yourmarket-cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [cartError, setCartError] = useState('');
  const userIdRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const hydratedRef = useRef(false);
  const itemsRef = useRef<CartItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(
              (item) =>
                item &&
                typeof item.id === 'string' &&
                typeof item.quantity === 'number' &&
                item.quantity > 0
            )
          );
        }
      }
    } catch {
      setItems([]);
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      readyRef.current = true;
      localStorage.setItem(KEY, JSON.stringify(items));
    }
  }, [items, ready]);

  // Write the given cart to Supabase for a user (delete-all + re-insert).
  const persistCart = async (userId: string, cartItems: CartItem[]) => {
    await supabase.from('cart_items').delete().eq('user_id', userId);
    if (cartItems.length > 0) {
      await supabase.from('cart_items').insert(
        cartItems.map((i) => ({
          user_id: userId,
          product_id: i.id,
          quantity: i.quantity,
        }))
      );
    }
  };

  // Load the signed-in user's cart from Supabase, merging with any local cart.
  useEffect(() => {
    let cancelled = false;

    const loadRemoteCart = async (userId: string) => {
      const { data, error } = await supabase
        .from('cart_items')
        .select('product_id, quantity')
        .eq('user_id', userId);

      if (cancelled || error) return;

      // No saved remote cart: keep the local (guest) cart and push it up to
      // this account so it isn't lost on the first login.
      if (!data || data.length === 0) {
        const local = itemsRef.current;
        if (local.length > 0) await persistCart(userId, local);
        return;
      }

      const ids = data.map((r) => r.product_id);
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('*')
        .in('id', ids);

      if (cancelled || pErr || !products) return;

      const remoteItems: CartItem[] = data
        .map((row) => {
          const p = products.find((pr) => pr.id === row.product_id);
          if (!p) return null;
          return {
            id: p.id,
            name: p.name,
            price: Number(p.price),
            originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
            image: p.image,
            category: p.category,
            rating: Number(p.rating),
            discount: p.discount != null ? Number(p.discount) : undefined,
            variant: p.variant ?? undefined,
            quantity: Number(row.quantity),
            inStock: Boolean(p.in_stock),
          } as CartItem;
        })
        .filter((i): i is CartItem => i !== null);

      if (cancelled) return;

      const local = itemsRef.current;
      const merged =
        local.length === 0
          ? remoteItems
          : (() => {
              // Merge: remote quantities win, but keep local-only entries too.
              const result = [...remoteItems];
              local.forEach((item) => {
                const existing = result.find((m) => m.id === item.id);
                if (!existing) result.push(item);
                else if (existing.quantity < item.quantity) existing.quantity = item.quantity;
              });
              return result;
            })();

      setItems(merged);
    };

    const applyUserId = async (id: string | null) => {
      userIdRef.current = id;

      if (!id) {
        // On logout, drop the current user's cart so a different user signing
        // in on this device never inherits someone else's items.
        hydratedRef.current = false;
        setItems([]);
        return;
      }

      if (!hydratedRef.current) {
        hydratedRef.current = true;
        await loadRemoteCart(id);
      }
    };

    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await applyUserId(data.user.id);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await applyUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Persist the cart to Supabase for signed-in users whenever it changes.
  useEffect(() => {
    if (!readyRef.current) return;
    const userId = userIdRef.current;
    if (!userId) return;

    const t = setTimeout(() => {
      if (userIdRef.current !== userId) return;
      void persistCart(userId, itemsRef.current);
    }, 200);

    return () => clearTimeout(t);
  }, [items]);

  const value = useMemo(
    () => ({
      items,

      totalItems: items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      cartError,

      addToCart: (item: Omit<CartItem, 'quantity'>) => {
        setCartError('');

        if (item.inStock === false) {
          setCartError(`${item.name} is currently out of stock.`);
          return;
        }

        setItems((prev) => {
          const found = prev.find((i) => i.id === item.id);

          return found
            ? prev.map((i) => (i.id === item.id ? { ...i, ...item, quantity: i.quantity + 1 } : i))
            : [...prev, { ...item, quantity: 1 }];
        });
      },

      updateQuantity: (id: string, quantity: number) => {
        setCartError('');

        if (quantity <= 0) {
          setItems((prev) => prev.filter((i) => i.id !== id));
          return;
        }

        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== id) return i;

            if (i.inStock === false) {
              setCartError(`${i.name} is currently out of stock.`);
              return i;
            }

            return {
              ...i,
              quantity,
            };
          })
        );
      },

      removeFromCart: (id: string) => {
        setCartError('');
        setItems((prev) => prev.filter((i) => i.id !== id));
      },

      clearCart: () => {
        setCartError('');
        setItems([]);
      },

      clearCartError: () => {
        setCartError('');
      },
    }),
    [items, cartError]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);

  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }

  return ctx;
}
