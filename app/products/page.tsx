'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isActiveProduct, sanitizeProduct } from '@/lib/products';
import PremiumImage from '@/components/ui/PremiumImage';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Search, Filter, Clock, Tag, ShieldCheck, AlertCircle } from 'lucide-react';
import ProductCard from '@/components/products/ProductCard';

import { motion } from 'motion/react';

import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

function ProductsContent() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search');
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState(urlSearch || '');
  const [searchTerm, setSearchTerm] = useState(urlSearch || '');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setInputValue(urlSearch || '');
    setSearchTerm(urlSearch || '');
  }, [urlSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(inputValue.trim());
    if (inputValue.trim()) {
      router.push(`/products?search=${encodeURIComponent(inputValue.trim())}`);
    } else {
      router.push('/products');
    }
  };

  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const q = query(collection(db, 'products'), where('status', '==', 'active'));
        const querySnapshot = await getDocs(q);
        const cats = new Set<string>();
        querySnapshot.forEach(doc => {
          const cat = doc.data().category;
          if (cat) cats.add(cat);
        });
        setCategories(['All', ...Array.from(cats)]);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 8000);
      try {
        let q;
        if (selectedCategory === 'All') {
          q = query(
            collection(db, 'products'),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = query(
            collection(db, 'products'),
            where('status', '==', 'active'),
            where('category', '==', selectedCategory),
            orderBy('createdAt', 'desc')
          );
        }

        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => sanitizeProduct({
          id: doc.id,
          ...doc.data()
        } as any)).filter((p: any) => isActiveProduct(p));
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, pathname, searchParams]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }).sort((a, b) => {
    if (a.isSponsored && !b.isSponsored) return -1;
    if (!a.isSponsored && b.isSponsored) return 1;
    return 0;
  });

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="bg-gray-900 text-white rounded-[2.5rem] p-8 md:p-12 shadow-xl relative overflow-hidden border border-gray-800">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-[#d9ff00] rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3 leading-tight">Marketplace</h1>
            <p className="text-gray-400 font-medium text-lg">Discover handpicked items and live auctions from verified students on campus.</p>
          </div>
          
          <Link href="/products/new" className="bg-[#d9ff00] text-black font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-[0.98] transition-transform whitespace-nowrap shadow-xl shadow-[#d9ff00]/20 flex items-center gap-2">
            <span className="text-xl leading-none">+</span>
            <span>List an Item</span>
          </Link>
        </div>

        <div className="relative z-10 mt-10">
          <form 
            onSubmit={handleSearchSubmit}
            className="w-full relative max-w-2xl"
          >
            <button type="submit" className="absolute left-5 top-1/2 -translate-y-1/2 z-10 p-1">
              <Search className="w-6 h-6 text-gray-400 hover:text-white transition-colors" />
            </button>
            <input 
              type="text" 
              placeholder="Search textbooks, electronics, appliances..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#d9ff00] transition-all text-white placeholder:text-gray-400 font-medium text-lg"
            />
          </form>
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-3 mt-8 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide">
        <div className="p-2.5 bg-gray-100 rounded-xl mr-2">
          <Filter className="w-5 h-5 text-gray-900 flex-shrink-0" />
        </div>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${
              selectedCategory === category 
                ? 'bg-gray-900 text-[#d9ff00] shadow-md border-b-4 border-black' 
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-900 hover:text-black hover:shadow-sm'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm animate-pulse">
              <div className="w-full aspect-square bg-gray-200 rounded-xl mb-3 sm:mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-16 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute inset-0 bg-[#d9ff00]/10 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-full blur-xl"></div>
            <Search className="w-10 h-10 text-gray-400 relative z-10 group-hover:text-black transition-colors duration-300" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900 mb-3">No deals found</h3>
          <p className="text-gray-500 font-medium text-lg max-w-md mx-auto mb-8">We couldn&apos;t find any items matching your current filters. Try adjusting your search or explore other categories.</p>
          <button 
            onClick={() => { setInputValue(''); setSelectedCategory('All'); }}
            className="bg-black text-white px-8 py-4 rounded-full font-bold hover:scale-105 active:scale-[0.98] transition-transform shadow-xl shadow-black/10"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 mb-4">
          <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#d9ff00] animate-spin"></div>
        </div>
        <p className="text-gray-500 font-bold tracking-tight animate-pulse uppercase text-sm">Loading Marketplace</p>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
