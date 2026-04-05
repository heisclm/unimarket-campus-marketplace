'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/components/cart/CartProvider';
import { useAuth } from '@/components/auth/AuthProvider';

function VerifyPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const { user } = useAuth();
  
  const reference = searchParams.get('reference');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your payment...');
  const hasVerified = useRef(false);

  useEffect(() => {
    const verifyAndProcess = async () => {
      if (!reference) {
        setStatus('error');
        setMessage('No payment reference found.');
        return;
      }

      if (hasVerified.current) return;
      hasVerified.current = true;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(new Error('Verification request timed out')), 30000); // 30s timeout

        const res = await fetch(`/api/paystack/verify?reference=${reference}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();

        if (res.ok && data.status === 'success') {
          if (data.metadata?.type === 'cart_checkout') {
            clearCart();
          }
          setStatus('success');
          setMessage('Payment verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Payment verification failed.');
        }
      } catch (error: any) {
        console.error(error);
        setStatus('error');
        setMessage('An error occurred while verifying payment.');
      }
    };

    verifyAndProcess();
  }, [reference, clearCart, user]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-8 shadow-sm text-center border border-gray-50">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">Verifying Payment</h1>
            <p className="text-gray-500">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-gray-500 mb-8">{message}</p>
            <Link href="/dashboard" className="inline-block bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition-all">
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <XCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Failed</h1>
            <p className="text-gray-500 mb-8">{message}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => router.back()} className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition-all">
                Try Again
              </button>
              <Link href="/dashboard" className="text-gray-500 font-medium hover:text-black transition-colors">
                Return to Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}>
      <VerifyPaymentContent />
    </Suspense>
  );
}
