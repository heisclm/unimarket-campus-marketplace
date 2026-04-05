'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, limit, getCountFromServer, getAggregateFromServer, sum, where } from 'firebase/firestore';
import { 
  Users, Package, ShoppingBag, Coins, 
  TrendingUp, ArrowUpRight, Clock, AlertTriangle, 
  CheckCircle, ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';

import { useRouter } from 'next/navigation';

export default function AdminOverview() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingReports: 0,
    pendingVerifications: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatsAndActivity = async () => {
      try {
        // Fetch aggregations instead of all documents
        const usersColl = collection(db, 'users');
        const productsColl = collection(db, 'products');
        const ordersColl = collection(db, 'orders');
        const reportsColl = collection(db, 'reports');

        const [
          totalUsersSnap,
          pendingVerificationsSnap,
          totalProductsSnap,
          totalOrdersSnap,
          totalRevenueSnap,
          pendingReportsSnap
        ] = await Promise.all([
          getCountFromServer(usersColl),
          getCountFromServer(query(usersColl, where('isVerified', '==', false))),
          getCountFromServer(productsColl),
          getCountFromServer(ordersColl),
          getAggregateFromServer(ordersColl, { totalRevenue: sum('amount') }),
          getCountFromServer(query(reportsColl, where('status', '==', 'pending')))
        ]);

        setStats({
          totalUsers: totalUsersSnap.data().count,
          pendingVerifications: pendingVerificationsSnap.data().count,
          totalProducts: totalProductsSnap.data().count,
          totalOrders: totalOrdersSnap.data().count,
          totalRevenue: totalRevenueSnap.data().totalRevenue || 0,
          pendingReports: pendingReportsSnap.data().count
        });

        // Fetch recent activity
        const ordersQuery = query(ordersColl, orderBy('createdAt', 'desc'), limit(5));
        const reportsQuery = query(reportsColl, orderBy('createdAt', 'desc'), limit(5));
        
        const [ordersSnap, reportsSnap] = await Promise.all([
          getDocs(ordersQuery),
          getDocs(reportsQuery)
        ]);

        const activities = [
          ...ordersSnap.docs.map(d => ({ id: d.id, type: 'order', ...d.data() })),
          ...reportsSnap.docs.map(d => ({ id: d.id, type: 'report', ...d.data() }))
        ].sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 8);

        setRecentActivity(activities);
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatsAndActivity();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue', trend: '+12%' },
    { label: 'Total Products', value: stats.totalProducts, icon: Package, color: 'orange', trend: '+5%' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'green', trend: '+18%' },
    { label: 'Total Revenue', value: `GH₵${stats.totalRevenue.toLocaleString()}`, icon: Coins, color: 'purple', trend: '+24%' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 py-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
          <p className="text-gray-500 mt-1">Real-time performance and health monitoring.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100 w-fit">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">System Online</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-500 group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-lg flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {stat.trend}
              </span>
            </div>
            <p className="text-gray-400 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold">Recent Activity</h3>
            <button className="text-sm font-bold text-gray-400 hover:text-black transition-colors">View All</button>
          </div>

          <div className="space-y-6">
            {recentActivity.map((activity, i) => (
              <div key={activity.id} className="flex items-center gap-4 group">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  activity.type === 'order' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'
                }`}>
                  {activity.type === 'order' ? <ShoppingBag className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">
                    {activity.type === 'order' ? `New Order #${activity.id.slice(0, 6)}` : `New Report #${activity.id.slice(0, 6)}`}
                  </p>
                  <p className="text-xs text-gray-400 font-medium">
                    {activity.createdAt?.toDate?.().toLocaleString() || 'Just now'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">
                    {activity.type === 'order' ? `GH₵${Number(activity.amount).toFixed(2)}` : activity.reason}
                  </p>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    activity.status === 'completed' || activity.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health / Alerts */}
        <div className="space-y-6">
          <div className="bg-black text-white rounded-[2.5rem] p-8 shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-4">Action Required</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-[#d9ff00]" />
                    <span className="text-sm font-bold">Pending IDs</span>
                  </div>
                  <span className="bg-[#d9ff00] text-black text-xs font-bold px-2 py-0.5 rounded-full">{stats.pendingVerifications}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-bold">New Reports</span>
                  </div>
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{stats.pendingReports}</span>
                </div>
              </div>
              <button onClick={() => router.push('/admin/verifications')} className="w-full mt-6 bg-[#d9ff00] text-black py-3 rounded-xl font-bold hover:bg-[#c4e600] transition-all flex items-center justify-center gap-2">
                Launch Control Panel <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute top-[-20%] right-[-20%] w-48 h-48 bg-[#d9ff00] rounded-full blur-[80px] opacity-20"></div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-50">
            <h3 className="font-bold text-lg mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => router.push('/admin/withdrawals')} className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all text-center">
                <Coins className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                <span className="text-xs font-bold text-gray-600">Withdrawals</span>
              </button>
              <button onClick={() => router.push('/admin/escrow')} className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all text-center">
                <ShieldCheck className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <span className="text-xs font-bold text-gray-600">Escrow Management</span>
              </button>
              <button className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all text-center">
                <ShoppingBag className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <span className="text-xs font-bold text-gray-600">Sales Report</span>
              </button>
              <button className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all text-center">
                <Package className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                <span className="text-xs font-bold text-gray-600">Audit Logs</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
