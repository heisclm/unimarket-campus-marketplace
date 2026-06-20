'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { MapPin, Package, Clock, ShieldCheck, CheckCircle2, Navigation, MessageSquare, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function DeliveriesPage() {
  const { user, userData } = useAuth();
  const [availableDeliveries, setAvailableDeliveries] = useState<any[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchDeliveries();
  }, [user]);

  const fetchDeliveries = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/deliveries', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch deliveries');
      }

      const data = await res.json();
      setAvailableDeliveries(data.available || []);
      setMyDeliveries(data.myDeliveries || []);
    } catch (e) {
      console.error("Error fetching deliveries:", e);
      toast.error("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  const handleOfferDelivery = async (orderId: string, buyerId: string, sellerId: string) => {
    if (!user) {
      toast.error("Please login first");
      router.push('/profile');
      return;
    }
    if (!userData?.isVerified) {
      toast.error("You must be a verified student to make deliveries");
      router.push('/profile?tab=verification');
      return;
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      
      // Attempt to claim the delivery
      await updateDoc(orderRef, {
        riderId: user.uid,
        deliveryStatus: 'accepted'
      });

      toast.success("Delivery accepted! You can now contact the buyer and seller.");
      fetchDeliveries();

      // Create a 3-way Group Chat (Or a chat with Buyer specifically about delivery)
      // Let's create a specific chat with the buyer emphasizing delivery
      const chatId = `delivery_${orderId}_${user.uid}`;
      const chatRef = doc(db, 'chats', chatId);
      
      await setDoc(chatRef, {
        participants: [user.uid, buyerId],
        isGroup: false,
        isDeliveryChat: true,
        orderId: orderId,
        createdAt: serverTimestamp(),
        lastMessage: "I offered to deliver your item! Let's negotiate the fee and my ETA.",
        lastMessageAt: serverTimestamp(),
        participantDetails: {
          [user.uid]: { name: userData?.displayName || 'Rider', role: userData?.role || 'student', photoURL: userData?.photoURL || '' },
          [buyerId]: { name: 'Buyer', role: 'student', photoURL: '' } // Would ideally fetch buyer info, but this works for basic rendering
        },
        [`unreadCount.${buyerId}`]: increment(1)
      }, { merge: true });

      // Add actual first message
      await setDoc(doc(db, `chats/${chatId}/messages`, 'init'), {
        chatId: chatId,
        senderId: user.uid,
        text: "Hi! I saw your request for a Campus Rider. I can deliver this. What's your offer for the delivery fee?",
        status: 'sent',
        createdAt: serverTimestamp()
      });

      // Redirect to chat
      router.push(`/dashboard/messages?chatId=${chatId}`);
    } catch (e) {
      console.error("Failed to accept delivery:", e);
      toast.error("Could not accept delivery. Someone else may have taken it.");
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500 tracking-widest uppercase text-sm animate-pulse">Loading Board...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8 pb-20">
      {/* Header */}
      <div className="bg-gray-900 text-white rounded-[2.5rem] p-8 md:p-12 shadow-xl relative overflow-hidden border border-gray-800">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-[#d9ff00] rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3 leading-tight">Campus Rider Board</h1>
            <p className="text-gray-400 font-medium text-lg">Verified students: earn extra cash by voluntarily delivering items for your peers on campus. Negotiate fees directly. No platform tax.</p>
          </div>
          
          <div className="hidden md:flex bg-[#d9ff00] text-black rounded-[2rem] px-8 py-6 transform rotate-3 flex-col items-center justify-center shadow-xl shadow-[#d9ff00]/20">
            <Navigation className="w-8 h-8 mb-1" />
            <span className="font-bold text-sm tracking-tighter whitespace-nowrap">Earn Cash</span>
          </div>
        </div>
      </div>

      <div className="relative z-20 space-y-8">
        
        {/* Active Route Focus */}
        {myDeliveries.length > 0 && (
          <div>
             <h2 className="text-xl font-bold mb-4 tracking-tight flex items-center gap-2"><MapPin className="text-[#d9ff00]" /> Your Active Deliveries</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myDeliveries.map(order => (
                   <div key={order.id} className="bg-black text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden group border border-gray-800">
                     <div className="flex justify-between items-start mb-4">
                       <span className="bg-[#d9ff00] text-black text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1"><ShieldCheck className="w-4 h-4"/> Verified Route</span>
                       <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">#{order.id.slice(0, 6)}</span>
                     </div>
                     <h3 className="text-2xl font-black mb-2 line-clamp-1">{order.productTitle}</h3>
                     <p className="text-gray-400 text-sm mb-6 flex items-center gap-2"><Clock className="w-4 h-4" /> Expected Drop-off ASAP</p>
                     
                     <div className="pt-4 border-t border-gray-800 flex justify-between gap-2">
                        <button 
                          onClick={() => router.push(`/dashboard/messages?chatId=delivery_${order.id}_${user?.uid}`)}
                          className="flex-1 bg-white text-black font-bold py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors flex justify-center items-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" /> Message Buyer
                        </button>
                     </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {/* Public Board */}
        <div>
          <h2 className="text-xl font-bold mb-4 tracking-tight flex items-center gap-2"><Package className="text-black" /> Available Requests</h2>
          
          {availableDeliveries.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-12 text-center shadow-sm border border-gray-100 flex flex-col items-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Package className="w-8 h-8 text-gray-300" /></div>
              <h3 className="text-2xl font-bold mb-2 tracking-tight">No Deliveries Requested</h3>
              <p className="text-gray-500 font-medium">Sit tight! Campus riders are currently caught up. New requests will appear here dynamically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableDeliveries.map(order => (
                <div key={order.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 hover:border-black transition-colors group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                     <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200">Open Request</span>
                     <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">#{order.id.slice(0, 6)}</span>
                  </div>
                  <h3 className="font-bold text-xl mb-4 line-clamp-2 leading-tight">{order.productTitle}</h3>
                  
                  <div className="bg-gray-50 rounded-xl p-4 mb-6 mt-auto">
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700 mb-2">
                       <MapPin className="w-4 h-4 text-gray-400" /> From: Seller <span className="opacity-50">({order.sellerId.substring(0, 4).toUpperCase()})</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                       <Navigation className="w-4 h-4 text-gray-400" /> To: Buyer <span className="opacity-50">({order.buyerId.substring(0, 4).toUpperCase()})</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleOfferDelivery(order.id, order.buyerId, order.sellerId)}
                    className="w-full bg-[#d9ff00] text-black font-bold py-4 rounded-xl hover:bg-[#c4e600] transition-transform active:scale-95 shadow-sm flex items-center justify-center gap-2"
                  >
                    Offer to Deliver
                  </button>
                  <p className="text-center text-xs text-gray-400 mt-3 font-semibold uppercase tracking-widest flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Negotiate tip in chat
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
