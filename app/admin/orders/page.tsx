'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { ShoppingBag, Search, ShieldCheck, Clock, CheckCircle2, AlertCircle, Coins, ArrowUpRight, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminReleaseEscrow, adminRefundEscrow } from '@/lib/escrow';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const [orderToRelease, setOrderToRelease] = useState<string | null>(null);
  const [orderToRefund, setOrderToRefund] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const handleAdminRelease = async () => {
    if (!orderToRelease || !adminNote.trim()) return;
    try {
      await adminReleaseEscrow(orderToRelease, adminNote);
      toast.success('Escrow released to seller');
      setOrderToRelease(null);
      setAdminNote('');
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
      setOrderToRelease(null);
      setAdminNote('');
    }
  };

  const handleAdminRefund = async () => {
    if (!orderToRefund || !adminNote.trim()) return;
    try {
      await adminRefundEscrow(orderToRefund, adminNote);
      toast.success('Escrow refunded to buyer');
      setOrderToRefund(null);
      setAdminNote('');
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
      setOrderToRefund(null);
      setAdminNote('');
    }
  };

  const filteredOrders = orders.filter(o => 
    o.id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.buyerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.sellerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.productTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'escrow_held':
        return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Escrow Held</span>;
      case 'delivered':
        return <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3" /> Delivered</span>;
      case 'completed':
        return <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case 'disputed':
        return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Disputed</span>;
      case 'refunded':
        return <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Refunded</span>;
      case 'cancelled':
        return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Cancelled</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3" /> {status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Order Monitoring</h1>
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search Order ID, Buyer, or Seller..." 
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
                <th className="px-8 py-6">Order / Product</th>
                <th className="px-8 py-6">Buyer / Seller</th>
                <th className="px-8 py-6">Amount</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block">#{o.id?.slice(0, 8)}</span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{o.productTitle || 'Product'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-500">B: {o.buyerId?.slice(0, 8)}...</span>
                      <span className="text-xs font-bold text-gray-500">S: {o.sellerId?.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-1 font-bold text-gray-900">
                      <span className="text-green-600">GH₵</span>
                      {Number(o.amount).toFixed(2)}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {getStatusBadge(o.status)}
                    {o.status === 'disputed' && (
                      <p className="text-[10px] text-red-500 mt-1 font-medium italic">Reason: {o.disputeReason}</p>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {o.status === 'disputed' && (
                        <>
                          <button 
                            onClick={() => setOrderToRelease(o.id)}
                            className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                            title="Release to Seller"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setOrderToRefund(o.id)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title="Refund to Buyer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <span className="text-[10px] text-gray-400 font-medium">
                        {o.createdAt?.toDate?.().toLocaleDateString() || 'Just now'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Release Modal */}
      {orderToRelease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Release Escrow</h3>
            <p className="text-gray-600 mb-4">
              Enter an admin note for releasing the funds to the seller.
            </p>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Admin note..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 focus:outline-none focus:ring-2 focus:ring-black min-h-[120px]"
            />
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setOrderToRelease(null);
                  setAdminNote('');
                }}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdminRelease}
                disabled={!adminNote.trim()}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Release
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {orderToRefund && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Refund Escrow</h3>
            <p className="text-gray-600 mb-4">
              Enter an admin note for refunding the funds to the buyer.
            </p>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Admin note..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 focus:outline-none focus:ring-2 focus:ring-black min-h-[120px]"
            />
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setOrderToRefund(null);
                  setAdminNote('');
                }}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdminRefund}
                disabled={!adminNote.trim()}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
