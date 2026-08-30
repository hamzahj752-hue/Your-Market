'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Product } from '@/data/products';
import { supabase } from '@/lib/supabase';

interface WishlistContextValue {
  wishlist: Product[];
  isInWishlist: (id: string) => boolean;
  toggleWishlist: (product: Product) => void;
  clearWishlist: () => void;
  syncMessage: string;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);
const KEY = 'yourmarket-wishlist';
// Requires a separately-created table: wishlist_items(user_id, product_id, product, created_at)
const REMOTE_TABLE = 'wishlist_items';

function readLocalWishlist(): Product[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [remoteAvailable, setRemoteAvailable] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    setWishlist(readLocalWishlist());
    setReady(true);

    const loadRemote = async (id: string) => {
      const { data, error } = await supabase
        .from(REMOTE_TABLE)
        .select('product_id, product')
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      if (error) {
        setRemoteAvailable(false);
        setSyncMessage(
          'Wishlist sync is unavailable until the wishlist table and RLS policies are created.'
        );
        return;
      }
      const remoteProducts = (data || [])
        .map((row) => row.product as Product | null)
        .filter((product): product is Product => Boolean(product?.id));
      setWishlist(remoteProducts);
      setRemoteAvailable(true);
      setSyncMessage('Wishlist synced to your account.');
    };

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        await loadRemote(data.user.id);
      }
    };
    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const id = session?.user?.id || null;
      setUserId(id);
      if (id) await loadRemote(id);
      else {
        setRemoteAvailable(false);
        setWishlist(readLocalWishlist());
        setSyncMessage('');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready && !userId) localStorage.setItem(KEY, JSON.stringify(wishlist));
  }, [wishlist, ready, userId]);

  const value = useMemo(
    () => ({
      wishlist,
      isInWishlist: (id: string) => wishlist.some((p) => p.id === id),
      toggleWishlist: (product: Product) => {
        const exists = wishlist.some((p) => p.id === product.id);
        setWishlist((previous) =>
          exists ? previous.filter((p) => p.id !== product.id) : [...previous, product]
        );
        if (userId && remoteAvailable) {
          if (exists) {
            void supabase
              .from(REMOTE_TABLE)
              .delete()
              .eq('user_id', userId)
              .eq('product_id', product.id);
          } else {
            void supabase
              .from(REMOTE_TABLE)
              .insert({ user_id: userId, product_id: product.id, product });
          }
        }
      },
      clearWishlist: () => {
        setWishlist([]);
        if (userId && remoteAvailable)
          void supabase.from(REMOTE_TABLE).delete().eq('user_id', userId);
      },
      syncMessage,
    }),
    [wishlist, userId, remoteAvailable, syncMessage]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
