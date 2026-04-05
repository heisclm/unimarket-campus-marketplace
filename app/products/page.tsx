'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Filter, Clock, Tag, ShieldCheck } from 'lucide-react';

import { Suspense } from 'react';

function ProductsContent() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search');
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState(urlSearch || '');
  const [searchTerm, setSearchTerm] = useState(urlSearch || '');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const router = useRouter();

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

  const categories = ['All', 'Electronics', 'Books', 'Clothing', 'Services', 'Other'];

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
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
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
              <div className="w-full h-48 bg-gray-200 rounded-xl mb-4"></div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <Link href={`/products/${product.id}`} key={product.id} className="bg-white rounded-2xl p-4 shadow-sm group hover:shadow-md transition-all flex flex-col">
              <div className="relative w-full h-48 bg-gray-100 rounded-xl mb-4 overflow-hidden">
                {product.previewImage || (product.images && product.images.length > 0) ? (
                  <Image 
                    src={product.previewImage || product.images[0]} 
                    alt={product.title} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                )}
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-2">
                  {product.type === 'auction' && (
                    <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      <Clock className="w-3 h-3" /> Auction
                    </span>
                  )}
                  {product.sellerIsVerified && (
                    <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      <ShieldCheck className="w-3 h-3" /> Verified Seller
                    </span>
                  )}
                  <span className="bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium px-2 py-1 rounded-md shadow-sm">
                    {product.category}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <h3 className="font-semibold text-lg line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">{product.title}</h3>
                <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-1">{product.description}</p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-1 text-lg font-bold">
                    <Tag className="w-4 h-4 text-gray-400" />
                    GH₵{Number(product.price).toFixed(2)}
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md capitalize">
                    {product.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
