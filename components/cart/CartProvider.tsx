'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CartItem {
  id: string;
  cartItemId?: string; // used for backend resolution if needed
  productId?: string;
  title: string;
  price: number;
  image: string;
  sellerId: string;
  quantity?: number;
  maxQuantity?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  total: 0,
});

export const useCart = () => useContext(CartContext);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('unimart_cart');
    let initialItems = [];
    if (saved) {
      try {
        initialItems = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
    setTimeout(() => {
      setItems(initialItems);
      setIsLoaded(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('unimart_cart', JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addToCart = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id 
            ? { ...i, quantity: Math.min(item.maxQuantity || i.maxQuantity || 999, (i.quantity || 1) + (item.quantity || 1)) }
            : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}
