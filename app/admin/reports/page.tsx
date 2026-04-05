'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { AlertTriangle, CheckCircle, XCircle, Trash2, ShieldAlert, User, Package, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status });
      toast.success(`Report ${status} successfully`);
    } catch (error) {
      toast.error('Failed to update report status');
    }
  };

  const [reportToDeleteTarget, setReportToDeleteTarget] = useState<any>(null);

  const handleDeleteTarget = async () => {
    if (!reportToDeleteTarget) return;
    try {
      const collectionName = reportToDeleteTarget.targetType === 'user' ? 'users' : reportToDeleteTarget.targetType === 'product' ? 'products' : 'posts';
      await deleteDoc(doc(db, collectionName, reportToDeleteTarget.targetId));
      await updateDoc(doc(db, 'reports', reportToDeleteTarget.id), { status: 'resolved' });
      toast.success(`${reportToDeleteTarget.targetType} deleted and report resolved`);
      setReportToDeleteTarget(null);
    } catch (error) {
      toast.error('Failed to delete target');
      setReportToDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Reports & Fraud Management</h1>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-red-50 text-red-600 rounded-full text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {reports.filter(r => r.status === 'pending').length} Pending Reports
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {reports.length === 0 ? (
            <div className="p-20 text-center text-gray-400">No reports found.</div>
          ) : (
            reports.map(report => (
              <div key={report.id} className={`p-8 hover:bg-gray-50 transition-colors ${report.status === 'pending' ? 'bg-white' : 'bg-gray-50/50 opacity-75'}`}>
                <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                  <div className="flex gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      report.status === 'pending' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {report.targetType === 'user' ? <User className="w-7 h-7" /> : 
                       report.targetType === 'product' ? <Package className="w-7 h-7" /> : 
                       <MessageSquare className="w-7 h-7" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg text-gray-900">Report #{report.id.slice(0, 6)}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                          report.status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {report.status}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg">
                          {report.targetType}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-4 leading-relaxed max-w-2xl">{report.reason}</p>
                      <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-2"><User className="w-3 h-3" /> Reporter: {report.reporterId?.slice(0, 8)}...</span>
                        <span className="flex items-center gap-2"><ShieldAlert className="w-3 h-3" /> Target ID: {report.targetId?.slice(0, 8)}...</span>
                        <span>{report.createdAt?.toDate?.().toLocaleString() || 'Just now'}</span>
                      </div>
                    </div>
                  </div>

                  {report.status === 'pending' && (
                    <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto">
                      <button 
                        onClick={() => handleResolveReport(report.id, 'resolved')}
                        className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-600 rounded-xl font-bold text-sm hover:bg-green-100 transition-all"
                      >
                        <CheckCircle className="w-4 h-4" /> Resolve
                      </button>
                      <button 
                        onClick={() => setReportToDeleteTarget(report)}
                        className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Target
                      </button>
                      <button 
                        onClick={() => handleResolveReport(report.id, 'dismissed')}
                        className="flex-1 md:w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-400 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all"
                      >
                        <XCircle className="w-4 h-4" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Target Confirmation Modal */}
      {reportToDeleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Delete Target</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to delete this {reportToDeleteTarget.targetType}? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setReportToDeleteTarget(null)}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteTarget}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
