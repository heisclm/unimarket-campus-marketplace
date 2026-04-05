'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, limit } from 'firebase/firestore';
import { ShieldCheck, CheckCircle2, XCircle, Search, Eye, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function AdminVerifications() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'verification_requests'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(reqs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    
    if (status === 'rejected' && !adminNote) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      const reqRef = doc(db, 'verification_requests', selectedRequest.id);
      await updateDoc(reqRef, {
        status,
        adminNote: adminNote || '',
        updatedAt: new Date()
      });

      // Update user document if approved
      if (status === 'approved') {
        const userRef = doc(db, 'users', selectedRequest.userId);
        await updateDoc(userRef, { isVerified: true });
      } else {
        const userRef = doc(db, 'users', selectedRequest.userId);
        await updateDoc(userRef, { isVerified: false });
      }

      toast.success(`Verification ${status} successfully`);
      setSelectedRequest(null);
      setAdminNote('');
    } catch (error) {
      console.error('Error updating verification:', error);
      toast.error('Failed to update verification status');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading verification requests...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verification Requests</h1>
          <p className="text-gray-500 mt-1">Review and manage student and vendor verifications.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List of requests */}
        <div className="lg:col-span-1 bg-white rounded-[2rem] shadow-sm border border-gray-50 overflow-hidden flex flex-col h-[800px]">
          <div className="p-6 border-b border-gray-100">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search by name or ID..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {requests.map(req => (
              <button
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className={`w-full text-left p-4 rounded-2xl transition-all ${selectedRequest?.id === req.id ? 'bg-black text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-900'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold truncate">{req.fullName || 'Unknown'}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                    req.status === 'approved' ? 'bg-green-100 text-green-700' : 
                    req.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {req.status}
                  </span>
                </div>
                <div className={`text-xs ${selectedRequest?.id === req.id ? 'text-gray-300' : 'text-gray-500'} flex justify-between`}>
                  <span>{req.role === 'vendor' ? 'Vendor' : 'Student'}</span>
                  <span>{req.idNumber || req.studentId}</span>
                </div>
              </button>
            ))}
            {requests.length === 0 && (
              <div className="text-center text-gray-400 py-8">No verification requests found.</div>
            )}
          </div>
        </div>

        {/* Request Details */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-sm border border-gray-50 p-8 h-[800px] overflow-y-auto">
          {selectedRequest ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedRequest.fullName}</h2>
                  <p className="text-gray-500">{selectedRequest.role === 'vendor' ? 'Vendor' : 'Student'} • {selectedRequest.idType || 'student_id'}: {selectedRequest.idNumber || selectedRequest.studentId}</p>
                </div>
                <div className={`px-4 py-2 rounded-xl font-bold text-sm ${
                  selectedRequest.status === 'approved' ? 'bg-green-100 text-green-700' : 
                  selectedRequest.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                  'bg-orange-100 text-orange-700'
                }`}>
                  Status: {selectedRequest.status.toUpperCase()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">ID Document</h3>
                  <div className="relative aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                    {selectedRequest.idCardImage ? (
                      <Image src={selectedRequest.idCardImage} alt="ID Card" fill className="object-contain" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Selfie</h3>
                  <div className="relative aspect-square max-w-xs bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                    {selectedRequest.selfieImage ? (
                      <Image src={selectedRequest.selfieImage} alt="Selfie" fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4">AI Verification Results</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Face Match Score</p>
                    <p className="text-2xl font-bold text-black">{selectedRequest.faceMatchScore ? `${selectedRequest.faceMatchScore.toFixed(1)}%` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Auto-Match Decision</p>
                    <p className={`text-lg font-bold ${selectedRequest.autoMatch ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedRequest.autoMatch ? 'PASSED' : 'FAILED'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedRequest.status === 'pending' && (
                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">Admin Action</h3>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Add a note (required for rejection)..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black resize-none"
                    rows={3}
                  />
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleAction('rejected')}
                      className="flex-1 bg-red-100 text-red-700 py-4 rounded-xl font-bold hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" /> Reject
                    </button>
                    <button
                      onClick={() => handleAction('approved')}
                      className="flex-1 bg-green-500 text-white py-4 rounded-xl font-bold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Approve
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Eye className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a request to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
