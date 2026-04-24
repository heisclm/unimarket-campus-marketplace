'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PremiumImage from '@/components/ui/PremiumImage';
import { Tag, Clock, ShieldCheck, Heart, ShoppingBag } from 'lucide-react';
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

    addToCart({
      id: product.id,
      title: product.title,
      price: Number(product.price),
      quantity: 1,
      image: product.previewImage || product.images?.[0] || '',
      sellerId: product.sellerId,
      type: product.type || 'fixed'
    });
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
      <Link href={`/products/${product.id}`} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm group hover:shadow-md transition-all flex flex-col h-full relative">
        
        {/* Quick Actions overlay */}
        <div className="absolute top-2 sm:top-5 right-2 sm:right-5 z-20 flex flex-col gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
          <button 
            onClick={handleToggleFavorite}
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 ${isFavorite ? 'bg-red-50 text-red-500' : 'bg-white/90 backdrop-blur-sm text-gray-500 hover:text-red-500'}`}
          >
            <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          
          {!isVendor && !isAuction && product.status === 'active' && (
            <button 
              onClick={handleAddToCart}
              disabled={isInCart}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-md transition-transform  ${isInCart ? 'bg-[#c4e600] text-black cursor-not-allowed' : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-[#d9ff00] hover:text-black hover:scale-110'}`}
            >
              <ShoppingBag className={`w-4 h-4 sm:w-5 sm:h-5 ${isInCart ? 'fill-current opacity-70' : ''}`} />
            </button>
          )}
        </div>

        <div className="relative w-full aspect-square bg-gray-100 rounded-lg sm:rounded-xl mb-3 sm:mb-4 overflow-hidden">
          <PremiumImage 
            src={product.previewImage || product.images?.[0] || ""} 
            alt={product.title} 
            fill 
            className="object-cover group-hover:scale-105 transition-transform duration-500" 
            referrerPolicy="no-referrer"
            containerClassName="absolute inset-0 z-0"
          />
          
          {/* Badges */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-col gap-1 sm:gap-2 z-10 pointer-events-none">
            {product.type === 'auction' && (
              <span className="bg-orange-500 text-white text-[9px] sm:text-xs font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded sm:rounded-md flex items-center gap-1 shadow-sm">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Auction
              </span>
            )}
            {product.sellerIsVerified && (
              <span className="bg-green-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded sm:rounded-md flex items-center gap-1 shadow-sm">
                <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> <span className="hidden sm:inline">Verified Seller</span><span className="sm:hidden">Verified</span>
              </span>
            )}
            <span className="bg-white/90 backdrop-blur-sm text-gray-700 text-[9px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 sm:py-1 rounded sm:rounded-md shadow-sm line-clamp-1 max-w-[80px]">
              {product.category}
            </span>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col px-1 sm:px-0 relative z-10">
          <h3 className="font-bold text-sm sm:text-lg line-clamp-1 sm:line-clamp-2 mb-0.5 sm:mb-2 group-hover:text-blue-600 transition-colors leading-tight">{product.title}</h3>
          
          <div className="flex items-center justify-between mt-auto pt-2 sm:pt-4 sm:border-t border-gray-100">
            <div className="flex items-center gap-0.5 sm:gap-1 text-sm sm:text-lg font-black tracking-tight text-gray-900">
              <Tag className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
              GH₵{Number(product.price).toFixed(2)}
            </div>
            {product.status !== 'active' && (
              <span className="hidden sm:block text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md capitalize">
                {product.status}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
