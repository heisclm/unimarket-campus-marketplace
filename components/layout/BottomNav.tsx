'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, MessageSquare, User, Heart, PlusCircle } from 'lucide-react';
import { motion } from 'motion/react';

const navItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Market', href: '/products', icon: ShoppingBag },
  { name: 'Sell', href: '/products/new', icon: PlusCircle, primary: true },
  { name: 'Chat', href: '/dashboard/messages', icon: MessageSquare },
  { name: 'Profile', href: '/profile', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on admin routes
  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-6 py-3 z-50 flex items-center justify-between pb-safe">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        
        if (item.primary) {
          return (
            <Link key={item.name} href={item.href} className="relative -top-6">
              <div className="w-14 h-14 bg-black text-[#d9ff00] rounded-full flex items-center justify-center shadow-lg shadow-black/20 border-4 border-[#f4f4f0]">
                <item.icon className="w-7 h-7" />
              </div>
            </Link>
          );
        }

        return (
          <Link 
            key={item.name} 
            href={item.href}
            className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-black' : 'text-gray-400'}`}
          >
            <div className="relative">
              <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
              {isActive && (
                <motion.div 
                  layoutId="bottomNavDot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-black rounded-full"
                />
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
