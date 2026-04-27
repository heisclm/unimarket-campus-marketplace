'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, orderBy, onSnapshot, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, ShieldCheck, Package, DollarSign, Plus, LayoutDashboard, ShoppingBag, Truck, CheckCircle2, AlertCircle, History, MessageSquare, Clock, Trash2, Zap, Star } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { markOrderAsDelivered, confirmOrderReceipt, raiseOrderDispute } from '@/lib/escrow';
import { deleteImage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { user, role } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'listings' | 'purchases' | 'sales' | null;
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'listings' | 'purchases' | 'sales'>(initialTab || 'listings');

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
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side to avoid composite index requirement
        data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setProducts(data);
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
  const [productToPromote, setProductToPromote] = useState<any>(null);
  const [promoteDuration, setPromoteDuration] = useState<1 | 3 | 7>(3);

  const calculatePromotionCost = (price: number, days: number) => {
    return Math.max(10, Math.floor(price * 0.05 * days));
  };

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

  const handlePromoteProduct = async () => {
    if (!productToPromote || !user) return;
    try {
      const idToken = await user.getIdToken();
      let payload: any = { productId: productToPromote.id };

      // Vendors use value-based pricing with coins, standard users use flat fee
      if (role === 'vendor') {
        payload = {
          ...payload,
          duration: promoteDuration,
          cost: calculatePromotionCost(productToPromote.price || 0, promoteDuration),
          currency: 'coins'
        }
      }

      const res = await fetch('/api/products/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to promote product');
      }

      toast.success('Product successfully promoted!');
      setProductToPromote(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to promote product');
      setProductToPromote(null);
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
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.netAmount || s.amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3 w-full sm:w-auto">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-6 h-6 text-gray-900" />
          </div>
          {role === 'vendor' ? 'Vendor Dashboard' : 'My Dashboard'}
        </h1>
        <Link href="/products/new" className="w-full sm:w-auto bg-black text-[#d9ff00] px-8 py-3.5 rounded-full font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/10">
          <Plus className="w-5 h-5" /> New Listing
        </Link>
      </div>

      {/* Verification Banner */}
      {!userData?.isVerified ? (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-[2rem] p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-start md:items-center gap-4 lg:gap-6">
            <div className="bg-white p-4 rounded-full text-orange-500 flex-shrink-0 shadow-sm border border-orange-100">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">ID Verification Required</h3>
              <p className="text-gray-600 font-medium mt-1.5 max-w-xl">
                Verify your ID to build trust with buyers and unlock higher selling limits.
              </p>
            </div>
          </div>
          <Link 
            href="/profile?tab=verification"
            className="bg-orange-500 text-white px-8 py-3.5 rounded-full font-black uppercase tracking-widest hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all whitespace-nowrap w-full md:w-auto text-center shadow-lg shadow-orange-500/20"
          >
            Get Verified
          </Link>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-[2rem] p-6 lg:p-8 flex items-center gap-6 shadow-sm">
          <div className="bg-white p-4 rounded-full text-green-500 flex-shrink-0 shadow-sm border border-green-100">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Account Verified</h3>
            <p className="text-gray-600 font-medium mt-1.5">
              Your identity has been verified. Buyers will see a trusted badge on your profile and listings.
            </p>
          </div>
        </div>
      )}

      {/* View Switcher */}
      <div className="flex bg-gray-100/80 p-1.5 rounded-2xl shadow-inner w-full overflow-x-auto no-scrollbar scroll-smooth snap-x">
        <button 
          onClick={() => setActiveView('listings')}
          className={`flex-1 sm:flex-none snap-center whitespace-nowrap px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 ${activeView === 'listings' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}
        >
          My Listings
        </button>
        {role !== 'vendor' && (
          <button 
            onClick={() => setActiveView('purchases')}
            className={`flex-1 sm:flex-none snap-center whitespace-nowrap px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 ${activeView === 'purchases' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}
          >
            Purchases
          </button>
        )}
        <button 
          onClick={() => setActiveView('sales')}
          className={`flex-1 sm:flex-none snap-center whitespace-nowrap px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 ${activeView === 'sales' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black hover:bg-white/50'}`}
        >
          My Sales
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-gray-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
          <div className="relative z-10 flex items-center gap-3 text-gray-500 font-bold uppercase tracking-widest text-xs mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-gray-900" />
            </div>
            Active Listings
          </div>
          <div className="relative z-10 text-4xl lg:text-5xl font-black tracking-tighter text-gray-900">{activeListings}</div>
        </div>
        {role !== 'vendor' && (
          <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gray-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <div className="relative z-10 flex items-center gap-3 text-gray-500 font-bold uppercase tracking-widest text-xs mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-gray-900" />
              </div>
              Total Purchases
            </div>
            <div className="relative z-10 text-4xl lg:text-5xl font-black tracking-tighter text-gray-900">{purchases.length}</div>
          </div>
        )}
        {role === 'vendor' && (
          <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#d9ff00]/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <div className="relative z-10 flex items-center gap-3 text-gray-500 font-bold uppercase tracking-widest text-xs mb-4">
              <div className="w-10 h-10 rounded-full bg-[#d9ff00]/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange-500" />
              </div>
              Promoted Listings
            </div>
            <div className="relative z-10 text-4xl lg:text-5xl font-black tracking-tighter text-gray-900">{products.filter(p => p.isSponsored).length}</div>
          </div>
        )}
        <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
          <div className="relative z-10 flex items-center gap-3 text-gray-500 font-bold uppercase tracking-widest text-xs mb-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            Total Revenue
          </div>
          <div className="relative z-10 text-4xl lg:text-5xl font-black tracking-tighter text-gray-900"><span className="text-2xl text-gray-400 mr-1">GH₵</span>{totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
          <div className="relative z-10 flex items-center gap-3 text-gray-500 font-bold uppercase tracking-widest text-xs mb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            My Coins
          </div>
          <div className="relative z-10 text-4xl lg:text-5xl font-black tracking-tighter text-gray-900">{userData?.coins || 0}</div>
          <p className="relative z-10 text-xs font-bold text-gray-400 mt-3 uppercase tracking-widest">100 Coins = GH₵0.5</p>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-gray-100">
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
                            {product.status === 'active' && !product.isSponsored && (
                              <button onClick={() => setProductToPromote(product)} className="text-sm font-semibold text-[#b8d900] hover:text-[#d9ff00] bg-black px-2 py-1 rounded-md transition-colors flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Promote
                              </button>
                            )}
                            {product.isSponsored && (
                              <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-md">Promoted</span>
                            )}
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
                        <h4 className="font-bold text-lg">{order.productTitle || 'Product Purchase'} {order.quantity > 1 ? `(x${order.quantity})` : ''}</h4>
                        <p className="text-sm text-gray-500">Order ID: #{order.id?.slice(0, 8)} • GH₵{Number(order.amount || 0).toFixed(2)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'disputed' ? 'bg-red-100 text-red-700' :
                            order.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {order.status?.replace('_', ' ') || 'UNKNOWN'}
                          </span>
                          {order.status === 'escrow_held' && (
                            <span className="text-[10px] text-gray-400 font-medium italic flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Funds held securely
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <Link
                        href={`/dashboard/messages?chatId=${order.id}`}
                        className="flex-1 md:flex-none border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" /> Message Seller
                      </Link>
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
                        <h4 className="font-bold text-lg">{order.productTitle || 'Product Sale'} {order.quantity > 1 ? `(x${order.quantity})` : ''}</h4>
                        <p className="text-sm text-gray-500">Order ID: #{order.id?.slice(0, 8)} • GH₵{Number(order.amount || 0).toFixed(2)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'disputed' ? 'bg-red-100 text-red-700' :
                            order.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {order.status?.replace('_', ' ') || 'UNKNOWN'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <Link
                        href={`/dashboard/messages?chatId=${order.id}`}
                        className="flex-1 md:flex-none border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" /> Message Buyer
                      </Link>
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

      {/* Promote Modal */}
      {productToPromote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><Zap className="w-6 h-6 text-[#d9ff00] bg-black rounded-md p-1"/> Promote Listing</h3>
            <p className="text-gray-600 mb-6">
              Promote <span className="font-bold text-black">{productToPromote.title}</span> to the homepage highlight section. 
            </p>
            
            {role === 'vendor' && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Select Duration</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 3, 7].map((days) => (
                    <button
                      key={days}
                      onClick={() => setPromoteDuration(days as 1 | 3 | 7)}
                      className={`py-2 rounded-xl text-sm font-bold border transition-colors ${
                        promoteDuration === days 
                          ? 'border-black bg-black text-[#d9ff00]' 
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {days} Day{days > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl mb-8 flex justify-between items-center">
              <div>
                 <p className="font-semibold text-gray-900">Featured Placement</p>
                 <p className="text-xs text-gray-500">{role === 'vendor' ? promoteDuration : 7} Days duration</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {role === 'vendor' ? `${calculatePromotionCost(productToPromote.price || 0, promoteDuration)} Coins` : 'GH₵ 50.00'}
                </div>
                {role === 'vendor' && <div className="text-xs font-semibold text-orange-500">Value-based pricing</div>}
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setProductToPromote(null)}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePromoteProduct}
                className="flex-1 bg-black text-[#d9ff00] px-6 py-3 rounded-xl font-bold hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Pay & Promote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
