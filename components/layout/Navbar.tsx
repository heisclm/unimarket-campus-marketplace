'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, Heart, User, LogIn, Bell, Users, Menu, X, LayoutDashboard, ShieldAlert, Store } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCart } from '@/components/cart/CartProvider';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';

export default function Navbar() {
  const { user, loading, role } = useAuth();
  const { items } = useCart();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let unsubscribe: () => void;

    if (!user) {
      setTimeout(() => setUnreadCount(0), 0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      router.push(`/products?search=${encodeURIComponent(query)}`);
    } else {
      router.push('/products');
    }
    setSearchQuery('');
  };

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'User';

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-[#f4f4f0]/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">
            
            {/* Logo & Mobile Menu Toggle */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-lg font-bold text-xl">
                  U
                </div>
                <span className="font-bold text-xl tracking-tight hidden sm:block">UniMarket.</span>
              </Link>
            </div>

            {/* Search Bar (Pill Shaped) */}
            <form 
              onSubmit={handleSearch}
              className="flex-1 max-w-2xl hidden md:flex items-center bg-white rounded-full px-2 py-1.5 shadow-sm border border-gray-100"
            >
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, books, electronics..." 
                className="flex-1 bg-transparent border-none focus:outline-none px-4 text-sm text-gray-700 placeholder-gray-400"
              />
              <button 
                type="submit"
                className="bg-black text-white p-2.5 rounded-full hover:bg-gray-800 transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            {/* Mobile Search Trigger */}
            <div className="flex-1 md:hidden">
              <Link href="/products" className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border border-gray-100 text-gray-400 text-sm">
                <Search className="w-4 h-4" />
                <span>Search...</span>
              </Link>
            </div>

            {/* Desktop Center Links */}
            <div className="hidden lg:flex items-center gap-6">
              {role !== 'admin' && (
                <>
                  <Link href="/products" className="text-sm font-semibold text-gray-600 hover:text-black transition-colors">
                    Marketplace
                  </Link>
                  <Link href="/community" className="text-sm font-semibold text-gray-600 hover:text-black transition-colors flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Community
                  </Link>
                </>
              )}
              {role === 'admin' ? (
                <Link href="/admin" className="text-sm font-bold text-white bg-red-600 px-4 py-1.5 rounded-full hover:bg-red-700 transition-all flex items-center gap-1.5 shadow-sm shadow-red-200">
                  <ShieldAlert className="w-4 h-4" /> Admin Panel
                </Link>
              ) : (
                role === 'vendor' && (
                  <Link href="/vendor" className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1.5">
                    <Store className="w-4 h-4" /> Vendor Dashboard
                  </Link>
                )
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {user && (
                <>
                  {role === 'student' && (
                    <Link href="/dashboard" className="hidden lg:flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-black transition-colors mr-2">
                      <LayoutDashboard className="w-4 h-4" /> My Dashboard
                    </Link>
                  )}
                  {role !== 'admin' && (
                    <Link href="/notifications" className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow transition-shadow text-gray-700">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                      )}
                    </Link>
                  )}
                </>
              )}
              
              {role !== 'admin' && role !== 'vendor' && (
                <>
                  <Link href="/cart" className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow transition-shadow text-gray-700">
                    <ShoppingBag className="w-5 h-5" />
                    {items.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#d9ff00] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {items.length}
                      </span>
                    )}
                  </Link>
                  
                  <Link href="/wishlist" className="hidden sm:flex w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm hover:shadow transition-shadow text-red-500">
                    <Heart className="w-5 h-5" />
                  </Link>
                </>
              )}
              
              {!loading && (
                user ? (
                  <Link href="/profile" className="flex items-center justify-center gap-2 bg-white rounded-full p-1.5 sm:pl-4 sm:pr-1.5 shadow-sm hover:shadow transition-shadow ml-1 min-w-[44px] min-h-[44px]">
                    <span className="text-sm font-medium text-gray-700 capitalize hidden sm:block">{firstName}</span>
                    <div className="w-8 h-8 sm:w-8 sm:h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden relative">
                      {user.photoURL ? (
                        <Image src={user.photoURL} alt="Profile" fill className="object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </Link>
                ) : (
                  <Link href="/profile" className="flex items-center justify-center gap-2 bg-black text-white rounded-full px-3 py-2 sm:px-4 shadow-sm hover:bg-gray-800 transition-colors ml-1 min-w-[44px] min-h-[44px]">
                    <span className="text-sm font-medium hidden sm:block">Log In</span>
                    <LogIn className="w-5 h-5 sm:hidden" />
                  </Link>
                )
              )}
            </div>

          </div>
        </div>
      </nav>
    </>
  );
}
