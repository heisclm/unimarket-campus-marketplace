'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, MessageSquare, Users, PlusCircle, Heart } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

const navItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Market', href: '/products', icon: ShoppingBag },
  { name: 'Sell', href: '/products/new', icon: PlusCircle, primary: true },
  { name: 'Chat', href: '/dashboard/messages', icon: MessageSquare, badge: true },
  { name: 'Community', href: '/community', icon: Users },
];

export default function SideNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    let unsubscribeChats: () => void;
    if (!user) {
      setTimeout(() => setUnreadMessageCount(0), 0);
      return;
    }

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
      if (unsubscribeChats) unsubscribeChats();
    };
  }, [user]);

  // Hide on admin routes
  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="hidden md:flex lg:hidden fixed left-0 top-20 bottom-0 w-24 bg-white/80 backdrop-blur-lg border-r border-gray-100 z-40 flex-col items-center py-6 gap-8 overflow-y-auto">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        
        if (item.primary) {
          return (
            <Link key={item.name} href={item.href} className="relative mt-2 mb-2">
              <div className="w-14 h-14 bg-black text-[#d9ff00] rounded-2xl flex items-center justify-center shadow-lg shadow-black/20 hover:scale-105 transition-transform">
                <item.icon className="w-6 h-6" />
              </div>
              <span className="sr-only">{item.name}</span>
            </Link>
          );
        }

        return (
          <Link 
            key={item.name} 
            href={item.href}
            className={`flex flex-col items-center gap-1.5 transition-colors w-full ${isActive ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className={`relative p-3 rounded-2xl transition-colors ${isActive ? 'bg-gray-100' : ''}`}>
              <item.icon className="w-6 h-6" />
              {item.badge && unreadMessageCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter text-center">{item.name}</span>
          </Link>
        );
      })}
      
      {/* Wishlist moved to side nav on tablet to save top bar space */}
      <Link 
        href="/wishlist"
        className={`flex flex-col items-center gap-1.5 transition-colors w-full mt-auto ${pathname === '/wishlist' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <div className={`relative p-3 rounded-2xl transition-colors ${pathname === '/wishlist' ? 'bg-gray-100' : ''}`}>
          <Heart className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Wishlist</span>
      </Link>
    </nav>
  );
}
