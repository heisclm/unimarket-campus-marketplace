'use client';

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
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
  const [featuredProduct, setFeaturedProduct] = useState<Product | null>(null);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [moreProducts, setMoreProducts] = useState<Product[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Tech', 'Books', 'Furniture', 'Clothing', 'Sports']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubFeatured = subscribeToFeaturedProduct(setFeaturedProduct);
    const unsubPopular = subscribeToPopularProducts(setPopularProducts, 1); // We use one for the bottom right highlight
    const unsubNew = subscribeToNewProducts(setNewProducts, 4);
    const unsubMore = subscribeToMoreProducts(setMoreProducts, 3);
    const unsubAuctions = subscribeToActiveAuctions(setActiveAuctions, 4);
    
    const unsubAll = subscribeToAllActiveProducts((products) => {
      const cats = Array.from(new Set(products.map(p => p.category)));
      if (cats.length > 0) {
        setCategories(cats);
      }
      setLoading(false);
    });

    return () => {
      unsubFeatured();
      unsubPopular();
      unsubNew();
      unsubMore();
      unsubAuctions();
      unsubAll();
    };
  }, []);

  // Use the first popular product for the bottom right highlight
  const highlightProduct = popularProducts[0] || null;
  // Use the first new product for the middle small card
  const newGenProduct = newProducts[0] || null;
  // Use the second new product for the tall card
  const tallCardProduct = newProducts[1] || null;

  return (
    <div className="space-y-24 pb-20">
      {/* Bento Grid Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-auto">
        
        {/* Hero Section (Spans 2 columns, 2 rows on large screens) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-2 bg-white rounded-[2rem] p-8 md:p-12 relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[400px]">
          <div className="z-10 max-w-md">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-600 mb-6">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              {featuredProduct?.category || 'Featured'}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
              {featuredProduct?.title || 'Premium Campus Deals.'}
            </h1>
            <div className="flex items-start gap-4 mb-8">
              <span className="text-4xl font-light text-gray-300">01</span>
              <div>
                <h3 className="font-semibold text-lg">Featured Item</h3>
                <p className="text-gray-500 text-sm mt-1">
                  {featuredProduct?.description || 'Find the best items listed by your fellow students.'}
                </p>
              </div>
            </div>
            <Link href={featuredProduct ? `/products/${featuredProduct.id}` : "/products"} className="inline-flex items-center gap-3 bg-[#d9ff00] text-black font-semibold px-6 py-3 rounded-full hover:bg-[#c4e600] transition-colors">
              {featuredProduct ? 'View Details' : 'View All Products'}
              <span className="bg-black text-white p-1.5 rounded-full">
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
          
          {/* Hero Image */}
          <div className="absolute right-[-10%] bottom-[-10%] w-[60%] h-[80%] z-0">
            <Image 
              src={featuredProduct?.previewImage || featuredProduct?.images?.[0] || "https://picsum.photos/seed/headphones/800/800"} 
              alt={featuredProduct?.title || "Featured Product"} 
              fill 
              className="object-contain drop-shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Popular Categories */}
        <div className="col-span-1 bg-white rounded-[2rem] p-6 shadow-sm flex flex-col">
          <h3 className="font-semibold text-lg mb-4">Popular Categories</h3>
          <div className="flex flex-wrap gap-2 mt-auto">
            {categories.slice(0, 8).map((cat) => (
              <Link 
                key={cat} 
                href={`/products?category=${cat.toLowerCase()}`}
                className="px-3 py-1.5 bg-gray-50 hover:bg-[#d9ff00] rounded-full text-xs font-bold transition-colors"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>

        {/* Tall Image Card (New Product 2) */}
        <Link 
          href={tallCardProduct ? `/products/${tallCardProduct.id}` : "/products"}
          className="col-span-1 lg:row-span-2 bg-white rounded-[2rem] p-6 shadow-sm relative overflow-hidden min-h-[300px] flex flex-col justify-end group cursor-pointer"
        >
          <div className="absolute inset-0 z-0">
            <Image 
              src={tallCardProduct?.previewImage || tallCardProduct?.images?.[0] || "https://picsum.photos/seed/vr/600/800"} 
              alt={tallCardProduct?.title || "New Product"} 
              fill 
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute top-4 right-4 z-10 bg-white p-2 rounded-full shadow-sm">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div className="relative z-10 bg-white/90 backdrop-blur-sm p-4 rounded-2xl">
            <h3 className="font-semibold text-lg leading-tight">{tallCardProduct?.title || 'Next Gen Tech'}</h3>
            <p className="text-sm text-gray-500 mt-1">{tallCardProduct?.description?.slice(0, 40) || 'Immersive learning'}...</p>
          </div>
        </Link>

        {/* Small Product Card (New Product 1) */}
        <Link 
          href={newGenProduct ? `/products/${newGenProduct.id}` : "/products"}
          className="col-span-1 bg-white rounded-[2rem] p-6 shadow-sm relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute top-4 right-4 z-10 bg-white p-2 rounded-full shadow-sm">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-lg relative z-10">
            {newGenProduct?.title?.split(' ').slice(0, 2).join(' ') || 'New Gen'}<br/>
            {newGenProduct?.title?.split(' ').slice(2, 4).join(' ') || 'Arrivals'}
          </h3>
          <div className="absolute right-[-20%] bottom-[-20%] w-[80%] h-[80%] z-0">
            <Image 
              src={newGenProduct?.previewImage || newGenProduct?.images?.[0] || "https://picsum.photos/seed/earbuds/400/400"} 
              alt={newGenProduct?.title || "New Arrival"} 
              fill 
              className="object-contain group-hover:scale-110 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          </div>
        </Link>

        {/* More Products Mini Gallery */}
        <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-white rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-lg">More Products</h3>
              <p className="text-sm text-gray-500">Discover unique items.</p>
            </div>
            <div className="bg-red-50 p-2 rounded-full text-red-500">
              <Heart className="w-5 h-5 fill-current" />
            </div>
          </div>
          <div className="flex gap-3">
            {moreProducts.length > 0 ? moreProducts.map((p, i) => (
              <Link key={p.id} href={`/products/${p.id}`} className="w-16 h-16 rounded-xl bg-gray-100 relative overflow-hidden">
                 <Image src={p.previewImage || p.images?.[0] || `https://picsum.photos/seed/item${i}/100/100`} alt={p.title} fill className="object-cover" referrerPolicy="no-referrer" />
              </Link>
            )) : [1, 2, 3].map(i => (
              <div key={i} className="w-16 h-16 rounded-xl bg-gray-100 relative overflow-hidden">
                 <Image src={`https://picsum.photos/seed/item${i}/100/100`} alt="Item" fill className="object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats / Reviews Card */}
        <div className="col-span-1 bg-[#f4f4f0] rounded-[2rem] p-6 flex flex-col items-center justify-center text-center">
          <div className="flex -space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative"><Image src="https://picsum.photos/seed/user1/100/100" alt="User" fill className="object-cover" referrerPolicy="no-referrer" /></div>
            <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative"><Image src="https://picsum.photos/seed/user2/100/100" alt="User" fill className="object-cover" referrerPolicy="no-referrer" /></div>
            <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative"><Image src="https://picsum.photos/seed/user3/100/100" alt="User" fill className="object-cover" referrerPolicy="no-referrer" /></div>
          </div>
          <div className="w-24 h-24 bg-blue-500 rounded-full flex flex-col items-center justify-center text-white shadow-lg mb-4">
            <span className="text-2xl font-bold">5k+</span>
            <span className="text-xs opacity-80">Students</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium bg-white px-3 py-1 rounded-full shadow-sm">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            4.8 reviews
          </div>
        </div>

        {/* Article / Highlight Card (Popular Product 1) */}
        <Link 
          href={highlightProduct ? `/products/${highlightProduct.id}` : "/products"}
          className="col-span-1 md:col-span-2 lg:col-span-2 bg-white rounded-[2rem] p-6 shadow-sm flex items-center justify-between group cursor-pointer"
        >
          <div className="max-w-[50%]">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-500 rounded-md text-xs font-medium mb-3">
              <Heart className="w-3 h-3 fill-current" /> Popular
            </span>
            <h3 className="font-semibold text-xl leading-tight mb-4">
              {highlightProduct?.title || 'Textbooks & Notes Exchange Released'}
            </h3>
            <div className="flex -space-x-2">
               <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative"><Image src="https://picsum.photos/seed/book1/100/100" alt="Book" fill className="object-cover" referrerPolicy="no-referrer" /></div>
               <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative"><Image src="https://picsum.photos/seed/book2/100/100" alt="Book" fill className="object-cover" referrerPolicy="no-referrer" /></div>
            </div>
          </div>
          <div className="relative w-32 h-32 md:w-40 md:h-40">
            <Image 
              src={highlightProduct?.previewImage || highlightProduct?.images?.[0] || "https://picsum.photos/seed/hands/400/400"} 
              alt={highlightProduct?.title || "Popular Item"} 
              fill 
              className="object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-2 right-2 bg-white p-1.5 rounded-full shadow-sm">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
              <Star className="w-3 h-3 text-yellow-400 fill-current" /> 4.9
            </div>
          </div>
        </Link>
      </div>

      {/* Live Auctions Section */}
      {activeAuctions.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Live Auctions</h2>
              <p className="text-gray-500">Bid on campus deals in real-time.</p>
            </div>
            <Link href="/products?type=auction" className="text-sm font-bold flex items-center gap-1 hover:underline">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {activeAuctions.map((auction) => (
              <Link 
                key={auction.id} 
                href={`/products/${auction.id}`}
                className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 hover:shadow-md transition-all group"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden mb-4">
                  <Image 
                    src={auction.previewImage || auction.images?.[0] || "https://picsum.photos/seed/auction/400/400"} 
                    alt={auction.title} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                    <Gavel className="w-3 h-3" /> AUCTION
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 mb-1 truncate">{auction.title}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-orange-600 font-bold">GH₵{auction.price.toFixed(2)}</span>
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Current Bid</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold mb-3">Safe & Secure</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Verified university emails ensure you&apos;re only dealing with real students and trusted vendors on campus.
          </p>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-6">
            <Zap className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold mb-3">Fast Auctions</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Bid in real-time on textbooks, electronics, and more. Get the best campus deals before they&apos;re gone.
          </p>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-6">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold mb-3">Community First</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Join discussions, share notes, and connect with fellow students in our vibrant campus community.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-black text-white rounded-[3rem] p-12 md:p-20 overflow-hidden relative">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">How UniMarket Works</h2>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-full bg-[#d9ff00] text-black flex items-center justify-center font-bold shrink-0">1</div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Create your account</h4>
                  <p className="text-gray-400 text-sm">Sign up with your university email to get verified and start exploring.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-full bg-[#d9ff00] text-black flex items-center justify-center font-bold shrink-0">2</div>
                <div>
                  <h4 className="text-xl font-bold mb-2">List or Browse</h4>
                  <p className="text-gray-400 text-sm">Post items you no longer need or find exactly what you&apos;re looking for at student prices.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-full bg-[#d9ff00] text-black flex items-center justify-center font-bold shrink-0">3</div>
                <div>
                  <h4 className="text-xl font-bold mb-2">Secure Exchange</h4>
                  <p className="text-gray-500 text-sm">Meet on campus or use our secure payment system for a smooth transaction.</p>
                </div>
              </div>
            </div>
            <Link href="/profile" className="inline-flex items-center gap-2 bg-white text-black font-bold px-8 py-4 rounded-full mt-12 hover:bg-gray-100 transition-all">
              Get Started Now <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="relative h-[400px] lg:h-[500px] rounded-[2rem] overflow-hidden">
            <Image 
              src="https://picsum.photos/seed/campus/800/1000" 
              alt="Campus life" 
              fill 
              className="object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#d9ff00] rounded-full blur-[120px] opacity-20"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-blue-500 rounded-full blur-[120px] opacity-20"></div>
      </div>

      {/* CTA Section */}
      <div className="text-center max-w-3xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm font-bold shadow-sm border border-gray-50">
          <ShoppingBag className="w-4 h-4 text-[#d9ff00]" />
          Join 5,000+ Students
        </div>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to declutter your dorm?</h2>
        <p className="text-gray-500 text-lg">
          Turn your unused textbooks, clothes, and electronics into cash today. It only takes 2 minutes to list your first item.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/products/new" className="bg-black text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition-all shadow-lg">
            Start Selling
          </Link>
          <Link href="/products" className="bg-white text-black border border-gray-200 px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-50 transition-all">
            Browse Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
