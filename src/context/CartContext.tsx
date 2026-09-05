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
  stockQuantity?: number;
  inStock?: boolean;
  variantId?: string;
  variantSize?: string;
  variantColor?: string;
  variantImage?: string;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  cartError: string;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  removeFromCart: (itemKey: string) => void;
  clearCart: () => void;
  clearCartError: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const KEY = 'yourmarket-cart';

// Composite cart key: product_id + variant_id (or 'default' for non-variant items)
export function cartKey(item: { id: string; variantId?: string }): string {
  return `${item.id}:${item.variantId || 'default'}`;
}

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
          variant_id: i.variantId || null,
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
        .select('product_id, quantity, variant_id')
        .eq('user_id', userId);

      if (cancelled || error) return;

      // No saved remote cart: keep the local (guest) cart and push it up to
      // this account so it isn't lost on the first login.
      if (!data || data.length === 0) {
        const local = itemsRef.current;
        if (local.length > 0) await persistCart(userId, local);
        return;
      }

      const ids = [...new Set(data.map((r) => r.product_id))];
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('*')
        .in('id', ids);

      if (cancelled || pErr || !products) return;

      // Load variant data if any cart items have variant_ids
      const variantIds = data.map((r) => r.variant_id).filter((v): v is string => !!v);
      const variants: Record<string, Record<string, unknown>> = {};
      if (variantIds.length > 0) {
        const { data: variantRows } = await supabase
          .from('product_variants')
          .select('*')
          .in('id', variantIds);
        if (variantRows) {
          for (const v of variantRows) {
            variants[v.id] = v;
          }
        }
      }

      const remoteItems: CartItem[] = data
        .map((row) => {
          const p = products.find((pr) => pr.id === row.product_id);
          if (!p) return null;
          const v = row.variant_id ? variants[row.variant_id] : null;
          return {
            id: p.id,
            name: p.name,
            price: v ? Number(v.price ?? p.price) : Number(p.price),
            originalPrice: v
              ? v.original_price != null
                ? Number(v.original_price)
                : p.original_price != null
                  ? Number(p.original_price)
                  : undefined
              : p.original_price != null
                ? Number(p.original_price)
                : undefined,
            image: v && v.image_url ? (v.image_url as string) : p.image,
            category: p.category,
            rating: Number(p.rating),
            discount: p.discount != null ? Number(p.discount) : undefined,
            variant: p.variant ?? undefined,
            quantity: Number(row.quantity),
            stockQuantity: v ? Number(v.stock_quantity) : Number(p.stock_quantity),
            inStock: v ? Number(v.stock_quantity) > 0 : Boolean(p.in_stock),
            variantId: row.variant_id || undefined,
            variantSize: v ? (v.size as string) : undefined,
            variantColor: v ? (v.color_name as string) : undefined,
            variantImage: v && v.image_url ? (v.image_url as string) : undefined,
          } as CartItem;
        })
        .filter((i): i is CartItem => i !== null);

      if (cancelled) return;

      const local = itemsRef.current;
      const merged =
        local.length === 0
          ? remoteItems
          : (() => {
              const result = [...remoteItems];
              local.forEach((item) => {
                const key = cartKey(item);
                const existing = result.find((m) => cartKey(m) === key);
                if (!existing) result.push(item);
                else if (existing.quantity < item.quantity) existing.quantity = item.quantity;
              });
              return result;
            })();

      setItems(merged);
    };

    const applyUserId = async (id: string | null) => {
      const previousUserId = userIdRef.current;
      userIdRef.current = id;

      if (!id) {
        // Only drop the cart on an actual logout transition (signed-in -> null).
        // A fresh guest load also fires INITIAL_SESSION with null and must keep
        // the local (guest) cart untouched.
        if (previousUserId) {
          hydratedRef.current = false;
          setItems([]);
        }
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

        if (item.inStock === false || (item.stockQuantity != null && item.stockQuantity <= 0)) {
          setCartError(`${item.name} is currently out of stock.`);
          return;
        }

        setItems((prev) => {
          const key = cartKey(item);
          const found = prev.find((i) => cartKey(i) === key);

          if (found) {
            const maxStock = item.stockQuantity != null ? item.stockQuantity : Infinity;
            if (found.quantity + 1 > maxStock) {
              setCartError(`Only ${maxStock} of ${item.name} available.`);
              return prev;
            }
            return prev.map((i) =>
              cartKey(i) === key ? { ...i, ...item, quantity: i.quantity + 1 } : i
            );
          }
          return [...prev, { ...item, quantity: 1 }];
        });
      },

      updateQuantity: (itemKey: string, quantity: number) => {
        setCartError('');

        if (quantity <= 0) {
          setItems((prev) => prev.filter((i) => cartKey(i) !== itemKey));
          return;
        }

        setItems((prev) =>
          prev.map((i) => {
            if (cartKey(i) !== itemKey) return i;

            if (i.inStock === false || (i.stockQuantity != null && i.stockQuantity <= 0)) {
              setCartError(`${i.name} is currently out of stock.`);
              return i;
            }

            let nextQty = quantity;
            if (i.stockQuantity != null && nextQty > i.stockQuantity) {
              nextQty = i.stockQuantity;
              setCartError(`Only ${i.stockQuantity} of ${i.name} available.`);
            }

            return {
              ...i,
              quantity: nextQty,
            };
          })
        );
      },

      removeFromCart: (itemKey: string) => {
        setCartError('');
        setItems((prev) => prev.filter((i) => cartKey(i) !== itemKey));
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
