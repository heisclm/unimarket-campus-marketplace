'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, addDoc, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { Store, Package, DollarSign, CheckCircle2, Clock, Trash2, Plus, ExternalLink, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { deleteImage } from '@/lib/storage';

export default function VendorDashboard() {
  const { user, role, userData, refreshUserData } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders'>('overview');

  useEffect(() => {
    if (!user || role !== 'vendor') return;

    const productsQuery = query(collection(db, 'products'), where('sellerId', '==', user.uid));
    const ordersQuery = query(collection(db, 'orders'), where('sellerId', '==', user.uid));

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid composite index requirement
      data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOrders(data);
      setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, [user, role]);

  const handleMarkDelivered = async (order: any) => {
    if (order.status !== 'escrow_held') return;

    try {
      // Just mark as delivered. Escrow release happens when buyer confirms.
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'delivered',
        updatedAt: serverTimestamp()
      });

      toast.success('Order marked as delivered. Awaiting buyer confirmation.');
    } catch (error) {
      console.error("Failed to mark delivered", error);
      toast.error('Failed to update order status');
    }
  };

  const [productToDelete, setProductToDelete] = useState<any>(null);

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      // Delete images from storage
      if (productToDelete.images && productToDelete.images.length > 0) {
        for (const url of productToDelete.images) {
          await deleteImage(url);
        }
      }
      
      await deleteDoc(doc(db, 'products', productToDelete.id));
      toast.success('Product deleted');
      setProductToDelete(null);
    } catch (error) {
      toast.error('Failed to delete product');
      setProductToDelete(null);
    }
  };

  if (role !== 'vendor') {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-12 shadow-sm text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-500 mb-8">Only vendors can access this dashboard.</p>
        <Link href="/profile" className="bg-black text-white px-8 py-3 rounded-full font-bold">Go to Profile</Link>
      </div>
    );
  }

  const totalEarnings = orders.filter(o => o.status === 'delivered').reduce((acc, o) => acc + o.amount, 0);
  const pendingEscrow = orders.filter(o => o.status === 'escrow_held').reduce((acc, o) => acc + o.amount, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Dashboard</h1>
          <p className="text-gray-500">Manage your shop, products, and earnings.</p>
        </div>
        <Link href="/products/new" className="bg-[#d9ff00] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#c4e600] transition-all flex items-center gap-2 shadow-sm">
          <Plus className="w-5 h-5" />
          Add New Product
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Total Earnings</p>
          <p className="text-3xl font-bold">GH₵{totalEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Pending Escrow</p>
          <p className="text-3xl font-bold">GH₵{pendingEscrow.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4">
            <Package className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Active Products</p>
          <p className="text-3xl font-bold">{products.filter(p => p.status === 'active').length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'products' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Products
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Orders
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50">
              <h3 className="font-bold text-lg mb-6">Recent Orders</h3>
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <p className="text-gray-400 text-center py-8 italic">No orders yet.</p>
                ) : (
                  orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                      <div>
                        <p className="font-bold text-sm">Order #{order.id.slice(0, 6)}</p>
                        <p className="text-xs text-gray-500">GH₵{order.amount.toFixed(2)} • {order.status}</p>
                      </div>
                      {order.status === 'escrow_held' && (
                        <button 
                          onClick={() => handleMarkDelivered(order)}
                          className="text-xs font-bold bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50">
              <h3 className="font-bold text-lg mb-6">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <Link href="/products/new" className="p-6 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors text-center group">
                  <Plus className="w-6 h-6 mx-auto mb-2 text-gray-400 group-hover:text-black" />
                  <p className="font-bold text-sm">Add Product</p>
                </Link>
                <Link href="/profile" className="p-6 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors text-center group">
                  <DollarSign className="w-6 h-6 mx-auto mb-2 text-gray-400 group-hover:text-black" />
                  <p className="font-bold text-sm">View Wallet</p>
                </Link>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-4 font-bold text-sm text-gray-400 uppercase tracking-widest">Product</th>
                    <th className="pb-4 font-bold text-sm text-gray-400 uppercase tracking-widest">Price</th>
                    <th className="pb-4 font-bold text-sm text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="pb-4 font-bold text-sm text-gray-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map(product => (
                    <tr key={product.id} className="group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-xl relative overflow-hidden">
                            {(product.previewImage || product.images?.[0]) && <Image src={product.previewImage || product.images[0]} alt={product.title} fill className="object-cover" referrerPolicy="no-referrer" />}
                          </div>
                          <span className="font-bold text-sm">{product.title}</span>
                        </div>
                      </td>
                      <td className="py-4 font-bold text-sm">GH₵{product.price.toFixed(2)}</td>
                      <td className="py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/products/${product.id}`} className="p-2 text-gray-400 hover:text-black transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button onClick={() => setProductToDelete(product)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50">
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gray-50 rounded-[2rem] gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-500">Amount: GH₵{order.amount.toFixed(2)} • Method: {order.deliveryMethod}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    {order.status === 'escrow_held' && (
                      <button 
                        onClick={() => handleMarkDelivered(order)}
                        className="bg-black text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all"
                      >
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
