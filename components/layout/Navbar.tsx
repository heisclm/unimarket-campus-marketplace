'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ShoppingBag, Heart, User, LogIn, Bell, Users, Menu, X, LayoutDashboard, ShieldAlert, Store, MessageSquare, Home, Navigation } from 'lucide-react';
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
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0); 
  const [unreadMessageCount, setUnreadMessageCount] = useState(0); 
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    const qNotifs = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    unsubscribeNotifs = onSnapshot(qNotifs, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

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

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      router.push(`/products?search=${encodeURIComponent(query)}`);
      setIsMobileMenuOpen(false);
    } else {
      router.push('/products');
      setIsMobileMenuOpen(false);
    }
    setSearchQuery('');
  };

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'User';

  return (
    <>
      <nav className="sticky top-0 z-40 w-full pt-[env(safe-area-inset-top)] bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20">
          <div className="flex items-center justify-between h-full gap-4">
            
            {/* Logo & Mobile Menu Toggle */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-black text-[#d9ff00] flex items-center justify-center rounded-xl font-black md:text-xl">
                  U
                </div>
                <span className="font-bold text-xl tracking-tight hidden sm:block text-black">UniMart.</span>
              </Link>
            </div>

            {/* Desktop Search Bar */}
            <form 
              onSubmit={handleSearch}
              className="flex-1 max-w-2xl hidden lg:flex items-center bg-gray-50 rounded-full px-2 py-1.5 border border-gray-200 focus-within:bg-white focus-within:border-black focus-within:ring-1 focus-within:ring-black transition-all"
            >
              <Search className="w-4 h-4 ml-3 text-gray-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, books, electronics..." 
                className="flex-1 bg-transparent border-none focus:outline-none px-3 text-sm text-gray-900 placeholder-gray-400"
              />
              <button 
                type="submit"
                className="bg-black text-white px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Search
              </button>
            </form>

            {/* Desktop Center Links */}
            <div className="hidden lg:flex items-center gap-6">
              {role !== 'admin' && (
                <>
                  <Link href="/products" className="text-sm font-semibold text-gray-500 hover:text-black transition-colors">
                    Marketplace
                  </Link>
                  <Link href="/deliveries" className="text-sm font-semibold text-gray-500 hover:text-black transition-colors">
                    Deliveries
                  </Link>
                  <Link href="/community" className="text-sm font-semibold text-gray-500 hover:text-black transition-colors flex items-center gap-1.5">
                    Community
                  </Link>
                </>
              )}
              {role === 'admin' && (
                <Link href="/admin" className="text-sm font-bold text-red-600 flex items-center gap-2 bg-red-50 hover:bg-red-100 px-3.5 py-1.5 rounded-full transition-colors">
                  <ShieldAlert className="w-4 h-4" />
                  Admin Panel
                </Link>
              )}
              {role === 'vendor' && (
                <Link href="/dashboard" className="text-sm font-bold text-orange-600 flex items-center gap-2 bg-orange-50 hover:bg-orange-100 px-3.5 py-1.5 rounded-full transition-colors">
                  <Store className="w-4 h-4" />
                  Vendor Dashboard
                </Link>
              )}
              {role === 'student' && (
                <Link href="/dashboard" className="text-sm font-bold text-blue-600 flex items-center gap-2 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-full transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  Student Dashboard
                </Link>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              
              {/* Mobile Search Icon Trigger */}
              <button 
                className="lg:hidden p-2 text-gray-600 hover:text-black"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Search className="w-5 h-5" />
              </button>

              {role !== 'admin' && (
                <>
                  {/* Messages */}
                  {(role === 'vendor' || role === 'student') && (
                    <Link href="/dashboard/messages" className="hidden lg:flex relative p-2 text-gray-600 hover:text-black transition-colors">
                      <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />
                    </Link>
                  )}
                  
                  {/* Cart */}
                  {role !== 'vendor' && (
                    <Link href="/cart" className="relative p-2 text-gray-600 hover:text-black transition-colors">
                      <ShoppingBag className="w-5 h-5 md:w-6 md:h-6" />
                      {items.length > 0 && (
                        <span className="absolute top-1 right-0 bg-[#d9ff00] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {items.length}
                        </span>
                      )}
                    </Link>
                  )}
                  
                  {/* Notifications */}
                  {user && (
                    <Link href="/notifications" className="relative p-2 text-gray-600 hover:text-black transition-colors">
                      <Bell className="w-5 h-5 md:w-6 md:h-6" />
                      {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                      )}
                    </Link>
                  )}
                </>
              )}
              
              {/* Profile */}
              <div className="flex items-center">
                {!loading && (
                  user ? (
                    <Link href="/profile" className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors rounded-full p-0.5 min-w-[36px] min-h-[36px] md:min-w-[40px] md:min-h-[40px]">
                      <div className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-full flex items-center justify-center overflow-hidden relative">
                        {user.photoURL ? (
                          <Image src={user.photoURL} alt="Profile" fill className="object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                    </Link>
                  ) : (
                    <Link href="/profile" className="flex items-center justify-center gap-2 bg-black text-white rounded-full px-4 py-2 text-sm font-semibold hover:bg-gray-800 transition-colors">
                      <span className="hidden sm:inline">Log In</span>
                      <LogIn className="w-4 h-4 sm:hidden" />
                    </Link>
                  )
                )}
              </div>
            </div>

          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-white z-50 lg:hidden overflow-y-auto flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10">
                <Link href="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                  <div className="w-8 h-8 bg-black text-[#d9ff00] flex items-center justify-center rounded-lg font-bold text-xl">U</div>
                  <span className="font-bold text-lg tracking-tight text-black">UniMart.</span>
                </Link>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 bg-gray-50 text-gray-500 hover:text-black rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-6">
                {/* Mobile Search */}
                <form onSubmit={handleSearch} className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search UniMart..." 
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
                    />
                  </div>
                </form>

                <div className="flex flex-col gap-1">
                  <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                    <Home className="w-5 h-5 text-gray-400" />
                    Home
                  </Link>
                  
                  {role !== 'admin' && (
                    <>
                      <Link href="/products" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                        <Store className="w-5 h-5 text-gray-400" />
                        Marketplace
                      </Link>
                      <Link href="/deliveries" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                        <Navigation className="w-5 h-5 text-gray-400" />
                        Deliveries
                      </Link>
                      <Link href="/community" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                        <Users className="w-5 h-5 text-gray-400" />
                        Community
                      </Link>
                      <Link href="/wishlist" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                        <Heart className="w-5 h-5 text-gray-400" />
                        Wishlist
                      </Link>
                      
                      {user && (
                        <Link href="/dashboard/messages" className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-gray-400" />
                            Messages
                          </div>
                          {unreadMessageCount > 0 && (
                            <span className="bg-[#d9ff00] text-black text-xs font-bold px-2 py-0.5 rounded-full">
                              {unreadMessageCount}
                            </span>
                          )}
                        </Link>
                      )}
                    </>
                  )}
                  
                  {role === 'admin' && (
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl bg-red-50 text-red-600 font-bold transition-colors">
                      <ShieldAlert className="w-5 h-5" />
                      Admin Panel
                    </Link>
                  )}
                  {role === 'vendor' && (
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl bg-orange-50 text-orange-600 font-bold transition-colors">
                      <Store className="w-5 h-5" />
                      Vendor Dashboard
                    </Link>
                  )}
                  {role === 'student' && user && (
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl bg-gray-50 text-gray-900 font-bold transition-colors">
                      <LayoutDashboard className="w-5 h-5" />
                      My Dashboard
                    </Link>
                  )}
                </div>
              </div>

              {!user && !loading && (
                <div className="p-4 border-t border-gray-100">
                   <div className="px-2">
                     <Link href="/profile" className="flex items-center justify-center gap-2 bg-black text-white w-full rounded-xl py-3.5 font-bold hover:bg-gray-800 transition-colors">
                       <LogIn className="w-5 h-5" />
                       Sign In / Register
                     </Link>
                   </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
