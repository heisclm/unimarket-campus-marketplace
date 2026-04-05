'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { Users, ShieldCheck, ShieldAlert, Search, MoreVertical, Ban, CheckCircle, XCircle } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleToggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isVerified: !currentStatus });
      toast.success(`User verification ${!currentStatus ? 'approved' : 'revoked'}`);
    } catch (error) {
      toast.error('Failed to update verification');
    }
  };

  const [userToBan, setUserToBan] = useState<{id: string, isBanned: boolean} | null>(null);

  const handleToggleBan = async () => {
    if (!userToBan) return;
    try {
      await updateDoc(doc(db, 'users', userToBan.id), { isBanned: !userToBan.isBanned });
      toast.success(`User ${!userToBan.isBanned ? 'banned' : 'unbanned'} successfully`);
      setUserToBan(null);
    } catch (error) {
      toast.error('Operation failed');
      setUserToBan(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-black outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                <th className="px-8 py-6">User Details</th>
                <th className="px-8 py-6">Role</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6">Verification</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors group ${u.isBanned ? 'opacity-60 bg-red-50/30' : ''}`}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden relative border border-gray-100">
                        {u.photoURL ? (
                          <Image src={u.photoURL} alt={u.displayName} fill className="object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Users className="w-5 h-5 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 flex items-center gap-1">
                          {u.displayName || 'Anonymous'}
                          {u.isBanned && <Ban className="w-3 h-3 text-red-500" />}
                        </p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role || 'student'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    {u.isBanned ? (
                      <span className="text-red-600 font-bold text-xs flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Banned
                      </span>
                    ) : (
                      <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    {u.isVerified ? (
                      <span className="inline-flex items-center gap-1 text-blue-600 font-bold text-xs">
                        <ShieldCheck className="w-4 h-4" /> Verified
                      </span>
                    ) : (
                      <span className="text-orange-400 text-xs font-bold flex items-center gap-1">
                        <ShieldAlert className="w-4 h-4" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleToggleVerification(u.id, !!u.isVerified)}
                        className={`p-2 rounded-xl transition-all ${
                          u.isVerified ? 'text-orange-500 hover:bg-orange-50' : 'text-blue-500 hover:bg-blue-50'
                        }`}
                        title={u.isVerified ? 'Revoke Verification' : 'Approve Verification'}
                      >
                        <ShieldCheck className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setUserToBan({id: u.id, isBanned: !!u.isBanned})}
                        className={`p-2 rounded-xl transition-all ${
                          u.isBanned ? 'text-green-500 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'
                        }`}
                        title={u.isBanned ? 'Unban User' : 'Ban User'}
                      >
                        <Ban className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ban Confirmation Modal */}
      {userToBan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">{userToBan.isBanned ? 'Unban User' : 'Ban User'}</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to {userToBan.isBanned ? 'unban' : 'ban'} this user?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setUserToBan(null)}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleToggleBan}
                className={`flex-1 text-white px-6 py-3 rounded-xl font-bold transition-colors ${
                  userToBan.isBanned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {userToBan.isBanned ? 'Unban' : 'Ban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
