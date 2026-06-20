import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, MessageSquare, Package, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

export default function CheckoutSuccess({ items, deliveryMethod = 'pickup' }: { items: any[], deliveryMethod?: 'pickup' | 'rider' }) {
  const [groupedOrders, setGroupedOrders] = useState<Record<string, { sellerName: string, items: any[] }>>({});

  useEffect(() => {
    const fetchSellers = async () => {
      const grouped: Record<string, { sellerName: string, items: any[] }> = {};
      for (const item of items) {
        if (!grouped[item.sellerId]) {
          try {
            const res = await fetch(`/api/users/${item.sellerId}/public`);
            if (res.ok) {
              const sellerData = await res.json();
              grouped[item.sellerId] = { sellerName: sellerData.displayName || 'Seller', items: [] };
            } else {
               grouped[item.sellerId] = { sellerName: 'Seller', items: [] };
            }
          } catch (e) {
            grouped[item.sellerId] = { sellerName: 'Seller', items: [] };
          }
        }
        grouped[item.sellerId].items.push(item);
      }
      setGroupedOrders(grouped);
    };
    if (items && items.length > 0) {
      fetchSellers();
    }
  }, [items]);

  const sellerGroups = Object.keys(groupedOrders);

  if (sellerGroups.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-[2rem] p-10 shadow-sm text-center border border-green-50">
        <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold mb-4 tracking-tight">Checkout Successful!</h1>
        <p className="text-gray-500 mb-2 leading-relaxed text-lg">
          Your funds are now securely held in escrow.
        </p>
        <p className="text-gray-900 font-medium bg-gray-50 inline-block px-4 py-2 rounded-xl mt-2">
          {deliveryMethod === 'rider'
            ? 'Step 2: Your order is on the Campus Deliveries board. A rider will contact you soon!'
            : 'Step 2: Please arrange delivery with your sellers below.'}
        </p>
      </div>

      <div className="space-y-4">
        {sellerGroups.map(sellerId => {
          const group = groupedOrders[sellerId];
          const firstItem = group.items[0];
          return (
            <div key={sellerId} className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-50">
                <div>
                  <h3 className="font-bold text-xl text-gray-900">Order from {group.sellerName}</h3>
                  <p className="text-sm text-gray-400 font-medium">{group.items.length} item(s)</p>
                </div>
                
                <Link 
                  href={`/dashboard/messages?sellerId=${sellerId}&productId=${firstItem.id}&autoSend=true&initMessage=${encodeURIComponent(deliveryMethod === 'rider' ? `Hi! I just purchased ${firstItem.title} and funds are in escrow. I've requested a campus rider, so they will contact us soon for pickup!` : `Hi! I just purchased ${firstItem.title} and funds are in escrow. When can we meet for delivery?`)}`}
                  className="bg-[#d9ff00] text-black px-6 py-3 rounded-full font-bold hover:bg-[#c4e600] transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-sm hover:scale-105 active:scale-95"
                >
                  <MessageSquare className="w-5 h-5" /> Message Seller
                </Link>
              </div>

              <div className="space-y-3">
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="w-12 h-12 bg-white flex items-center justify-center rounded-lg shadow-sm text-gray-400">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 leading-tight">{item.title}</p>
                      <p className="text-sm text-gray-500 font-bold">GH₵{Number(item.price).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-8">
        <Link href="/products" className="inline-block text-gray-400 font-bold hover:text-black transition-colors px-6 py-3">
          Return to Marketplace
        </Link>
      </div>
    </div>
  );
}
