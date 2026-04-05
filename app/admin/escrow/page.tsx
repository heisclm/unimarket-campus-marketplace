'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { ShieldCheck, Clock, CheckCircle, AlertCircle, Search, Filter, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { adminReleaseEscrow, adminRefundEscrow } from '@/lib/escrow';
import toast from 'react-hot-toast';

export default function EscrowManagement() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [orderToRelease, setOrderToRelease] = useState<string | null>(null);
  const [releaseNote, setReleaseNote] = useState('');

  const handleManualRelease = async () => {
    if (!orderToRelease || !releaseNote.trim()) return;
    setIsProcessing(true);
    try {
      await adminReleaseEscrow(orderToRelease, releaseNote);
      toast.success('Funds released successfully');
      setOrderToRelease(null);
      setReleaseNote('');
    } catch (error: any) {
      toast.error(error.message || 'Release failed');
      setOrderToRelease(null);
      setReleaseNote('');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Escrow Management</h1>
            <p className="text-gray-500 mt-1">Monitor and resolve escrow-held funds.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] shadow-sm border border-gray-50">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by order ID or product..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-5 h-5 text-gray-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 md:flex-none px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black transition-all font-bold text-sm"
          >
            <option value="all">All Status</option>
            <option value="escrow_held">Escrow Held</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Created At</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-gray-300 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">
                    No orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{order.productTitle}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">ID: {order.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-black">GH₵{order.amount.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        order.status === 'completed' ? 'text-green-600 bg-green-50 border-green-100' :
                        order.status === 'disputed' ? 'text-red-600 bg-red-50 border-red-100' :
                        'text-blue-600 bg-blue-50 border-blue-100'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.createdAt?.toDate?.().toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(order.status === 'escrow_held' || order.status === 'delivered' || order.status === 'disputed') && (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setOrderToRelease(order.id)}
                            className="px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors shadow-sm"
                          >
                            Release
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Release Modal */}
      {orderToRelease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Manual Release</h3>
            <p className="text-gray-600 mb-4">
              Enter a reason for manually releasing the funds to the seller.
            </p>
            <textarea
              value={releaseNote}
              onChange={(e) => setReleaseNote(e.target.value)}
              placeholder="Reason for release..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 focus:outline-none focus:ring-2 focus:ring-black min-h-[120px]"
            />
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setOrderToRelease(null);
                  setReleaseNote('');
                }}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                onClick={handleManualRelease}
                disabled={!releaseNote.trim() || isProcessing}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
