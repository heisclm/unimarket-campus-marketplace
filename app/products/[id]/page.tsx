'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import PremiumImage from '@/components/ui/PremiumImage';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCart } from '@/components/cart/CartProvider';
import BiddingSection from '@/components/products/BiddingSection';
import ReportModal from '@/components/shared/ReportModal';
import { ShoppingBag, Gavel, ArrowLeft, Clock, ShieldCheck, User as UserIcon, AlertTriangle, Heart, Star } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, userData } = useAuth();
  const { addToCart, items } = useCart();
  
  const [product, setProduct] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [sellerRating, setSellerRating] = useState<{average: number, count: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  useEffect(() => {
    if (!id) return;
    const favorites = JSON.parse(localStorage.getItem('unimart_favorites') || '[]');
    if (favorites.some((item: any) => item.id === id)) {
      setIsFavorite(true);
    }
  }, [id]);

  const toggleFavorite = () => {
    if (!product) return;
    const favorites = JSON.parse(localStorage.getItem('unimart_favorites') || '[]');
    if (isFavorite) {
      const newFavorites = favorites.filter((item: any) => item.id !== product.id);
      localStorage.setItem('unimart_favorites', JSON.stringify(newFavorites));
      setIsFavorite(false);
      toast.success('Removed from wishlist');
      // Trigger a custom event so the Navbar or other components could potentially listen
      window.dispatchEvent(new Event('wishlist_updated'));
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
      window.dispatchEvent(new Event('wishlist_updated'));
    }
  };

  useEffect(() => {
    const fetchProductAndSeller = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const productData = { id: docSnap.id, ...docSnap.data() } as any;
          setProduct(productData);
          
          if (productData.previewImage && productData.images) {
            const previewIdx = productData.images.indexOf(productData.previewImage);
            if (previewIdx !== -1) {
              setActiveImageIndex(previewIdx);
            }
          }
          
          // Fetch seller info
          if (productData.sellerId) {
            const sellerRef = doc(db, 'users', productData.sellerId);
            const sellerSnap = await getDoc(sellerRef);
            if (sellerSnap.exists()) {
              setSeller(sellerSnap.data());
            }

            // Fetch seller ratings
            try {
              const reviewsQuery = query(collection(db, 'reviews'), where('sellerId', '==', productData.sellerId));
              const reviewsSnap = await getDocs(reviewsQuery);
              if (!reviewsSnap.empty) {
                let totalRating = 0;
                reviewsSnap.forEach(r => totalRating += r.data().rating || 5);
                const avgRating = totalRating / reviewsSnap.size;
                setSellerRating({ average: avgRating, count: reviewsSnap.size });
              }
            } catch (err) {
              console.error("Error fetching ratings:", err);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProductAndSeller();
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
          <p className="text-gray-400">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold mb-2">Product Not Found</h1>
        <p className="text-gray-500 mb-6">The product you are looking for does not exist or has been removed.</p>
        <button onClick={() => router.push('/products')} className="bg-black text-white px-6 py-2 rounded-full font-medium">Back to Marketplace</button>
      </div>
    );
  }

  const isOwner = user?.uid === product.sellerId;

  const handleAddToCart = () => {
    let price = Number(product.price);
    let variantDetails = '';
    
    if (product.hasVariations && product.variants?.length > 0) {
      const selectedVariant = product.variants[selectedVariantIndex];
      if (selectedVariant.price !== null && selectedVariant.price !== undefined) {
        price = selectedVariant.price;
      }
      variantDetails = ` - ${selectedVariant.name || [selectedVariant.size, selectedVariant.color].filter(Boolean).join(', ')}`.trim();
    }

    addToCart({
      id: product.hasVariations ? `${product.id}-${selectedVariantIndex}` : product.id,
      productId: product.id,
      title: product.title + (variantDetails ? ` ${variantDetails}` : ''),
      price: price,
      image: product.previewImage || product.images?.[0] || '',
      sellerId: product.sellerId
    });
    toast.success('Added to your cart!');
  };

  const currentPrice = product.hasVariations && product.variants?.[selectedVariantIndex]?.price != null 
    ? Number(product.variants[selectedVariantIndex].price) 
    : Number(product.price);

  return (
    <div className="max-w-6xl mx-auto">
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-500 hover:text-black mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-[2rem] p-6 md:p-10 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* Left: Image Gallery */}
        <div className="space-y-4">
          <div className="relative w-full aspect-square bg-gray-100 rounded-3xl overflow-hidden">
            <PremiumImage 
              src={product.images?.[activeImageIndex] || product.previewImage || product.images?.[0] || ""} 
              alt={product.title} 
              fill 
              className="object-cover"
              referrerPolicy="no-referrer"
              containerClassName="absolute inset-0"
            />
            
            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.type === 'auction' && (
                <span className="bg-orange-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md">
                  <Clock className="w-4 h-4" /> Live Auction
                </span>
              )}
            </div>
          </div>
          
          {/* Thumbnails */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-black' : 'border-transparent hover:border-gray-300'}`}
                >
                  <PremiumImage src={img} alt={`Thumbnail ${idx}`} fill className="object-cover" referrerPolicy="no-referrer" containerClassName="absolute inset-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Info */}
        <div className="flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider">
                {product.category}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {product.status}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{product.title}</h1>
            <div className="text-4xl font-bold text-black mb-6">
              GH₵{currentPrice.toFixed(2)}
            </div>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap mb-6">
              {product.description}
            </p>

            {/* Variations */}
            {product.hasVariations && product.variants?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Select Options</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {product.variants.map((v: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedVariantIndex(idx)}
                      disabled={v.quantity <= 0}
                      className={`relative flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                        selectedVariantIndex === idx 
                          ? 'border-black bg-gray-50' 
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      } ${v.quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {v.name && <span className="font-bold text-gray-900">{v.name}</span>}
                      {!v.name && v.size && <span className="font-bold text-gray-900">{v.size}</span>}
                      {!v.name && v.color && <span className="text-sm text-gray-500">{v.color}</span>}
                      {v.quantity <= 0 && <span className="text-xs text-red-500 font-bold mt-1">Out of Stock</span>}
                      {v.price != null && (
                         <span className="text-xs font-bold text-black mt-1">GH₵{v.price.toFixed(2)}</span>
                      )}
                      
                      {selectedVariantIndex === idx && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#d9ff00]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Seller Info */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-8 flex items-center gap-4 border border-gray-100">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden relative shadow-sm">
              {seller?.photoURL ? (
                <PremiumImage src={seller.photoURL} alt={seller.displayName || 'Seller'} fill className="object-cover" referrerPolicy="no-referrer" containerClassName="absolute inset-0" />
              ) : (
                <UserIcon className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Listed By</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <p className="font-semibold text-gray-900">{seller?.displayName || 'Anonymous User'}</p>
                {sellerRating && (
                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full w-fit border border-yellow-100">
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="text-xs font-bold text-yellow-700">{sellerRating.average.toFixed(1)}</span>
                    <span className="text-xs text-yellow-600">({sellerRating.count} {sellerRating.count === 1 ? 'review' : 'reviews'})</span>
                  </div>
                )}
              </div>
            </div>
            {seller?.isVerified && (
              <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md text-xs font-bold">
                <ShieldCheck className="w-4 h-4" /> Verified
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-auto pt-6 border-t border-gray-100">
            {userData?.role === 'vendor' && !isOwner && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-800">Vendor Restriction</p>
                  <p className="text-xs text-red-700 mt-0.5">Vendor accounts are restricted to selling only. You cannot purchase or bid on items.</p>
                </div>
              </div>
            )}

            {!userData?.isVerified && !isOwner && user && userData?.role !== 'vendor' && (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-orange-800">Verification Required</p>
                  <p className="text-xs text-orange-700 mt-0.5">Please verify your account in the dashboard to trade on UniMart.</p>
                  <Link href="/profile?tab=verification" className="text-xs font-bold text-orange-800 underline mt-2 block">Go to Profile Verification</Link>
                </div>
              </div>
            )}

            {product.type === 'auction' ? (
              <div className="flex flex-col gap-3">
                <div className={(!userData?.isVerified || userData?.role === 'vendor') && !isOwner ? 'opacity-50 pointer-events-none' : ''}>
                  <BiddingSection 
                    productId={product.id} 
                    productTitle={product.title}
                    productImage={product.previewImage || product.images?.[0] || ''}
                    sellerId={product.sellerId}
                    startingPrice={Number(product.price)} 
                    isOwner={isOwner}
                    status={product.status}
                    auctionEndTime={product.auctionEndTime}
                  />
                </div>
                {isOwner && (
                  <Link 
                    href={`/products/${product.id}/edit`}
                    className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    Edit Listing
                  </Link>
                )}
              </div>
            ) : isOwner ? (
              <div className="flex flex-col gap-3">
                <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-center font-medium">
                  This is your listing.
                </div>
                <Link 
                  href={`/products/${product.id}/edit`}
                  className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  Edit Listing
                </Link>
              </div>
            ) : product.status !== 'active' ? (
              <div className="bg-gray-100 text-gray-500 p-4 rounded-xl text-center font-medium">
                This item is no longer available.
              </div>
            ) : (
            <div className="flex flex-wrap sm:flex-nowrap gap-3 mb-4">
              <button 
                onClick={handleAddToCart}
                disabled={items.some(i => i.id === (product.hasVariations ? `${product.id}-${selectedVariantIndex}` : product.id)) || userData?.role === 'vendor' || (product.hasVariations && product.variants?.[selectedVariantIndex]?.quantity <= 0)}
                className="flex-[2] bg-[#d9ff00] text-black py-4 px-4 rounded-xl font-bold text-base sm:text-lg hover:bg-[#c4e600] transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShoppingBag className="w-5 h-5 flex-shrink-0" /> {items.some(i => i.id === (product.hasVariations ? `${product.id}-${selectedVariantIndex}` : product.id)) ? 'In Cart' : 'Add to Cart'}
              </button>
              
              <button 
                onClick={toggleFavorite}
                className={`flex-1 sm:flex-none sm:w-16 bg-white border ${isFavorite ? 'border-red-500 text-red-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'} py-4 px-4 rounded-xl font-bold text-lg transition-colors shadow-sm flex items-center justify-center gap-2`}
                aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
              </button>

              {user && (
                <Link
                  href={`/dashboard/messages?sellerId=${product.sellerId}&productId=${product.id}`}
                  className="w-full sm:w-auto bg-black text-white px-6 py-4 sm:py-0 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  Message
                </Link>
              )}
            </div>
            )}

            {!isOwner && user && (
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="w-full mt-4 py-3 text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" /> Report this listing
              </button>
            )}
          </div>
        </div>

      </div>

      {product && (
        <ReportModal 
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          targetId={product.id}
          targetType="product"
        />
      )}
    </div>
  );
}
