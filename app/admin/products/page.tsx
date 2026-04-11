'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, limit } from 'firebase/firestore';
import { Package, Search, Trash2, ExternalLink, Tag, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { deleteImage } from '@/lib/storage';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const [productToDelete, setProductToDelete] = useState<any>(null);

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      if (productToDelete.images && productToDelete.images.length > 0) {
        for (const url of productToDelete.images) {
          await deleteImage(url);
        }
      }
      await deleteDoc(doc(db, 'products', productToDelete.id));
      toast.success('Product deleted successfully');
      setProductToDelete(null);
    } catch (error) {
      toast.error('Failed to delete product');
      setProductToDelete(null);
    }
  };

  const filteredProducts = products.filter(p => 
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sellerId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Product Catalog</h1>
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search products or sellers..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-black outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Product</th>
                <th className="px-8 py-6">Seller</th>
                <th className="px-8 py-6">Price/Type</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden relative border border-gray-100">
                        {p.previewImage || p.images?.[0] ? (
                          <Image src={p.previewImage || p.images[0]} alt={p.title} fill className="object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package className="w-6 h-6 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 line-clamp-1">{p.title}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-medium text-gray-600">ID: {p.sellerId?.slice(0, 8)}...</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">GH₵{Number(p.price).toFixed(2)}</span>
                      <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${p.type === 'auction' ? 'text-orange-500' : 'text-blue-500'}`}>
                        {p.type === 'auction' ? <Clock className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
                        {p.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${
                      p.status === 'active' ? 'bg-green-100 text-green-700' : 
                      p.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {p.status === 'pending' && (
                        <button 
                          onClick={async () => {
                            try {
                              const { updateDoc, doc } = await import('firebase/firestore');
                              await updateDoc(doc(db, 'products', p.id), { status: 'active' });
                              toast.success('Product approved!');
                            } catch (e) {
                              toast.error('Approval failed');
                            }
                          }}
                          className="p-2 text-green-500 hover:bg-green-50 rounded-xl transition-all"
                          title="Approve Product"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      <Link 
                        href={`/products/${p.id}`}
                        target="_blank"
                        className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all"
                        title="View Listing"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Link>
                      <button 
                        onClick={() => setProductToDelete(p)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Product"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Delete Product</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to delete <span className="font-bold text-black">{productToDelete.title}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setProductToDelete(null)}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteProduct}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
