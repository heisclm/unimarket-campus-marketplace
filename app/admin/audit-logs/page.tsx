'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Search, ShieldAlert, History } from 'lucide-react';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredLogs = logs.filter(log => 
    log.id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.adminId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.targetId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col flex-wrap sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-gray-500">Monitor admin and system level actions.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search Action, ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-black outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                <th className="px-8 py-6 w-16">Icon</th>
                <th className="px-8 py-6 max-w-[200px]">Action</th>
                <th className="px-8 py-6">Description</th>
                <th className="px-8 py-6 max-w-[150px]">Target</th>
                <th className="px-8 py-6 max-w-[150px]">Admin</th>
                <th className="px-8 py-6">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-gray-500">
                    No audit logs available.
                  </td>
                </tr>
              ) : filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
                      <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    </div>
                  </td>
                  <td className="px-8 py-5 max-w-[200px]">
                    <span className="font-bold text-gray-900 truncate block">{log.action || 'System Action'}</span>
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider block">ID: {log.id?.slice(0, 8)}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm text-gray-600 line-clamp-2">{log.description || 'No description provided'}</span>
                  </td>
                  <td className="px-8 py-5 max-w-[150px]">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded truncate block">{log.targetId || 'N/A'}</span>
                  </td>
                  <td className="px-8 py-5 max-w-[150px]">
                    <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded truncate block">{log.adminId || 'System'}</span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className="text-xs text-gray-500 font-medium flex items-center gap-2">
                      <History className="w-3.5 h-3.5" />
                      {log.createdAt?.toDate?.().toLocaleString() || 'Just now'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
