'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
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
  });

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="bg-white rounded-[2rem] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
            <p className="text-gray-500">Discover items from students and vendors.</p>
          </div>
          
          <form 
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-md w-full relative"
          >
            <button type="submit" className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-1">
              <Search className="w-5 h-5 text-gray-400 hover:text-black transition-colors" />
            </button>
            <input 
              type="text" 
              placeholder="Search products..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </form>
          
          <Link href="/products/new" className="bg-[#d9ff00] text-black font-semibold px-6 py-3 rounded-full hover:bg-[#c4e600] transition-colors whitespace-nowrap">
            + List Item
          </Link>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-3 mt-8 overflow-x-auto pb-2 scrollbar-hide">
          <Filter className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category 
                  ? 'bg-black text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
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
        <div className="bg-white rounded-[2rem] p-12 shadow-sm text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">No products found</h3>
          <p className="text-gray-500">Try adjusting your search or category filter.</p>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p>Loading Marketplace...</p>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
