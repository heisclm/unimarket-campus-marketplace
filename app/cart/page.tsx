'use client';

import { useCart } from '@/components/cart/CartProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { writeBatch, doc, collection, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Trash2, ShieldCheck, ShoppingBag, ArrowRight, CheckCircle2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { placeOrderWithEscrow } from '@/lib/escrow';
import CheckoutSuccess from '@/components/checkout/CheckoutSuccess';

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, total, clearCart } = useCart();
  const { user, userData, refreshUserData } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('paystack');
  const [useCoins, setUseCoins] = useState(false);
  const [unavailableItems, setUnavailableItems] = useState<string[]>([]);
  const [isValidatingCart, setIsValidatingCart] = useState(true);
  const [purchasedItems, setPurchasedItems] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const validateCart = async () => {
      if (items.length === 0) {
        setIsValidatingCart(false);
        return;
      }
      
      try {
        const itemChecks = await Promise.all(items.map(async (item) => {
          try {
            const resolvedProductId = item.productId || (item.id.includes('-') ? item.id.split('-')[0] : item.id);
            const productRef = doc(db, 'products', resolvedProductId);
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) {
              console.log("Cart item not found:", item.title);
              return item.id;
            }
            if (productSnap.data()?.status !== 'active') {
              console.log("Cart item not active:", item.title, productSnap.data()?.status);
              return item.id;
            }
            return null;
          } catch (err) {
            console.error("Failed to check item:", item.title, err);
            // Default to unavailable if we can't check
            return item.id;
          }
        }));
        
        const unavailable = itemChecks.filter(id => id !== null) as string[];
        setUnavailableItems(unavailable);
      } catch (e) {
        console.error("Cart validation failed", e);
      } finally {
        setIsValidatingCart(false);
      }
    };
    validateCart();
  }, [items]);

  const handleRemove = (id: string) => {
    removeFromCart(id);
    toast.success('Item removed from cart');
  };

  const handleCheckout = async () => {
    if (!user) {
      router.push('/profile');
      return;
    }

    if (!userData?.isVerified) {
      toast.error('Please verify your account in your profile before checking out.');
      router.push('/profile?tab=verification');
      return;
    }

    if (unavailableItems.length > 0) {
      toast.error('Some items in your cart are no longer available. Please remove them.');
      return;
    }

    if (userData?.role === 'vendor' || userData?.role === 'admin') {
      toast.error(userData?.role === 'admin' ? 'Admins are not allowed to purchase items.' : 'Vendors are not allowed to purchase items.');
      return;
    }

    const deliveryFee = 0; // Delivery is handled outside the system now
    const coinDiscount = useCoins ? (userData?.coins || 0) * 0.005 : 0;
    const finalTotal = Math.max(0, total + deliveryFee - coinDiscount);

    if (paymentMethod === 'wallet') {
      if ((userData?.walletBalance || 0) < finalTotal) {
        toast.error('Insufficient wallet balance. Please select Paystack or deposit funds.');
        return;
      }

      setIsCheckingOut(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            items: items.map(item => ({ id: item.id, productId: item.productId || (item.id.includes('-') ? item.id.split('-')[0] : item.id), title: item.title, price: item.price, sellerId: item.sellerId, quantity: item.quantity || 1 })),
            useCoins
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Checkout failed');
        }

        await refreshUserData();
        setPurchasedItems(items.map(item => ({...item}))); // save the snapshot of items before clearing
        clearCart();
        setSuccess(true);
        toast.success('Checkout successful!');
      } catch (error: any) {
        console.error('Checkout failed:', error);
        toast.error(error.message || 'Checkout failed. Please try again.');
      } finally {
        setIsCheckingOut(false);
      }
    } else {
      // Paystack Flow
      setIsCheckingOut(true);
      try {
        const response = await fetch('/api/paystack/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            amount: finalTotal,
            metadata: {
              type: 'cart_checkout',
              buyerId: user.uid,
              useCoins,
              items: items.map(item => ({
                id: item.id,
                productId: item.productId || (item.id.includes('-') ? item.id.split('-')[0] : item.id),
                title: item.title,
                price: item.price,
                sellerId: item.sellerId,
                quantity: item.quantity || 1
              }))
            }
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to initialize payment');

        // Redirect to Paystack checkout
        window.location.href = data.authorization_url;
      } catch (error: any) {
        console.error('Paystack init failed:', error);
        toast.error(error.message || 'Failed to initialize payment');
        setIsCheckingOut(false);
      }
    }
  };

  if (success) {
    return (
      <div className="py-10">
        <CheckoutSuccess items={purchasedItems} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-12 shadow-sm text-center border border-gray-50">
        <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold mb-4 tracking-tight">Your cart is empty</h1>
        <p className="text-gray-500 mb-8">Looks like you haven&apos;t added anything to your cart yet.</p>
        <Link href="/products" className="inline-block bg-[#d9ff00] text-black px-8 py-3 rounded-full font-bold hover:bg-[#c4e600] transition-all hover:scale-105 active:scale-[0.98] shadow-lg">
          Browse Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Cart Items */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Shopping Cart ({items.length})</h1>
          <button onClick={() => { clearCart(); toast.success('Cart cleared'); }} className="text-sm text-gray-400 hover:text-red-500 font-medium transition-colors">Clear Cart</button>
        </div>
        
        {isValidatingCart ? (
          Array.from({ length: Math.max(1, items.length) }).map((_, i) => (
            <div key={i} className="bg-white rounded-[2rem] p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 border border-gray-50 animate-pulse">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-4 py-2 w-full">
                <div className="h-6 bg-gray-200 rounded-lg w-3/4" />
                <div className="h-4 bg-gray-200 rounded-lg w-1/2" />
                <div className="flex justify-between items-center pt-2">
                   <div className="h-6 bg-gray-200 rounded-lg w-1/4" />
                   <div className="h-8 bg-gray-200 rounded-lg w-24" />
                </div>
              </div>
            </div>
          ))
        ) : items.map((item) => {
          const isUnavailable = unavailableItems.includes(item.id);
          return (
            <div key={item.id} className={`bg-white rounded-[2rem] p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 border ${isUnavailable ? 'border-red-200 bg-red-50/30' : 'border-gray-50 hover:border-gray-100'} transition-colors group relative`}>
              {isUnavailable && (
                <div className="absolute top-2 right-2 bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold shadow-sm z-10">
                  Sold Out / Unavailable
                </div>
              )}
              
              <div className="flex items-start gap-4 flex-1 w-full">
                <div className={`w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-2xl relative overflow-hidden flex-shrink-0 border border-gray-100 ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                  {item.image ? (
                    <Image src={item.image} alt={item.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
                  )}
                </div>
                
                <div className={`flex-1 ${isUnavailable ? 'opacity-50' : ''}`}>
                  <h3 className="font-bold text-base sm:text-lg line-clamp-1 text-gray-900">{item.title}</h3>
                  <p className="text-gray-400 text-xs mb-1 sm:mb-2 font-medium uppercase tracking-wider line-clamp-1">Seller: {item.sellerId.slice(0, 8)}...</p>
                  <div className="font-bold text-lg sm:text-xl text-black">GH₵{item.price.toFixed(2)}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                <div className={`flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100 ${isUnavailable ? 'invisible' : ''}`}>
                  <button 
                    onClick={() => {
                      if ((item.quantity || 1) > 1) {
                        updateQuantity(item.id, (item.quantity || 1) - 1);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-black hover:bg-white rounded-lg transition-all"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold text-sm">{item.quantity || 1}</span>
                  <button 
                    onClick={() => {
                      const currentQuantity = item.quantity || 1;
                      const maxQty = item.maxQuantity || 999;
                      if (currentQuantity < maxQty) {
                        updateQuantity(item.id, currentQuantity + 1);
                      } else {
                        toast.error(`Only ${maxQty} available in stock`);
                      }
                    }}
                    disabled={(item.quantity || 1) >= (item.maxQuantity || 999)}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-black hover:bg-white rounded-lg transition-all disabled:opacity-50"
                  >
                    +
                  </button>
                </div>

                <button 
                  onClick={() => handleRemove(item.id)}
                  className="p-2 sm:p-3 text-red-400 hover:text-red-600 hover:bg-red-50 bg-red-50/50 sm:bg-transparent rounded-xl transition-all active:scale-[0.98]"
                  title="Remove from cart"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Payment Method Selection */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50 mt-8">
          <h3 className="font-bold text-lg mb-4">Payment Method</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setPaymentMethod('paystack')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'paystack' ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <ShieldCheck className="w-6 h-6 text-blue-500" />
              <span className="font-bold text-sm">Paystack</span>
              <span className="text-xs text-gray-400">Card / Mobile Money</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('wallet')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'wallet' ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <Wallet className="w-6 h-6 text-green-500" />
              <span className="font-bold text-sm">Wallet</span>
              <span className="text-xs text-gray-400">Bal: GH₵{(userData?.walletBalance || 0).toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm sticky top-28 border border-gray-50">
          <h2 className="text-xl font-bold mb-6 tracking-tight">Order Summary</h2>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-gray-500 font-medium">
              <span>Subtotal</span>
              <span className="text-gray-900">GH₵{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400 font-medium text-xs">
              <span>Platform Fee</span>
              <span>Paid by seller</span>
            </div>

            {userData && userData.coins > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer bg-yellow-50 p-3 rounded-xl border border-yellow-100 hover:bg-yellow-100 transition-colors">
                  <input type="checkbox" checked={useCoins} onChange={(e) => setUseCoins(e.target.checked)} className="w-4 h-4 accent-yellow-500 rounded" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-yellow-800">Use My Coins ({userData.coins})</span>
                    <span className="text-xs text-yellow-600">-GH₵{(userData.coins * 0.005).toFixed(2)} discount</span>
                  </div>
                </label>
              </div>
            )}

            <div className="pt-6 border-t border-gray-100 flex justify-between font-bold text-2xl text-black">
              <span>Total</span>
              <span>GH₵{Math.max(0, total - (useCoins ? (userData?.coins || 0) * 0.005 : 0)).toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Wallet Balance</span>
            </div>
            <span className={`font-bold ${(userData?.walletBalance || 0) < Math.max(0, total - (useCoins ? (userData?.coins || 0) * 0.005 : 0)) ? 'text-red-500' : 'text-green-600'}`}>
              GH₵{(userData?.walletBalance || 0).toFixed(2)}
            </span>
          </div>

          <div className="bg-blue-50 text-blue-700 p-5 rounded-2xl text-sm mb-8 flex items-start gap-3 border border-blue-100">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
            <p className="leading-relaxed font-medium">Your payment will be held securely in escrow until you receive your items.</p>
          </div>

          <button 
            onClick={handleCheckout}
            disabled={isCheckingOut || isValidatingCart || unavailableItems.length > 0}
            className="w-full bg-black text-white py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCheckingOut ? 'Processing...' : isValidatingCart ? 'Checking Cart...' : 'Checkout Securely'} <ArrowRight className="w-5 h-5" />
          </button>
          
          <p className="text-center text-xs text-gray-400 mt-6 font-medium">Secure checkout powered by UniMart Escrow</p>
        </div>
      </div>
    </div>
  );
}
