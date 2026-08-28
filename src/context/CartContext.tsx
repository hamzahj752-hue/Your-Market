'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  quantity: number;
  variant?: string;
  rating: number;
  discount?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: {children: React.ReactNode;}) {
  const [items, setItems] = useState<CartItem[]>([
  {
    id: 'p1',
    name: 'Sony WH-1000XM5 Wireless Headphones',
    price: 279.99,
    originalPrice: 349.99,
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f2ff3d53-1764671534694.png",
    category: 'Electronics',
    quantity: 1,
    variant: 'Midnight Black',
    rating: 4.8,
    discount: 20
  },
  {
    id: 'p3',
    name: 'Nike Air Max 270 Running Shoes',
    price: 109.95,
    originalPrice: 149.95,
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_125e00aff-1778821835959.png",
    category: 'Fashion',
    quantity: 2,
    variant: 'Size 10 / White',
    rating: 4.6,
    discount: 27
  }]
  );

  const addToCart = useCallback((product: Omit<CartItem, 'quantity'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity } : i));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>);

}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}