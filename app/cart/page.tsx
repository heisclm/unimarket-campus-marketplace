'use client';

import { useCart } from '@/components/cart/CartProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { writeBatch, doc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { useState } from 'react';
import Image from 'next/image';
import { Trash2, ShieldCheck, ShoppingBag, ArrowRight, CheckCircle2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { placeOrderWithEscrow } from '@/lib/escrow';

export default function CartPage() {
  const { items, removeFromCart, total, clearCart } = useCart();
  const { user, userData, refreshUserData } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('paystack');
  const router = useRouter();

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

    if (userData?.role === 'vendor') {
      toast.error('Vendors are not allowed to purchase items.');
      return;
    }

    const deliveryFee = deliveryMethod === 'delivery' ? 2 : 0;
    const platformFee = total * 0.02;
    const finalTotal = total + platformFee + deliveryFee;

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
            items: items.map(item => ({ id: item.id, title: item.title, price: item.price, sellerId: item.sellerId })),
            deliveryMethod
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Checkout failed');
        }

        await refreshUserData();
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
              deliveryMethod,
              items: items.map(item => ({
                id: item.id,
                title: item.title,
                price: item.price,
                sellerId: item.sellerId
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
      <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-12 shadow-sm text-center border border-green-50">
        <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold mb-4 tracking-tight">Checkout Successful!</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Your funds are now securely held in escrow. The seller has been notified to prepare your items for {deliveryMethod}.
        </p>
        <Link href="/products" className="inline-block bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition-all hover:scale-105 active:scale-95 shadow-lg">
          Continue Shopping
        </Link>
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
        <Link href="/products" className="inline-block bg-[#d9ff00] text-black px-8 py-3 rounded-full font-bold hover:bg-[#c4e600] transition-all hover:scale-105 active:scale-95 shadow-lg">
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
        
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-[2rem] p-4 shadow-sm flex items-center gap-4 border border-gray-50 hover:border-gray-100 transition-colors group">
            <div className="w-24 h-24 bg-gray-50 rounded-2xl relative overflow-hidden flex-shrink-0 border border-gray-100">
              {item.image ? (
                <Image src={item.image} alt={item.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
              )}
            </div>
            
            <div className="flex-1">
              <h3 className="font-bold text-lg line-clamp-1 text-gray-900">{item.title}</h3>
              <p className="text-gray-400 text-xs mb-2 font-medium uppercase tracking-wider">Seller: {item.sellerId.slice(0, 8)}...</p>
              <div className="font-bold text-xl text-black">GH₵{item.price.toFixed(2)}</div>
            </div>
            
            <button 
              onClick={() => handleRemove(item.id)}
              className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
              title="Remove from cart"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}

        {/* Delivery Method Selection */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50 mt-8">
          <h3 className="font-bold text-lg mb-4">Delivery Method</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setDeliveryMethod('pickup')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${deliveryMethod === 'pickup' ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <ShoppingBag className="w-6 h-6" />
              <span className="font-bold text-sm">Campus Pickup</span>
              <span className="text-xs text-gray-400">Free</span>
            </button>
            <button 
              onClick={() => setDeliveryMethod('delivery')}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${deliveryMethod === 'delivery' ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <ArrowRight className="w-6 h-6" />
              <span className="font-bold text-sm">Dorm Delivery</span>
              <span className="text-xs text-gray-400">+GH₵2.00</span>
            </button>
          </div>
        </div>

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
            <div className="flex justify-between text-gray-500 font-medium">
              <span>Platform Fee (2%)</span>
              <span className="text-gray-900">GH₵{(total * 0.02).toFixed(2)}</span>
            </div>
            {deliveryMethod === 'delivery' && (
              <div className="flex justify-between text-gray-500 font-medium">
                <span>Delivery Fee</span>
                <span className="text-gray-900">GH₵2.00</span>
              </div>
            )}
            <div className="pt-6 border-t border-gray-100 flex justify-between font-bold text-2xl text-black">
              <span>Total</span>
              <span>GH₵{(total * 1.02 + (deliveryMethod === 'delivery' ? 2 : 0)).toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Wallet Balance</span>
            </div>
            <span className={`font-bold ${(userData?.walletBalance || 0) < (total * 1.02 + (deliveryMethod === 'delivery' ? 2 : 0)) ? 'text-red-500' : 'text-green-600'}`}>
              GH₵{(userData?.walletBalance || 0).toFixed(2)}
            </span>
          </div>

          <div className="bg-blue-50 text-blue-700 p-5 rounded-2xl text-sm mb-8 flex items-start gap-3 border border-blue-100">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
            <p className="leading-relaxed font-medium">Your payment will be held securely in escrow until you receive your items.</p>
          </div>

          <button 
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="w-full bg-black text-white py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all hover:scale-[1.02] active:scale-95 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isCheckingOut ? 'Processing...' : 'Checkout Securely'} <ArrowRight className="w-5 h-5" />
          </button>
          
          <p className="text-center text-xs text-gray-400 mt-6 font-medium">Secure checkout powered by UniMarket Escrow</p>
        </div>
      </div>
    </div>
  );
}
