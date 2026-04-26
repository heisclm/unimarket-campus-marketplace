'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PremiumImage from '@/components/ui/PremiumImage';
import { Tag, Clock, ShieldCheck, Heart, ShoppingBag, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCart } from '@/components/cart/CartProvider';
import toast from 'react-hot-toast';

export default function ProductCard({ product }: { product: any }) {
  const { userData } = useAuth();
  const { addToCart, items } = useCart();
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const favorites = JSON.parse(localStorage.getItem('unimart_favorites') || '[]');
    if (favorites.some((item: any) => item.id === product.id)) {
      setTimeout(() => setIsFavorite(true), 0);
    }

    const handleWishlistUpdate = () => {
      const updatedFavorites = JSON.parse(localStorage.getItem('unimart_favorites') || '[]');
      setIsFavorite(updatedFavorites.some((item: any) => item.id === product.id));
    };

    window.addEventListener('wishlist_updated', handleWishlistUpdate);
    return () => window.removeEventListener('wishlist_updated', handleWishlistUpdate);
  }, [product.id]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const favorites = JSON.parse(localStorage.getItem('unimart_favorites') || '[]');
    if (isFavorite) {
      const newFavorites = favorites.filter((item: any) => item.id !== product.id);
      localStorage.setItem('unimart_favorites', JSON.stringify(newFavorites));
      setIsFavorite(false);
      toast.success('Removed from wishlist');
    } else {
      favorites.push({ 
        id: product.id, 
        title: product.title, 
        price: product.price, 
        previewImage: product.previewImage || product.images?.[0] || '',
        sellerId: product.sellerId,
        savedAt: Date.now() 
      });
      localStorage.setItem('unimart_favorites', JSON.stringify(favorites));
      setIsFavorite(true);
      toast.success('Added to wishlist');
    }
    window.dispatchEvent(new Event('wishlist_updated'));
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (userData?.role === 'vendor') {
      toast.error('Vendors cannot purchase items');
      return;
    }

    // Only students can add to cart, and items with active status, and not their own
    if (product.status !== 'active') return;
    if (product.type === 'auction') {
      toast.error('Auction items cannot be added to cart directly.');
      return;
    }
    if (userData?.uid === product.sellerId) {
      toast.error('You cannot buy your own item.');
      return;
    }

    if (items.some(i => i.id === product.id)) {
      toast.error('Item is already in your cart');
      return;
    }

    const itemToAdd = {
      id: product.id,
      productId: product.id,
      title: product.title,
      price: Number(product.price),
      image: product.previewImage || product.images?.[0] || '',
      sellerId: product.sellerId
    };
    addToCart(itemToAdd as any);
  };

  const isInCart = items.some(i => i.id === product.id);
  const isVendor = userData?.role === 'vendor';
  const isAuction = product.type === 'auction';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className="h-full"
    >
      <Link href={`/products/${product.id}`} className={`bg-white rounded-[1.5rem] md:rounded-[2rem] p-4 group hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col h-full relative border ${product.isSponsored ? 'shadow-[0_0_20px_rgba(245,158,11,0.2)] border-orange-400' : 'border-gray-100/60 shadow-sm'}`}>
        
        {/* Quick Actions overlay */}
        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
          <button 
            onClick={handleToggleFavorite}
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 ${isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 backdrop-blur-md text-gray-500 hover:text-red-500'}`}
          >
            <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          
          {!isVendor && !isAuction && product.status === 'active' && (
            <button 
              onClick={handleAddToCart}
              disabled={isInCart}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${isInCart ? 'bg-[#c4e600] text-black cursor-not-allowed' : 'bg-white/90 backdrop-blur-md text-gray-700 hover:bg-black hover:text-[#d9ff00] hover:scale-110'}`}
            >
              <ShoppingBag className={`w-4 h-4 sm:w-5 sm:h-5 ${isInCart ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        <div className="relative w-full aspect-square bg-gray-50 rounded-[1.2rem] md:rounded-[1.5rem] mb-4 sm:mb-5 overflow-hidden">
          <PremiumImage 
            src={product.previewImage || product.images?.[0] || ""} 
            alt={product.title} 
            fill 
            className="object-cover group-hover:scale-105 transition-transform duration-700" 
            referrerPolicy="no-referrer"
            containerClassName="absolute inset-0 z-0"
          />
          
          {/* Badges */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1.5 sm:gap-2 z-10 pointer-events-none">
            {product.isSponsored && (
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg flex items-center gap-1 shadow-md border border-orange-400">
                <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" /> Sponsored
              </span>
            )}
            {product.type === 'auction' && (
              <span className="bg-red-500/90 backdrop-blur-sm text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg flex items-center gap-1 shadow-md border border-red-400/50">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                LIVE AUCTION
              </span>
            )}
            {product.sellerIsVerified && (
              <span className="bg-green-500 text-white text-[10px] sm:text-[10px] font-bold px-2 py-1 sm:px-2 sm:py-1.5 rounded-lg flex items-center gap-1 shadow-md">
                <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> <span className="hidden sm:inline">Verified Seller</span><span className="sm:hidden">Verified</span>
              </span>
            )}
            <span className="bg-white/90 backdrop-blur-md text-gray-900 text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-sm line-clamp-1 max-w-[100px] border border-white/20">
              {product.category}
            </span>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col px-1 relative z-10">
          <h3 className="font-bold text-base sm:text-xl text-gray-900 line-clamp-1 sm:line-clamp-2 mb-1 sm:mb-3 leading-tight">{product.title}</h3>
          
          <div className="flex items-end justify-between mt-auto pt-3 sm:pt-4 sm:border-t border-gray-50">
            <div className="flex items-center gap-1 sm:gap-1.5 text-lg sm:text-2xl font-black tracking-tighter text-gray-900">
              <span className="text-sm font-bold text-gray-400 tracking-normal mb-1">GH₵</span>
              {Number(product.price).toFixed(2)}
            </div>
            {product.status !== 'active' && (
              <span className="hidden sm:block text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md uppercase tracking-widest">
                {product.status}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
