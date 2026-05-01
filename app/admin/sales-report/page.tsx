'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { ShoppingBag, Search, CheckCircle2, Coins, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function AdminSalesReport() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch only completed orders to show sales
    const unsub = onSnapshot(query(collection(db, 'orders'), where('status', '==', 'completed'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredOrders = orders.filter(o => 
    o.id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.buyerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.sellerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.productTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateTotalSales = () => {
    return filteredOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
  };

  const calculateTotalFees = () => {
    // Assuming a 5% platform fee for demonstration, or we can fetch true fee if stored
    return filteredOrders.reduce((sum, order) => sum + ((Number(order.amount) || 0) * 0.05), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col flex-wrap sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sales Report</h1>
          <p className="text-sm text-gray-500">Monitor completed transactions and revenue.</p>
        </div>
        <div className="relative w-full sm:w-80">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-50 text-green-500 rounded-2xl">
              <Coins className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-500">Total Sales Value</h3>
          </div>
          <p className="text-3xl font-black">GH₵{calculateTotalSales().toFixed(2)}</p>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-50 text-purple-500 rounded-2xl">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-500">Estimated Revenue (5% Fee)</h3>
          </div>
          <p className="text-3xl font-black">GH₵{calculateTotalFees().toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Order / Product</th>
                <th className="px-8 py-6">Buyer / Seller</th>
                <th className="px-8 py-6">Amount</th>
                <th className="px-8 py-6">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-10 text-center text-gray-500">
                    No sales records found.
                  </td>
                </tr>
              ) : filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-500">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-gray-900 block truncate">#{o.id?.slice(0, 8)}</span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider truncate block">{o.productTitle || 'Product'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-500 truncate mt-1">B: {o.buyerId?.slice(0, 8)}...</span>
                      <span className="text-xs font-bold text-gray-500 truncate mt-1">S: {o.sellerId?.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-1 font-bold text-gray-900">
                      <span className="text-green-600">GH₵</span>
                      {Number(o.amount).toFixed(2)}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-start gap-2">
                      <span className="text-xs text-gray-500 font-medium">
                        {o.createdAt?.toDate?.().toLocaleString() || 'Just now'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
