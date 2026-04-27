'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth, UserRole } from '@/components/auth/AuthProvider';
import { loginWithGoogle, logout, signInWithEmail, signUpWithEmail, resetPassword, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, Store, GraduationCap, Mail, Lock, Eye, EyeOff, Wallet, ShieldCheck, History, Package, LayoutDashboard, ShoppingBag, Zap } from 'lucide-react';
import dynamicImport from 'next/dynamic';
const VerificationSection = dynamicImport(() => import('@/components/profile/VerificationSection'), { ssr: false });
import WalletSection from '@/components/profile/WalletSection';

export const dynamic = 'force-dynamic';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, role, userData, loading, setRole } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'verification' | 'orders'>('profile');
  const [isSettingRole, setIsSettingRole] = useState(false);
  
  // Stats State
  const [stats, setStats] = useState({ purchases: 0, activeBids: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  // Email Auth State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const OrdersSection = dynamicImport(() => import('@/components/profile/OrdersSection'), { ssr: false });

  const handleGoogleLogin = async () => {
    try {
      setAuthError('');
      const loggedInUser = await loginWithGoogle();
      toast.success('Successfully logged in with Google!');
      
      const userDoc = await getDoc(doc(db, 'users', loggedInUser.uid));
      if (userDoc.exists() && userDoc.data().role) {
        window.location.assign('/');
      }
    } catch (error: any) {
      setAuthError(error.message || "Google login failed");
      toast.error('Google login failed');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setIsProcessing(true);
    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          throw new Error("Full Name is required for sign up.");
        }
        await signUpWithEmail(email, password, fullName);
        toast.success('Account created successfully!');
      } else {
        const loggedInUser = await signInWithEmail(email, password);
        toast.success('Welcome back!');
        
        const userDoc = await getDoc(doc(db, 'users', loggedInUser.uid));
        if (userDoc.exists() && userDoc.data().role) {
          window.location.assign('/');
        }
      }
    } catch (error: any) {
      setAuthError(error.message || "Authentication failed");
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError('Please enter your email address first.');
      toast.error('Email required for reset');
      return;
    }
    setAuthError('');
    setAuthMessage('');
    setIsProcessing(true);
    try {
      await resetPassword(email);
      setAuthMessage('Password reset email sent! Check your inbox.');
      toast.success('Reset email sent!');
    } catch (error: any) {
      setAuthError(error.message || 'Failed to send reset email');
      toast.error('Failed to send reset email');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error("Logout failed", error);
      toast.error('Logout failed');
    }
  };

  const handleRoleSelection = async (selectedRole: UserRole) => {
    setIsSettingRole(true);
    try {
      await setRole(selectedRole);
      toast.success(`Profile set as ${selectedRole}!`);
      window.location.assign('/');
    } catch (error) {
      console.error("Failed to set role", error);
      toast.error('Failed to set profile type');
    } finally {
      setIsSettingRole(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setStatsLoading(true);
      try {
        // Fetch purchases
        const ordersQuery = query(collection(db, 'orders'), where('buyerId', '==', user.uid));
        const ordersSnap = await getDocs(ordersQuery);
        
        // Fetch active bids
        const bidsQuery = query(collection(db, 'bids'), where('bidderId', '==', user.uid));
        const bidsSnap = await getDocs(bidsQuery);
        
        // Filter unique product IDs for active bids (simplified)
        const uniqueBidProducts = new Set(bidsSnap.docs.map(doc => doc.data().auctionId));

        setStats({
          purchases: ordersSnap.size,
          activeBids: uniqueBidProducts.size
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-white rounded-[2rem] p-8 shadow-sm min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 w-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-[2rem] p-6 md:p-8 shadow-sm min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <UserIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-center">Welcome to UniMart</h1>
        <p className="text-gray-500 mb-8 text-center text-sm">
          Join the marketplace to buy, sell, and auction products.
        </p>

        {authError && <div className="w-full p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-xl">{authError}</div>}
        {authMessage && <div className="w-full p-3 mb-4 text-sm text-green-600 bg-green-50 rounded-xl">{authMessage}</div>}

        <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-4 mb-6">
          {isSignUp && (
            <div className="relative">
              <UserIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Full Name" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={isSignUp}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {!isSignUp && (
            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={handleResetPassword}
                disabled={isProcessing}
                className="text-sm text-gray-500 hover:text-black transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button 
            type="submit"
            disabled={isProcessing}
            className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="w-full flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-sm text-gray-400">OR</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-black px-8 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-sm text-gray-500">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{' '}
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setAuthMessage(''); }}
            className="text-black font-semibold hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    );
  }

  // Logged in, but no role selected (First time user)
  if (!role) {
    return (
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
        <p className="text-gray-500 mb-8 max-w-md">
          Are you joining as a student looking to buy/sell, or a vendor setting up a shop?
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button 
            onClick={() => handleRoleSelection('student')}
            disabled={isSettingRole}
            className="flex flex-col items-center p-8 border-2 border-gray-100 rounded-[2rem] hover:border-[#d9ff00] hover:bg-gray-50 transition-all group disabled:opacity-50"
          >
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">I&apos;m a Student</h3>
            <p className="text-sm text-gray-500">Buy, sell, and bid on items within the campus.</p>
          </button>

          <button 
            onClick={() => handleRoleSelection('vendor')}
            disabled={isSettingRole}
            className="flex flex-col items-center p-8 border-2 border-gray-100 rounded-[2rem] hover:border-[#d9ff00] hover:bg-gray-50 transition-all group disabled:opacity-50"
          >
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Store className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">I&apos;m a Vendor</h3>
            <p className="text-sm text-gray-500">Set up a shop and sell products to students.</p>
          </button>
        </div>
      </div>
    );
  }

  // Fully logged in with role
  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Profile Header */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-12 shadow-sm relative overflow-hidden border border-gray-100">
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-br from-[#d9ff00]/20 via-transparent to-transparent z-0"></div>
        <div className="absolute top-0 right-0 w-full h-40 bg-gradient-to-bl from-indigo-50 via-transparent to-transparent z-0"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 mt-16 md:mt-12">
          <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-[2rem] p-2 shadow-xl shadow-black/5 rotate-[-3deg] hover:rotate-0 transition-transform duration-300">
            <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative bg-gray-100 border border-gray-100">
              {user.photoURL ? (
                <Image src={user.photoURL} alt={user.displayName || 'User'} fill className="object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-12 h-12 text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left pt-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-900 text-[#d9ff00] rounded-full text-[10px] font-black tracking-widest uppercase mb-4 shadow-sm">
              {role === 'student' ? <GraduationCap className="w-3.5 h-3.5" /> : role === 'vendor' ? <Store className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
              {role} Account
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight text-gray-900">{user.displayName || 'Anonymous User'}</h1>
            <p className="text-gray-500 mb-8 break-all font-medium">{user.email}</p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              {role === 'student' && (
                <Link 
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-black text-[#d9ff00] rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  My Dashboard
                </Link>
              )}
              {role === 'vendor' && (
                <Link 
                  href="/vendor"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-orange-500 text-white rounded-full text-sm font-black uppercase tracking-widest hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-orange-500/20"
                >
                  <Store className="w-4 h-4" />
                  Vendor Dashboard
                </Link>
              )}
              {role === 'admin' && (
                <Link 
                  href="/admin"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-red-600 text-white rounded-full text-sm font-black uppercase tracking-widest hover:bg-red-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-red-600/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Panel
                </Link>
              )}
              <button 
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-full text-sm font-black uppercase tracking-widest hover:border-black hover:text-black hover:bg-gray-50 active:scale-95 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl w-full mx-auto overflow-x-auto no-scrollbar scroll-smooth snap-x border border-gray-100 shadow-sm backdrop-blur-md sticky top-4 z-40">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`snap-center whitespace-nowrap px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 flex-1 md:flex-none justify-center ${activeTab === 'profile' ? 'bg-black text-white shadow-xl shadow-black/10' : 'text-gray-500 hover:text-black hover:bg-gray-100/50'}`}
        >
          <UserIcon className="w-4 h-4 shrink-0" /> Profile
        </button>
        {role !== 'admin' && (
          <>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`snap-center whitespace-nowrap px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 flex-1 md:flex-none justify-center ${activeTab === 'orders' ? 'bg-black text-white shadow-xl shadow-black/10' : 'text-gray-500 hover:text-black hover:bg-gray-100/50'}`}
            >
              <Package className="w-4 h-4 shrink-0" /> Orders
            </button>
            <button 
              onClick={() => setActiveTab('wallet')}
              className={`snap-center whitespace-nowrap px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 flex-1 md:flex-none justify-center ${activeTab === 'wallet' ? 'bg-black text-white shadow-xl shadow-black/10' : 'text-gray-500 hover:text-black hover:bg-gray-100/50'}`}
            >
              <Wallet className="w-4 h-4 shrink-0" /> Wallet
            </button>
            <button 
              onClick={() => setActiveTab('verification')}
              className={`snap-center whitespace-nowrap px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 flex-1 md:flex-none justify-center ${activeTab === 'verification' ? 'bg-black text-white shadow-xl shadow-black/10' : 'text-gray-500 hover:text-black hover:bg-gray-100/50'}`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" /> Verify
            </button>
          </>
        )}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="bg-white rounded-[2.5rem] p-6 lg:p-10 shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="font-black text-2xl tracking-tight mb-8">Account Details</h3>
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100/50">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Display Name</label>
                  <p className="font-bold text-lg text-gray-900 tracking-tight">{user.displayName || 'Not set'}</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100/50">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Email Address</label>
                  <p className="font-bold text-lg text-gray-900 tracking-tight">{user.email}</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100/50 flex justify-between items-center">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Member Since</label>
                    <p className="font-bold text-lg text-gray-900 tracking-tight">
                      {userData?.createdAt?.toDate ? userData.createdAt.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recently'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
                    <History className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
            
            {role !== 'admin' && (
              <div className="bg-white rounded-[2.5rem] p-6 lg:p-10 shadow-sm border border-gray-100">
                <h3 className="font-black text-2xl tracking-tight mb-8">Activity</h3>
                <div className="flex flex-col gap-4">
                  <div className="p-6 bg-[#d9ff00]/10 rounded-3xl border border-[#d9ff00]/20 flex items-center justify-between group">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Purchases</p>
                      <p className="text-4xl font-black text-gray-900">{statsLoading ? '...' : stats.purchases}</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <ShoppingBag className="w-6 h-6 text-gray-900" />
                    </div>
                  </div>
                  <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center justify-between group">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Active Bids</p>
                      <p className="text-4xl font-black text-gray-900">{statsLoading ? '...' : stats.activeBids}</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Zap className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'wallet' && <WalletSection />}
        {activeTab === 'verification' && <VerificationSection />}
        {activeTab === 'orders' && <OrdersSection />}
      </div>
    </div>
  );
}
