'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, Package, DollarSign, Plus, LayoutDashboard, ShoppingBag, Truck, CheckCircle2, AlertCircle, History, MessageSquare, Clock, Trash2 } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { markOrderAsDelivered, confirmOrderReceipt, raiseOrderDispute } from '@/lib/escrow';
import { deleteImage } from '@/lib/storage';

export default function DashboardPage() {
  const { user, role } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'listings' | 'purchases' | 'sales'>('listings');

  useEffect(() => {
    if (!user) return;

    // Real-time listener for user data
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) setUserData(doc.data());
    });

    // Real-time listener for user's products
    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('sellerId', '==', user.uid)),
      (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    // Real-time listener for purchases
    const unsubPurchases = onSnapshot(
      query(collection(db, 'orders'), where('buyerId', '==', user.uid)),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side to avoid composite index requirement
        data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setPurchases(data);
      }
    );

    // Real-time listener for sales
    const unsubSales = onSnapshot(
      query(collection(db, 'orders'), where('sellerId', '==', user.uid)),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side to avoid composite index requirement
        data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setSales(data);
        setLoading(false);
      }
    );

    return () => {
      unsubUser();
      unsubProducts();
      unsubPurchases();
      unsubSales();
    };
  }, [user]);

  const handleMarkDelivered = async (orderId: string) => {
    if (!user) return;
    try {
      await markOrderAsDelivered(orderId, user.uid);
      toast.success('Order marked as delivered!');
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    }
  };

  const [orderToConfirm, setOrderToConfirm] = useState<string | null>(null);
  const [orderToDispute, setOrderToDispute] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
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

  const handleConfirmReceipt = async () => {
    if (!user || !orderToConfirm) return;
    try {
      await confirmOrderReceipt(orderToConfirm, user.uid);
      toast.success('Order completed! Funds released.');
      setOrderToConfirm(null);
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
      setOrderToConfirm(null);
    }
  };

  const handleDispute = async () => {
    if (!user || !orderToDispute || !disputeReason.trim()) return;
    try {
      await raiseOrderDispute(orderToDispute, user.uid, disputeReason);
      toast.success('Dispute raised. Admin will review shortly.');
      setOrderToDispute(null);
      setDisputeReason('');
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
      setOrderToDispute(null);
      setDisputeReason('');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
        <p className="text-gray-500 mb-4">Please log in to view your dashboard.</p>
        <Link href="/profile" className="bg-black text-white px-6 py-2 rounded-full font-medium">Go to Login</Link>
      </div>
    );
  }

  const activeListings = products.filter(p => p.status === 'active').length;
  const soldListings = products.filter(p => p.status === 'sold').length;
  const totalRevenue = products.filter(p => p.status === 'sold').reduce((sum, p) => sum + Number(p.price), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-gray-400" /> 
          {role === 'vendor' ? 'Vendor Dashboard' : 'Seller Dashboard'}
        </h1>
        <Link href="/products/new" className="bg-[#d9ff00] text-black px-6 py-2.5 rounded-full font-semibold hover:bg-[#c4e600] transition-colors flex items-center gap-2">
          <Plus className="w-5 h-5" /> New Listing
        </Link>
      </div>

      {/* Verification Banner */}
      {!userData?.isVerified ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-orange-100 p-3 rounded-full text-orange-600 flex-shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-orange-900">ID Verification Required</h3>
              <p className="text-orange-700 text-sm mt-1">
                Verify your University ID or Vendor License to build trust with buyers and unlock higher selling limits.
              </p>
            </div>
          </div>
          <Link 
            href="/profile?tab=verification"
            className="bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-700 transition-colors whitespace-nowrap w-full md:w-auto text-center"
          >
            Get Verified
          </Link>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-full text-green-600 flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-green-900">Account Verified</h3>
            <p className="text-green-700 text-sm mt-1">
              Your identity has been verified. Buyers will see a trusted badge on your profile and listings.
            </p>
          </div>
        </div>
      )}

      {/* View Switcher */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 w-fit">
        <button 
          onClick={() => setActiveView('listings')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeView === 'listings' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'}`}
        >
          My Listings
        </button>
        {role !== 'vendor' && (
          <button 
            onClick={() => setActiveView('purchases')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeView === 'purchases' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'}`}
          >
            My Purchases
          </button>
        )}
        <button 
          onClick={() => setActiveView('sales')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeView === 'sales' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-black'}`}
        >
          My Sales
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <Package className="w-5 h-5" /> Active Listings
          </div>
          <div className="text-3xl font-bold">{activeListings}</div>
        </div>
        {role !== 'vendor' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 text-gray-500 mb-2">
              <ShoppingBag className="w-5 h-5" /> Total Purchases
            </div>
            <div className="text-3xl font-bold">{purchases.length}</div>
          </div>
        )}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <DollarSign className="w-5 h-5" /> Total Revenue
          </div>
          <div className="text-3xl font-bold">GH₵{totalRevenue.toFixed(2)}</div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm">
        {activeView === 'listings' && (
          <>
            <h2 className="text-xl font-bold mb-6">Your Listings</h2>
            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">You haven&apos;t listed any products yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-sm">
                      <th className="pb-4 font-medium">Product</th>
                      <th className="pb-4 font-medium">Type</th>
                      <th className="pb-4 font-medium">Price</th>
                      <th className="pb-4 font-medium">Status</th>
                      <th className="pb-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => (
                      <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg relative overflow-hidden flex-shrink-0">
                              {product.previewImage || product.images?.[0] ? (
                                <Image src={product.previewImage || product.images[0]} alt={product.title} fill className="object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Package className="w-6 h-6 text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                              )}
                            </div>
                            <span className="font-semibold line-clamp-1">{product.title}</span>
                          </div>
                        </td>
                        <td className="py-4 capitalize text-gray-600">{product.type}</td>
                        <td className="py-4 font-medium">GH₵{Number(product.price).toFixed(2)}</td>
                        <td className="py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                            product.status === 'active' ? 'bg-green-100 text-green-700' : 
                            product.status === 'sold' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link href={`/products/${product.id}/edit`} className="text-sm font-semibold text-gray-500 hover:text-black transition-colors">Edit</Link>
                            <Link href={`/products/${product.id}`} className="text-sm font-semibold text-blue-600 hover:underline">View</Link>
                            <button onClick={() => setProductToDelete(product)} className="text-sm font-semibold text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeView === 'purchases' && (
          <>
            <h2 className="text-xl font-bold mb-6">My Purchases (Escrow Tracking)</h2>
            {purchases.length === 0 ? (
              <div className="text-center py-12 text-gray-500">You haven&apos;t bought anything yet.</div>
            ) : (
              <div className="space-y-4">
                {purchases.map(order => (
                  <div key={order.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{order.productTitle || 'Product Purchase'}</h4>
                        <p className="text-sm text-gray-500">Order ID: #{order.id.slice(0, 8)} • GH₵{order.amount.toFixed(2)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'disputed' ? 'bg-red-100 text-red-700' :
                            order.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {order.status.replace('_', ' ')}
                          </span>
                          {order.status === 'escrow_held' && (
                            <span className="text-[10px] text-gray-400 font-medium italic flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Funds held securely
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {order.status === 'delivered' && (
                        <button 
                          onClick={() => setOrderToConfirm(order.id)}
                          className="flex-1 md:flex-none bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Confirm Receipt
                        </button>
                      )}
                      {(order.status === 'escrow_held' || order.status === 'delivered') && (
                        <button 
                          onClick={() => setOrderToDispute(order.id)}
                          className="flex-1 md:flex-none bg-white text-red-600 border border-red-100 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                        >
                          <AlertCircle className="w-4 h-4" /> Dispute
                        </button>
                      )}
                      {order.status === 'completed' && (
                        <div className="text-green-600 font-bold text-sm flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl">
                          <CheckCircle2 className="w-4 h-4" /> Transaction Complete
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'sales' && (
          <>
            <h2 className="text-xl font-bold mb-6">My Sales (Escrow Management)</h2>
            {sales.length === 0 ? (
              <div className="text-center py-12 text-gray-500">You haven&apos;t sold anything yet.</div>
            ) : (
              <div className="space-y-4">
                {sales.map(order => (
                  <div key={order.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm">
                        <History className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{order.productTitle || 'Product Sale'}</h4>
                        <p className="text-sm text-gray-500">Order ID: #{order.id.slice(0, 8)} • GH₵{order.amount.toFixed(2)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'disputed' ? 'bg-red-100 text-red-700' :
                            order.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {order.status === 'escrow_held' && (
                        <button 
                          onClick={() => handleMarkDelivered(order.id)}
                          className="flex-1 md:flex-none bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Truck className="w-4 h-4" /> Mark as Delivered
                        </button>
                      )}
                      {order.status === 'delivered' && (
                        <div className="text-blue-600 font-bold text-sm flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl">
                          <Clock className="w-4 h-4" /> Awaiting Buyer Confirmation
                        </div>
                      )}
                      {order.status === 'disputed' && (
                        <div className="text-red-600 font-bold text-sm flex items-center gap-2 bg-red-50 px-4 py-2 rounded-xl">
                          <AlertCircle className="w-4 h-4" /> Under Dispute Review
                        </div>
                      )}
                      {order.status === 'completed' && (
                        <div className="text-green-600 font-bold text-sm flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl">
                          <CheckCircle2 className="w-4 h-4" /> Funds Released
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm Receipt Modal */}
      {orderToConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Confirm Receipt</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you have received the item? This will release funds to the seller and cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setOrderToConfirm(null)}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmReceipt}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {orderToDispute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Raise a Dispute</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for the dispute. An admin will review your case.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Explain the issue..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 focus:outline-none focus:ring-2 focus:ring-black min-h-[120px]"
            />
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setOrderToDispute(null);
                  setDisputeReason('');
                }}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDispute}
                disabled={!disputeReason.trim()}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
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
