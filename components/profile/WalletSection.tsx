'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, History, CreditCard, ShieldCheck, TrendingUp, TrendingDown, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function WalletSection() {
  const { user, userData, refreshUserData } = useAuth();
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [activeQuickAmount, setActiveQuickAmount] = useState<number | null>(null);

  const quickAmounts = [10, 20, 50, 100, 200, 500];

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      txs.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [user]);

  const handleDeposit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const amount = Number(depositAmount);
    if (!user || !amount || isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsDepositing(true);
    try {
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          amount: amount,
          metadata: {
            type: 'wallet_topup',
            userId: user.uid,
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to initialize payment');

      // Redirect to Paystack checkout
      window.location.href = data.authorization_url;
    } catch (error: any) {
      console.error("Deposit failed", error);
      toast.error(error.message || 'Deposit failed. Please try again.');
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const amount = Number(withdrawAmount);
    if (!user || !amount || isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amount > (userData?.walletBalance || 0)) {
      toast.error('Insufficient funds');
      return;
    }
    if (!withdrawDetails.trim()) {
      toast.error('Please enter your bank or mobile money details');
      return;
    }

    setIsWithdrawing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          amount,
          details: withdrawDetails
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Withdrawal failed');

      await refreshUserData();
      setWithdrawAmount('');
      setWithdrawDetails('');
      toast.success(`Withdrawal request for GH₵${amount.toFixed(2)} submitted.`);
    } catch (error: any) {
      console.error("Withdrawal failed", error);
      toast.error(error.message || 'Withdrawal failed. Please try again.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleQuickSelect = (amount: number) => {
    setDepositAmount(amount.toString());
    setActiveQuickAmount(amount);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Balance Card & Deposit Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-black text-white rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col justify-between min-h-[240px] shadow-2xl shadow-black/20"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Wallet className="w-6 h-6 text-[#d9ff00]" />
              </div>
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">UniMarket Wallet</div>
            </div>
            
            <div className="space-y-1">
              <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Available Balance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#d9ff00]">GH₵</span>
                <span className="text-5xl font-black tracking-tighter">
                  {(userData?.walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
              <div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-green-400" /> Total Earned
                </span>
                <span className="text-lg font-bold text-white">
                  GH₵{(userData?.totalEarned || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1 mb-1">
                  <TrendingDown className="w-3 h-3 text-red-400" /> Total Spent
                </span>
                <span className="text-lg font-bold text-white">
                  GH₵{(userData?.totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-4 mt-8">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center text-[10px] font-bold">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Trusted by 2k+ Students</p>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#d9ff00] rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-10 translate-y-1/2 -translate-x-1/2"></div>
        </motion.div>

        {/* Action Interface */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveAction('deposit')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeAction === 'deposit' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Deposit
              </button>
              <button 
                onClick={() => setActiveAction('withdraw')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeAction === 'withdraw' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Withdraw
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure
            </div>
          </div>

          {activeAction === 'deposit' ? (
            <div className="space-y-6">
              {/* Quick Select Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleQuickSelect(amount)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      activeQuickAmount === amount 
                        ? 'bg-black text-white border-black shadow-lg scale-105' 
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>

              {/* Custom Amount Input */}
              <div className="relative group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <span className="text-sm font-black text-gray-400 group-focus-within:text-black transition-colors">GH₵</span>
                </div>
                <input 
                  type="number" 
                  placeholder="Enter custom amount" 
                  value={depositAmount}
                  onChange={(e) => {
                    setDepositAmount(e.target.value);
                    setActiveQuickAmount(null);
                  }}
                  className="w-full bg-gray-50 border-2 border-transparent rounded-2xl pl-16 pr-6 py-5 text-xl font-black placeholder:text-gray-300 placeholder:font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
                />
                <AnimatePresence>
                  {depositAmount && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleDeposit}
                      disabled={isDepositing}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#d9ff00] text-black px-6 py-3 rounded-xl font-bold text-sm hover:bg-black hover:text-white transition-all flex items-center gap-2 shadow-xl shadow-black/5 disabled:opacity-50"
                    >
                      {isDepositing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Deposit
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">
                Funds are held in escrow for buyer protection
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <span className="text-sm font-black text-gray-400 group-focus-within:text-black transition-colors">GH₵</span>
                </div>
                <input 
                  type="number" 
                  placeholder="Amount to withdraw" 
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent rounded-2xl pl-16 pr-6 py-4 text-lg font-black placeholder:text-gray-300 placeholder:font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
                />
              </div>
              <textarea 
                placeholder="Bank or Mobile Money Details (e.g., MTN MoMo: 0551234567, Name: John Doe)" 
                value={withdrawDetails}
                onChange={(e) => setWithdrawDetails(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-black transition-all resize-none h-24"
              ></textarea>
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing || !withdrawAmount || !withdrawDetails}
                className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isWithdrawing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpRight className="w-5 h-5" />}
                Request Withdrawal
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Transaction History Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center">
              <History className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">Recent Activity</h3>
              <p className="text-xs text-gray-400 font-medium">Your wallet transaction history</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Escrow Protected
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-50 rounded-3xl animate-pulse"></div>
            ))
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <CreditCard className="w-8 h-8 text-gray-200" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">No transactions yet</h4>
              <p className="text-xs text-gray-400 max-w-[200px] mx-auto leading-relaxed">
                Your recent transactions will appear here as you buy and sell.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {transactions.map((tx) => (
                <motion.div 
                  layout
                  key={tx.id} 
                  className="p-5 bg-white border border-gray-50 rounded-3xl flex items-center justify-between group hover:border-gray-200 hover:shadow-xl hover:shadow-black/5 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                      tx.type === 'deposit' || tx.type === 'escrow_release' ? 'bg-green-50 text-green-600' : 
                      tx.type === 'escrow_hold' || tx.type === 'withdrawal' ? 'bg-blue-50 text-blue-600' : 
                      tx.type === 'escrow_refund' ? 'bg-purple-50 text-purple-600' :
                      'bg-orange-50 text-orange-600'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'escrow_release' || tx.type === 'escrow_refund' ? <TrendingUp className="w-5 h-5" /> : 
                       tx.type === 'escrow_hold' || tx.type === 'withdrawal' ? <TrendingDown className="w-5 h-5" /> : 
                       <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 capitalize">{tx.type.replace(/_/g, ' ')}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                          {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Pending'}
                        </span>
                        <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                          {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-base ${
                      tx.type === 'deposit' || tx.type === 'escrow_release' || tx.type === 'escrow_refund' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'escrow_release' || tx.type === 'escrow_refund' ? '+' : '-'}
                      <span className="text-xs mr-0.5">GH₵</span>
                      {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      {tx.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        tx.status === 'completed' ? 'text-green-500' : 'text-gray-400'
                      }`}>{tx.status}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
