'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { Package, MessageSquare, CheckCircle, Clock, AlertCircle, ExternalLink, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { confirmOrderReceipt, raiseOrderDispute } from '@/lib/escrow';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const ChatModal = dynamic(() => import('./ChatModal'), { ssr: false });

export default function OrdersSection() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatOrder, setActiveChatOrder] = useState<any>(null);
  const [filter, setFilter] = useState<'buying' | 'selling'>('buying');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where(filter === 'buying' ? 'buyerId' : 'sellerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid index requirement
      ordersData.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, filter]);

  const handleConfirmReceipt = async (orderId: string) => {
    if (!user) return;
    try {
      await confirmOrderReceipt(orderId, user.uid);
      toast.success('Order completed! Funds released to seller.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm receipt');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-100';
      case 'escrow_held': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'delivered': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'disputed': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'escrow_held': return <Clock className="w-4 h-4" />;
      case 'delivered': return <Package className="w-4 h-4" />;
      case 'disputed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setFilter('buying')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filter === 'buying' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Buying
          </button>
          <button 
            onClick={() => setFilter('selling')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filter === 'selling' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Selling
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-50 animate-pulse rounded-2xl"></div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No orders found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 group-hover:text-black transition-colors">{order.productTitle}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold text-black">GH₵{order.amount.toFixed(2)}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-gray-500">{order.createdAt?.toDate?.().toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {order.status.replace('_', ' ')}
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setActiveChatOrder(order)}
                      className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                      title="Chat with Seller"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>

                    {filter === 'buying' && (order.status === 'escrow_held' || order.status === 'delivered') && (
                      <button 
                        onClick={() => handleConfirmReceipt(order.id)}
                        className="px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors shadow-sm"
                      >
                        Confirm Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeChatOrder && (
        <ChatModal 
          order={activeChatOrder} 
          onClose={() => setActiveChatOrder(null)} 
        />
      )}
    </div>
  );
}
