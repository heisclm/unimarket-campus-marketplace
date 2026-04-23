'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PremiumImage from '@/components/ui/PremiumImage';
import { Heart, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WishlistPage() {
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    const loadFavorites = () => {
      const stored = JSON.parse(localStorage.getItem('unimart_favorites') || '[]');
      setFavorites(stored);
    };

    loadFavorites();
    window.addEventListener('wishlist_updated', loadFavorites);
    return () => window.removeEventListener('wishlist_updated', loadFavorites);
  }, []);

  const removeFavorite = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const newFavorites = favorites.filter((item: any) => item.id !== id);
    localStorage.setItem('unimart_favorites', JSON.stringify(newFavorites));
    setFavorites(newFavorites);
    toast.success('Removed from wishlist');
    window.dispatchEvent(new Event('wishlist_updated'));
  };

  if (favorites.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
          <Heart className="w-10 h-10" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Your Wishlist is Empty</h1>
          <p className="text-gray-500 max-w-md mx-auto mb-8">You haven't saved any items yet. Start exploring the marketplace and save items you love!</p>
          <Link href="/products" className="bg-black text-white px-8 py-3 rounded-full font-bold inline-flex items-center gap-2 hover:bg-gray-800 transition-colors">
            Explore Marketplace <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm min-h-[60vh]">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100">
        <div className="bg-red-50 p-3 rounded-full text-red-500">
          <Heart className="w-6 h-6 fill-current" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">My Wishlist</h1>
          <p className="text-gray-500">{favorites.length} saved {favorites.length === 1 ? 'item' : 'items'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {favorites.map((item) => (
          <Link 
            key={item.id}
            href={`/products/${item.id}`}
            className="group block relative border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-square bg-gray-50 pb-[100%]">
              <PremiumImage 
                src={item.previewImage}
                alt={item.title}
                fallbackSrc="https://picsum.photos/seed/product/400/400"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={(e) => removeFavorite(e, item.id)}
                className="absolute top-3 right-3 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm shadow-sm rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label="Remove from wishlist"
              >
                <Heart className="w-4 h-4 fill-current" />
              </button>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 line-clamp-1 mb-1 group-hover:text-black">{item.title}</h3>
              <p className="font-bold text-black text-lg">GH₵{Number(item.price).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
