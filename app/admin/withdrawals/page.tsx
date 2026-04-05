'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, increment, getDoc, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Coins, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { motion } from 'motion/react';

export default function AdminWithdrawals() {
  const { role } = useAuth();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;

    const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role]);

  const [withdrawalToApprove, setWithdrawalToApprove] = useState<any>(null);
  const [withdrawalToReject, setWithdrawalToReject] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async () => {
    if (!withdrawalToApprove) return;
    setProcessingId(withdrawalToApprove.id);
    try {
      // In a real system, you would call Paystack Transfer API here.
      // For this project, we just mark it as approved.
      
      await updateDoc(doc(db, 'withdrawals', withdrawalToApprove.id), {
        status: 'approved',
        updatedAt: serverTimestamp()
      });

      // Update the corresponding transaction
      const txQuery = query(collection(db, 'transactions'), 
        // We don't have a direct link, but we can just add a new transaction or find the pending one.
        // It's easier to just update the status of the withdrawal and let the user see it.
      );

      toast.success('Withdrawal approved successfully');
      setWithdrawalToApprove(null);
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      toast.error('Failed to approve withdrawal');
      setWithdrawalToApprove(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!withdrawalToReject || !rejectReason.trim()) return;

    setProcessingId(withdrawalToReject.id);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication required");
      
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ withdrawalId: withdrawalToReject.id, reason: rejectReason })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject withdrawal');
      }

      toast.success('Withdrawal rejected and funds refunded');
      setWithdrawalToReject(null);
      setRejectReason('');
    } catch (error: any) {
      console.error('Error rejecting withdrawal:', error);
      toast.error(error.message || 'Failed to reject withdrawal');
      setWithdrawalToReject(null);
      setRejectReason('');
    } finally {
      setProcessingId(null);
    }
  };

  if (role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-12 shadow-sm text-center mt-12">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-500 mb-8">Only administrators can access this page.</p>
        <Link href="/profile" className="bg-black text-white px-8 py-3 rounded-full font-bold">Go to Profile</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Withdrawal Requests</h1>
          <p className="text-gray-500 mt-1">Manage vendor withdrawal requests.</p>
        </div>
        <Link href="/admin" className="text-sm font-bold text-gray-500 hover:text-black transition-colors">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-50">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="text-center py-16">
            <Coins className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No withdrawal requests</h3>
            <p className="text-gray-500">There are currently no pending withdrawals.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {withdrawals.map((withdrawal) => (
              <motion.div 
                key={withdrawal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 border border-gray-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-lg">GH₵{withdrawal.amount.toFixed(2)}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                      withdrawal.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                      withdrawal.status === 'approved' ? 'bg-green-100 text-green-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {withdrawal.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1"><strong>User ID:</strong> {withdrawal.userId}</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl font-mono mt-2">{withdrawal.details}</p>
                  {withdrawal.rejectReason && (
                    <p className="text-sm text-red-500 mt-2"><strong>Reason:</strong> {withdrawal.rejectReason}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-3">
                    Requested on: {withdrawal.createdAt?.toDate?.().toLocaleString()}
                  </p>
                </div>

                {withdrawal.status === 'pending' && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setWithdrawalToApprove(withdrawal)}
                      disabled={processingId === withdrawal.id}
                      className="flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-all disabled:opacity-50"
                    >
                      {processingId === withdrawal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => setWithdrawalToReject(withdrawal)}
                      disabled={processingId === withdrawal.id}
                      className="flex items-center gap-2 bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Approve Confirmation Modal */}
      {withdrawalToApprove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Approve Withdrawal</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to approve this withdrawal of GH₵{withdrawalToApprove.amount.toFixed(2)}?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setWithdrawalToApprove(null)}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleApprove}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {withdrawalToReject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Reject Withdrawal</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this withdrawal. The funds will be refunded to the user's wallet.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 focus:outline-none focus:ring-2 focus:ring-black min-h-[120px]"
            />
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setWithdrawalToReject(null);
                  setRejectReason('');
                }}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
