'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, Heart, User, LogIn, Bell, Users, Menu, X, LayoutDashboard, ShieldAlert, Store, MessageSquare } from 'lucide-react';
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
  const [unreadCount, setUnreadCount] = useState(0); // For general notifications
  const [unreadMessageCount, setUnreadMessageCount] = useState(0); // For chat messages
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let unsubscribeNotifs: () => void;
    let unsubscribeChats: () => void;

    if (!user || !db) {
      setTimeout(() => {
        setUnreadCount(0);
        setUnreadMessageCount(0);
      }, 0);
      return;
    }

    // 1. Listen for General Notifications
    const qNotifs = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    unsubscribeNotifs = onSnapshot(qNotifs, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    // 2. Listen for Unread Messages in Chats
    const qChats = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    unsubscribeChats = onSnapshot(qChats, (snapshot) => {
      let totalUnreadMessages = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.unreadCount && typeof data.unreadCount[user.uid] === 'number') {
          totalUnreadMessages += data.unreadCount[user.uid];
        }
      });
      setUnreadMessageCount(totalUnreadMessages);
    });

    return () => {
      if (unsubscribeNotifs) unsubscribeNotifs();
      if (unsubscribeChats) unsubscribeChats();
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
      <nav className="sticky top-0 z-50 w-full h-20 bg-[#f4f4f0]/90 backdrop-blur-lg border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full gap-4">
            
            {/* Logo & Mobile Menu Toggle */}
            <div className="flex items-center gap-3">
              {/* Desktop Logo */}
              <Link href="/" className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded-lg font-bold text-xl">
                  U
                </div>
                <span className="font-bold text-xl tracking-tight hidden lg:block">UniMart.</span>
              </Link>

              {/* Mobile Profile (Replaces Logo) */}
              <div className="sm:hidden flex items-center">
                {!loading && (
                  user ? (
                    <Link href="/profile" className="flex items-center justify-center bg-white rounded-full p-0.5 shadow-sm border border-gray-200 min-w-[40px] min-h-[40px]">
                      <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden relative">
                        {user.photoURL ? (
                          <Image src={user.photoURL} alt="Profile" fill className="object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </Link>
                  ) : (
                    <Link href="/profile" className="flex items-center justify-center bg-black text-white rounded-full w-10 h-10 shadow-sm">
                      <LogIn className="w-5 h-5" />
                    </Link>
                  )
                )}
              </div>
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
                  {/* PWA Install Trigger button, to give explicit intent */}
                  <button 
                    onClick={() => {
                      // We dispatch a custom event that our PWAInstallPrompt will listen to
                      window.dispatchEvent(new CustomEvent('show-install-prompt'));
                    }}
                    className="text-sm font-bold text-gray-600 hover:text-black transition-colors flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full"
                  >
                    Install App
                  </button>
                </>
              )}
              {role === 'admin' ? (
                <Link href="/admin" className="text-sm font-bold text-white bg-red-600 px-4 py-1.5 rounded-full hover:bg-red-700 transition-all flex items-center gap-1.5 shadow-sm shadow-red-200">
                  <ShieldAlert className="w-4 h-4" /> Admin Panel
                </Link>
              ) : (
                role === 'vendor' && (
                  <Link href="/dashboard" className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1.5">
                    <Store className="w-4 h-4" /> Vendor Dashboard
                  </Link>
                )
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {user && role === 'student' && (
                <Link href="/dashboard" className="hidden lg:flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-black transition-colors mr-2">
                  <LayoutDashboard className="w-4 h-4" /> My Dashboard
                </Link>
              )}

              {role !== 'admin' && (
                <>
                  {user && (
                    <Link href="/dashboard/messages" className="hidden lg:flex relative w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm hover:shadow transition-shadow text-gray-700">
                      <MessageSquare className="w-5 h-5" />
                      {unreadMessageCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                          {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                        </span>
                      )}
                    </Link>
                  )}

                  {/* Wishlist/Favourite (Visible on mobile, first in sequence) */}
                  {role !== 'vendor' && (
                    <Link href="/wishlist" className="flex w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm hover:shadow transition-shadow text-red-500">
                      <Heart className="w-5 h-5" />
                    </Link>
                  )}

                  {/* Cart (Visible on mobile, second in sequence) */}
                  {role !== 'vendor' && (
                    <Link href="/cart" className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow transition-shadow text-gray-700">
                      <ShoppingBag className="w-5 h-5" />
                      {items.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-[#d9ff00] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {items.length}
                        </span>
                      )}
                    </Link>
                  )}

                  {/* Notifications (Visible on mobile, third in sequence) */}
                  {user && (
                    <Link href="/notifications" className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow transition-shadow text-gray-700">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                      )}
                    </Link>
                  )}
                </>
              )}
              
              {/* Profile (Desktop Only - Mobile version is on the left) */}
              <div className="hidden sm:block">
                {!loading && (
                  user ? (
                    <Link href="/profile" className="flex items-center justify-center gap-2 bg-white rounded-full p-1.5 pl-4 pr-1.5 shadow-sm hover:shadow transition-shadow ml-1 min-w-[44px] min-h-[44px]">
                      <span className="text-sm font-medium text-gray-700 capitalize">{firstName}</span>
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden relative">
                        {user.photoURL ? (
                          <Image src={user.photoURL} alt="Profile" fill className="object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </Link>
                  ) : (
                    <Link href="/profile" className="flex items-center justify-center gap-2 bg-black text-white rounded-full px-4 py-2 shadow-sm hover:bg-gray-800 transition-colors ml-1 min-w-[44px] min-h-[44px]">
                      <span className="text-sm font-medium">Log In</span>
                    </Link>
                  )
                )}
              </div>
            </div>

          </div>
        </div>
      </nav>
    </>
  );
}
