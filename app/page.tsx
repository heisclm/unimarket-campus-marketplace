'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import PremiumImage from "@/components/ui/PremiumImage";

export const dynamic = 'force-dynamic';
import { ArrowUpRight, Star, Heart, Shield, Zap, Users, ShoppingBag, ArrowRight } from "lucide-react";
import { 
  subscribeToFeaturedProduct, 
  subscribeToPopularProducts, 
  subscribeToNewProducts, 
  subscribeToMoreProducts,
  subscribeToAllActiveProducts,
  subscribeToActiveAuctions,
  Product 
} from "@/lib/products";
import { Gavel } from "lucide-react";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Academic Materials', 'Hostel Essentials', 'Food', 'Tech', 'Furniture', 'Clothing']);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const unsubAll = subscribeToAllActiveProducts((fetchedProducts) => {
      setProducts(fetchedProducts);
      const cats = Array.from(new Set(fetchedProducts.map(p => p.category))).filter(Boolean);
      if (cats.length > 0) {
        setCategories(cats);
      }
      setLoading(false);
    });

    return () => {
      unsubAll();
    };
  }, []);

  // Helper to get time
  const getTime = (p: Product) => p.createdAt?.toMillis ? p.createdAt.toMillis() : 0;

  // Sort products by newest first
  const sortedProducts = [...products].sort((a, b) => getTime(b) - getTime(a));

  // 1. Featured product pool (isSponsored first, then isFeatured, then latest 3)
  const sponsoredProducts = sortedProducts.filter(p => p.isSponsored);
  const featuredProducts = sortedProducts.filter(p => p.isFeatured);
  const heroPool = sponsoredProducts.length > 0 ? sponsoredProducts : (featuredProducts.length > 0 ? featuredProducts : sortedProducts.slice(0, 3));

  // Auto-rotate hero product
  useEffect(() => {
    if (heroPool.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroPool.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroPool.length]);

  const featuredProduct = heroPool[heroIndex] || null;
  
  // Remove all hero pool products from remaining pool to avoid duplicates
  let remainingProducts = sortedProducts.filter(p => !heroPool.find(hp => hp.id === p.id));


  // 2. Popular product (for highlight card)
  const highlightProduct = remainingProducts.find(p => p.isPopular) || remainingProducts[0] || null;
  remainingProducts = remainingProducts.filter(p => p.id !== highlightProduct?.id);

  // 3. Tall Card Product (New Product 1)
  const tallCardProduct = remainingProducts[0] || null;
  remainingProducts = remainingProducts.filter(p => p.id !== tallCardProduct?.id);

  // 4. Small Product Card (New Product 2)
  const newGenProduct = remainingProducts[0] || null;
  remainingProducts = remainingProducts.filter(p => p.id !== newGenProduct?.id);

  // 5. More Products (Mini gallery)
  const moreProducts = remainingProducts.slice(0, 3);
  remainingProducts = remainingProducts.filter(p => !moreProducts.find(mp => mp.id === p.id));

  // 6. Active Auctions
  const activeAuctions = sortedProducts.filter(p => p.type === 'auction').slice(0, 4);

  return (
    <div className="space-y-32 pb-24">
      {/* Bento Grid Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 auto-rows-auto">
        
        {/* Hero Section (Spans 2 columns, 2 rows on large screens) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-2 bg-white rounded-[2.5rem] p-8 md:p-14 shadow-2xl shadow-gray-200/40 border border-gray-50 flex flex-col md:flex-row items-center justify-between min-h-[440px] gap-8 relative overflow-hidden group">
          <div className="absolute top-[-20%] left-[-10%] w-72 h-72 bg-[#d9ff00]/10 rounded-full blur-3xl group-hover:bg-[#d9ff00]/20 transition-all duration-700 pointer-events-none"></div>
          <div className="z-10 flex-1 w-full max-w-md relative">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-100/80 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider text-gray-700 mb-6 border border-gray-200/50">
              <span className={`w-2 h-2 rounded-full animate-pulse ${featuredProduct?.isSponsored ? 'bg-orange-500' : 'bg-black'}`}></span>
              {featuredProduct?.isSponsored ? 'Sponsored Product' : (featuredProduct?.category || 'Featured Item')}
            </span>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter leading-[1.05] mb-6 line-clamp-3 text-gray-900">
              {loading ? (
                <div className="h-16 bg-gray-100 rounded-2xl animate-pulse w-full mb-2" />
              ) : (
                featuredProduct?.title || 'Premium Campus Deals.'
              )}
            </h1>
            <div className="flex items-start gap-4 mb-10">
              <span className="text-5xl font-light text-gray-200 tabular-nums tracking-tighter">0{heroIndex + 1}</span>
              <div className="flex-1 pt-1">
                <h3 className="font-bold text-gray-900 text-lg">{featuredProduct?.isSponsored ? 'Advertisement' : 'Featured Handpick'}</h3>
                {loading ? (
                  <div className="space-y-2 mt-3">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm mt-1.5 line-clamp-2 leading-relaxed font-medium">
                    {featuredProduct?.description || 'Find the best items listed by your fellow students.'}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Link href={featuredProduct ? `/products/${featuredProduct.id}` : "/products"} className="inline-flex items-center gap-3 bg-[#d9ff00] text-black font-bold px-8 py-4 rounded-full hover:bg-[#c4e600] transition-transform active:scale-95 shadow-lg shadow-[#d9ff00]/20">
                {featuredProduct ? 'View Details' : 'View All Products'}
                <span className="bg-black text-[#d9ff00] p-1.5 rounded-full">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </Link>

              
              {heroPool.length > 1 && (
                <div className="flex items-center gap-2">
                  {heroPool.map((_, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setHeroIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${idx === heroIndex ? 'w-6 bg-black' : 'w-2 bg-gray-200 hover:bg-gray-300'}`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Hero Image */}
          <div className="relative w-full md:w-1/2 h-[300px] md:h-[400px] flex-shrink-0">
            <PremiumImage 
              src={featuredProduct?.previewImage || featuredProduct?.images?.[0] || ""} 
              fallbackSrc="https://picsum.photos/seed/headphones/800/800"
              alt={featuredProduct?.title || "Featured Product"} 
              fill 
              className="object-contain drop-shadow-2xl"
              referrerPolicy="no-referrer"
              containerClassName="absolute inset-0"
            />
          </div>
        </div>

        {/* Popular Categories */}
        <div className="col-span-1 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white rounded-[2.5rem] p-8 shadow-xl flex flex-col relative overflow-hidden group border border-gray-800">
          <div className="absolute top-[-20%] right-[-20%] w-60 h-60 bg-blue-500 rounded-full blur-[90px] opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-40 h-40 bg-[#d9ff00] rounded-full blur-[70px] opacity-10 group-hover:opacity-20 transition-opacity duration-700"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
                <Zap className="w-5 h-5 text-[#d9ff00]" />
              </div>
              <h3 className="font-bold text-2xl tracking-tighter">Trending</h3>
            </div>
            <div className="flex flex-wrap gap-2.5 mt-auto">
              {categories.slice(0, 8).map((cat) => (
                <Link 
                  key={cat} 
                  href={`/products?category=${cat.toLowerCase()}`}
                  className="px-4 py-2 bg-white/5 hover:bg-[#d9ff00] hover:text-black border border-white/10 hover:border-[#d9ff00] rounded-xl text-sm font-semibold transition-all duration-300 backdrop-blur-sm"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Tall Image Card (New Product 1) */}
        <Link 
          href={tallCardProduct ? `/products/${tallCardProduct.id}` : "/products"}
          className="col-span-1 lg:row-span-2 bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden min-h-[300px] flex flex-col justify-end group cursor-pointer hover:shadow-xl transition-shadow duration-500"
        >
          <div className="absolute inset-0 z-0">
            <PremiumImage 
              src={tallCardProduct?.previewImage || tallCardProduct?.images?.[0] || ""} 
              fallbackSrc="https://picsum.photos/seed/vr/600/800"
              alt={tallCardProduct?.title || "New Product"} 
              fill 
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              referrerPolicy="no-referrer"
              containerClassName="absolute inset-0"
            />
          </div>
          <div className="absolute top-6 right-6 z-10 bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg text-gray-900 group-hover:bg-black group-hover:text-white transition-colors duration-300">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div className="relative z-10 bg-white/95 backdrop-blur-md p-5 rounded-3xl shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
            <h3 className="font-bold text-xl leading-tight line-clamp-2 text-gray-900">{tallCardProduct?.title || 'Next Gen Tech'}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-1 font-medium">{tallCardProduct?.description || 'Immersive learning'}</p>
          </div>
        </Link>

        {/* Small Product Card (New Product 2) */}
        <Link 
          href={newGenProduct ? `/products/${newGenProduct.id}` : "/products"}
          className="col-span-1 bg-[#f4f4f0] rounded-[2.5rem] p-8 relative overflow-hidden group cursor-pointer hover:bg-gray-100 transition-colors duration-500"
        >
          <div className="absolute top-6 right-6 z-10 bg-white p-2 rounded-full shadow-sm group-hover:bg-black group-hover:text-white transition-colors duration-300">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xl relative z-10 line-clamp-2 pr-8 text-gray-900 tracking-tight">
            {newGenProduct?.title || 'New Arrivals'}
          </h3>
          <div className="absolute right-[-15%] bottom-[-15%] w-[85%] h-[85%] z-0 drop-shadow-2xl">
            <PremiumImage 
              src={newGenProduct?.previewImage || newGenProduct?.images?.[0] || ""} 
              fallbackSrc="https://picsum.photos/seed/earbuds/400/400"
              alt={newGenProduct?.title || "New Arrival"} 
              fill 
              className="object-contain group-hover:scale-110 group-hover:-rotate-3 transition-all duration-700"
              referrerPolicy="no-referrer"
              containerClassName="absolute inset-0"
            />
          </div>
        </Link>

        {/* More Products Mini Gallery */}
        <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-xl transition-shadow duration-500">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-xl tracking-tight text-gray-900">More Products</h3>
              <p className="text-sm text-gray-500 font-medium">Discover unique items.</p>
            </div>
            <div className="bg-red-50 p-2.5 rounded-2xl text-red-500 group-hover:scale-110 group-hover:bg-red-500 group-hover:text-white transition-all duration-300 shadow-sm">
              <Heart className="w-5 h-5 fill-current" />
            </div>
          </div>
          <div className="flex gap-4">
            {moreProducts.length > 0 ? moreProducts.map((p, i) => (
              <Link key={p.id} href={`/products/${p.id}`} className="flex-1 aspect-square rounded-2xl bg-gray-100 relative overflow-hidden group/img">
                 <PremiumImage src={p.previewImage || p.images?.[0] || ""} fallbackSrc={`https://picsum.photos/seed/item${i}/100/100`} alt={p.title} fill className="object-cover group-hover/img:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" containerClassName="absolute inset-0" />
              </Link>
            )) : [1, 2, 3].map(i => (
              <div key={i} className="flex-1 aspect-square rounded-2xl bg-gray-100 relative overflow-hidden">
                 <PremiumImage src="" fallbackSrc={`https://picsum.photos/seed/item${i}/100/100`} alt="Item" fill className="object-cover" referrerPolicy="no-referrer" containerClassName="absolute inset-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats / Reviews Card */}
        <div className="col-span-1 bg-gray-900 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group border border-gray-800">
          <div className="absolute inset-0 bg-[#d9ff00]/5 group-hover:bg-[#d9ff00]/10 transition-colors duration-500"></div>
          <div className="flex -space-x-4 mb-5 relative z-10">
            <div className="w-12 h-12 rounded-full border-2 border-gray-900 bg-gray-800 overflow-hidden relative shadow-lg"><PremiumImage src="" showSkeleton={false} fallbackSrc="https://picsum.photos/seed/user1/100/100" alt="User" fill className="object-cover" referrerPolicy="no-referrer" containerClassName="absolute inset-0" /></div>
            <div className="w-12 h-12 rounded-full border-2 border-gray-900 bg-gray-800 overflow-hidden relative shadow-lg"><PremiumImage src="" showSkeleton={false} fallbackSrc="https://picsum.photos/seed/user2/100/100" alt="User" fill className="object-cover" referrerPolicy="no-referrer" containerClassName="absolute inset-0" /></div>
            <div className="w-12 h-12 rounded-full border-2 border-gray-900 bg-gray-800 overflow-hidden relative shadow-lg"><PremiumImage src="" showSkeleton={false} fallbackSrc="https://picsum.photos/seed/user3/100/100" alt="User" fill className="object-cover" referrerPolicy="no-referrer" containerClassName="absolute inset-0" /></div>
          </div>
          <div className="relative z-10 w-28 h-28 bg-[#d9ff00] rounded-full flex flex-col items-center justify-center text-black shadow-xl shadow-[#d9ff00]/20 mb-5 group-hover:scale-105 transition-transform duration-500">
            <span className="text-3xl font-black tracking-tighter">5k+</span>
            <span className="text-xs font-bold uppercase tracking-widest opacity-80 mt-1">Users</span>
          </div>
          <div className="relative z-10 flex items-center gap-1.5 text-sm font-bold bg-white/10 text-white backdrop-blur-md px-4 py-1.5 rounded-full shadow-sm border border-white/10">
            <Star className="w-4 h-4 text-[#d9ff00] fill-current" />
            4.8 rating
          </div>
        </div>

        {/* Article / Highlight Card (Popular Product 1) */}
        <Link 
          href={highlightProduct ? `/products/${highlightProduct.id}` : "/products"}
          className="col-span-1 md:col-span-2 lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-8 group cursor-pointer hover:shadow-xl transition-shadow duration-500"
        >
          <div className="flex-1 w-full text-center sm:text-left">
            <span className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold mb-4 uppercase tracking-wider">
              <Heart className="w-3 h-3 fill-current" /> {highlightProduct?.category || 'Popular Rating'}
            </span>
            <h3 className="font-black text-2xl sm:text-3xl tracking-tighter leading-[1.1] mb-5 line-clamp-2 text-gray-900">
              {highlightProduct?.title || 'Textbooks & Notes Exchange Released'}
            </h3>
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="flex -space-x-3">
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative shadow-sm"><PremiumImage src="" showSkeleton={false} fallbackSrc="https://picsum.photos/seed/book1/100/100" alt="Book" fill className="object-cover" referrerPolicy="no-referrer" containerClassName="absolute inset-0" /></div>
                 <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative shadow-sm"><PremiumImage src="" showSkeleton={false} fallbackSrc="https://picsum.photos/seed/book2/100/100" alt="Book" fill className="object-cover" referrerPolicy="no-referrer" containerClassName="absolute inset-0" /></div>
              </div>
              <span className="text-sm font-semibold text-gray-500">Trending Now</span>
            </div>
          </div>
          <div className="relative w-full max-w-[200px] aspect-square sm:w-48 sm:h-48 flex-shrink-0">
            <PremiumImage 
              src={highlightProduct?.previewImage || highlightProduct?.images?.[0] || ""} 
              fallbackSrc="https://picsum.photos/seed/hands/400/400"
              alt={highlightProduct?.title || "Popular Item"} 
              fill 
              className="object-cover rounded-3xl group-hover:scale-105 transition-transform duration-700 shadow-lg"
              referrerPolicy="no-referrer"
              containerClassName="absolute inset-0"
            />
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-lg text-gray-900 group-hover:bg-black group-hover:text-white transition-colors duration-300">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="absolute bottom-3 right-3 bg-black/80 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/10">
              <Star className="w-3.5 h-3.5 text-[#d9ff00] fill-current" /> 4.9
            </div>
          </div>
        </Link>
      </div>

      {/* Live Auctions Section */}
      {activeAuctions.length > 0 && (
        <div className="space-y-10">
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter text-gray-900">Live Auctions</h2>
              <p className="text-gray-500 font-medium">Bid on campus deals in real-time.</p>
            </div>
            <Link href="/products?type=auction" className="text-sm font-bold flex items-center gap-1.5 hover:text-black text-gray-500 transition-colors uppercase tracking-widest bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {activeAuctions.map((auction) => (
              <Link 
                key={auction.id} 
                href={`/products/${auction.id}`}
                className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100/60 hover:shadow-xl transition-all duration-500 group flex flex-col"
              >
                <div className="relative aspect-square rounded-[1.5rem] overflow-hidden mb-5">
                  <PremiumImage 
                    src={auction.previewImage || auction.images?.[0] || ""} 
                    fallbackSrc="https://picsum.photos/seed/auction/400/400"
                    alt={auction.title} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                    containerClassName="absolute inset-0"
                  />
                  <div className="absolute top-3 left-3 bg-red-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-red-400/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    <Gavel className="w-3.5 h-3.5" /> LIVE
                  </div>
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1">{auction.title}</h3>
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                  <span className="text-gray-900 font-black text-xl tracking-tight">GH₵{auction.price.toFixed(2)}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Current Bid</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="space-y-10 pt-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900">Why Use UniMart?</h2>
          <p className="text-gray-500 font-medium">Built for trusted trading. Safe, fast, and local.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-500 group hover:-translate-y-2">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-tight text-gray-900">Safe & Secure</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              Verified accounts and robust ID checks ensure you&apos;re only dealing with real people and trusted vendors. No scammers.
            </p>
          </div>
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-500 group hover:-translate-y-2">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-[1.5rem] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all duration-500 shadow-sm">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-tight text-gray-900">Fast Auctions</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              Bid in real-time on books, electronics, and more. Get the best deals before they&apos;re gone.
            </p>
          </div>
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-500 group hover:-translate-y-2">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-[1.5rem] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-green-600 group-hover:text-white transition-all duration-500 shadow-sm">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-tight text-gray-900">Community First</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              Join discussions, share tips, and connect with fellow members in our vibrant community.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-900 text-white rounded-[3rem] p-10 md:p-20 overflow-hidden relative border border-gray-800">
        <div className="relative z-10 max-w-2xl">
          <div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-10 leading-[1.1]">How UniMart Works</h2>
            <div className="space-y-10 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-800 before:to-transparent hidden"></div>
            <div className="space-y-10 relative">
              <div className="flex gap-6 relative z-10 group">
                <div className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 text-[#d9ff00] group-hover:bg-[#d9ff00] group-hover:text-black transition-colors duration-500 flex items-center justify-center font-black text-xl shrink-0 shadow-lg">1</div>
                <div className="pt-2">
                  <h4 className="text-2xl font-bold mb-3 tracking-tight">Create your account</h4>
                  <p className="text-gray-400 text-base leading-relaxed font-medium">Sign up safely with your email to get verified and start exploring amazing deals.</p>
                </div>
              </div>
              <div className="flex gap-6 relative z-10 group">
                <div className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 text-[#d9ff00] group-hover:bg-[#d9ff00] group-hover:text-black transition-colors duration-500 flex items-center justify-center font-black text-xl shrink-0 shadow-lg">2</div>
                <div className="pt-2">
                  <h4 className="text-2xl font-bold mb-3 tracking-tight">List or Browse</h4>
                  <p className="text-gray-400 text-base leading-relaxed font-medium">Post items you no longer need or find exactly what you&apos;re looking for at great prices.</p>
                </div>
              </div>
              <div className="flex gap-6 relative z-10 group">
                <div className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 text-[#d9ff00] group-hover:bg-[#d9ff00] group-hover:text-black transition-colors duration-500 flex items-center justify-center font-black text-xl shrink-0 shadow-lg">3</div>
                <div className="pt-2">
                  <h4 className="text-2xl font-bold mb-3 tracking-tight">Secure Exchange</h4>
                  <p className="text-gray-400 text-base leading-relaxed font-medium">Communicate easily, meet locally, or use our secure payment system for a smooth transaction.</p>
                </div>
              </div>
            </div>
            <Link href="/profile" className="inline-flex items-center gap-2 bg-white text-black font-bold px-8 py-4 rounded-full mt-12 hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-white/10 text-lg">
              Get Started Now <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-[#d9ff00] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full blur-[150px] opacity-10 pointer-events-none"></div>
      </div>

      {/* CTA Section */}
      <div className="relative rounded-[3rem] bg-gradient-to-br from-[#d9ff00]/10 via-transparent to-[#d9ff00]/5 border border-[#d9ff00]/20 p-12 hover:border-[#d9ff00]/40 transition-colors duration-700 overflow-hidden text-center max-w-4xl mx-auto space-y-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-[#d9ff00] blur-[100px] opacity-20 pointer-events-none"></div>
        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white rounded-full text-sm font-bold shadow-sm border border-gray-100 uppercase tracking-widest text-gray-900 relative z-10">
          <ShoppingBag className="w-4 h-4 text-[#d9ff00]" />
          Join 5,000+ Users
        </div>
        <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-[1.05] text-gray-900 relative z-10">
          Ready to declutter<br />your space?
        </h2>
        <p className="text-gray-500 text-lg md:text-xl font-medium max-w-2xl mx-auto relative z-10 leading-relaxed">
          Turn your unused items, clothes, and electronics into cash today. It only takes 2 minutes to list your first item.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 relative z-10">
          <Link href="/products/new" className="bg-black text-[#d9ff00] px-10 py-5 rounded-full font-bold text-lg hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-black/10">
            Start Selling Now
          </Link>
          <Link href="/products" className="bg-white text-black border border-gray-200 px-10 py-5 rounded-full font-bold text-lg hover:bg-gray-50 hover:scale-105 active:scale-95 transition-transform shadow-sm">
            Browse Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
