'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, writeBatch, doc, increment, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Gavel, TrendingUp, AlertCircle, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useCart } from '@/components/cart/CartProvider';

interface BiddingSectionProps {
  productId: string;
  productTitle: string;
  productImage: string;
  sellerId: string;
  startingPrice: number;
  isOwner: boolean;
  status: string;
  auctionEndTime?: string;
}

export default function BiddingSection({ productId, productTitle, productImage, sellerId, startingPrice, isOwner, status, auctionEndTime }: BiddingSectionProps) {
  const { user, userData, refreshUserData } = useAuth();
  const router = useRouter();
  const { addToCart, items } = useCart();
  
  const [bids, setBids] = useState<any[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!auctionEndTime || status !== 'active') return;

    const calculateTimeLeft = () => {
      const difference = new Date(auctionEndTime).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [auctionEndTime, status]);

  useEffect(() => {
    // Proper query: auctionId == productId ORDER BY amount DESC
    // Requires composite index: auctionId (ASC), amount (DESC)
    const q = query(
      collection(db, 'bids'),
      where('auctionId', '==', productId),
      orderBy('amount', 'desc'),
      limit(20) // Fetch top 20 bids
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bidsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBids(bidsData);
    }, (err) => {
      console.error("Error fetching bids:", err);
    });

    return () => unsubscribe();
  }, [productId]);

  const highestBid = bids.length > 0 ? bids[0].amount : startingPrice;
  const minNextBid = highestBid + 1; // Minimum increment of $1

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/profile');
      return;
    }

    setError('');
    const amount = parseFloat(bidAmount);

    if (isNaN(amount) || amount < minNextBid) {
      setError(`Bid must be at least GH₵${minNextBid.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/auctions/bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          productId,
          amount
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to place bid');
      }

      setBidAmount('');
      toast.success(`Bid of GH₵${amount.toFixed(2)} placed successfully!`);
    } catch (err: any) {
      console.error("Error placing bid:", err);
      setError(err.message || "Failed to place bid");
      toast.error(err.message || 'Failed to place bid. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handlePayNow = () => {
    if (!user || bids.length === 0) return;
    
    // Check if it's already in cart
    if (items.some(i => i.id === productId)) {
      router.push('/cart');
      return;
    }

    addToCart({
      id: productId,
      title: productTitle,
      price: highestBid,
      image: productImage,
      sellerId: sellerId
    });
    
    toast.success('Added to cart to complete payment!');
    router.push('/cart');
  };

  if (status !== 'active') {
    const isWinner = user && bids.length > 0 && user.uid === bids[0].bidderId;
    
    return (
      <div className="bg-gray-100 text-gray-500 p-6 rounded-2xl text-center font-medium border border-gray-200">
        <div className="mb-2 text-lg">This auction has ended.</div>
        {bids.length > 0 ? (
          <div className="mt-2 text-black">
            <span className="text-gray-500 text-sm uppercase tracking-wider block mb-1">Winning Bid</span>
            <span className="text-3xl font-bold text-orange-600">GH₵{highestBid.toFixed(2)}</span>
            
            {isWinner && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-green-800 font-bold mb-3">🎉 You won this auction!</p>
                <p className="text-sm text-green-700 mb-4">Please proceed to checkout to claim your item.</p>
                <button 
                  onClick={handlePayNow}
                  className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 transition-colors shadow-sm"
                  id="pay-won-auction-btn"
                >
                  {items.some(i => i.id === productId) ? 'Go to Cart' : 'Pay Now'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2 text-gray-400">No bids were placed.</div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Current Highest Bid</p>
          <div className="text-3xl font-bold text-black flex items-center gap-2">
            GH₵{highestBid.toFixed(2)}
            {bids.length > 0 && <TrendingUp className="w-5 h-5 text-green-500" />}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Time Left</p>
          <div className="text-xl font-bold text-orange-600">{timeLeft || '...'}</div>
          <p className="text-xs text-gray-400 mt-1">{bids.length} Bids</p>
        </div>
      </div>

      {isOwner ? (
        <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-center font-medium text-sm">
          You cannot bid on your own auction.
        </div>
      ) : (
        <form onSubmit={handlePlaceBid} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">GH₵</span>
              <input 
                type="number" 
                step="0.01"
                min={minNextBid}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`Min: ${minNextBid.toFixed(2)}`}
                required
                disabled={timeLeft === 'Ended'}
                className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium disabled:opacity-50 disabled:bg-gray-100"
              />
            </div>
            <button 
              type="submit"
              disabled={isSubmitting || timeLeft === 'Ended'}
              className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
            >
              {isSubmitting ? 'Placing...' : <><Gavel className="w-5 h-5" /> Place Bid</>}
            </button>
          </div>
        </form>
      )}

      {/* Bid History (Recent 3) */}
      {bids.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-bold text-gray-900 mb-3">Recent Bids</h4>
          <div className="space-y-2">
            {bids.slice(0, 3).map((bid, index) => (
              <div key={bid.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-gray-600">User {bid.bidderId.slice(0, 4)}...</span>
                </div>
                <span className="font-bold">GH₵{bid.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
