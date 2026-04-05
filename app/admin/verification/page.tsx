'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, setDoc, getDoc, getDocs, limit } from 'firebase/firestore';
import { ShieldCheck, CheckCircle2, XCircle, Eye, User, FileText, AlertCircle, Loader2, ExternalLink, History } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

export default function AdminVerificationPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'verification_requests'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requestsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(requestsData);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to requests:", error);
      toast.error("Failed to sync verification requests");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAction = async (requestId: string, userId: string, status: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      // 1. Update Request Status
      const requestRef = doc(db, 'verification_requests', requestId);
      await updateDoc(requestRef, {
        status,
        adminNote,
        updatedAt: serverTimestamp()
      });

      // 2. Update User Verification Status
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isVerified: status === 'approved'
      });

      // 2.5 Update all user's products with verification status (Denormalization for performance)
      const productsQuery = query(collection(db, 'products'), where('sellerId', '==', userId));
      const productsSnap = await getDocs(productsQuery);
      const batchPromises = productsSnap.docs.map(productDoc => 
        updateDoc(doc(db, 'products', productDoc.id), {
          sellerIsVerified: status === 'approved'
        })
      );
      await Promise.all(batchPromises);

      // 3. Create Notification
      const notifRef = doc(collection(db, 'notifications'));
      const userDoc = await getDoc(userRef);
      const userRole = userDoc.data()?.role || 'user';
      
      await setDoc(notifRef, {
        userId,
        title: status === 'approved' ? 'Account Verified!' : 'Verification Rejected',
        message: status === 'approved' 
          ? `Congratulations! Your ${userRole} identity has been verified. You now have full access to UniMarket.` 
          : `Your verification request was rejected. ${adminNote ? 'Reason: ' + adminNote : 'Please check your details and try again.'}`,
        type: 'system',
        read: false,
        link: '/profile',
        createdAt: serverTimestamp()
      });

      // 4. Create Audit Log
      const auditRef = doc(collection(db, 'audit_logs'));
      await setDoc(auditRef, {
        action: `verification_${status}`,
        targetUserId: userId,
        targetRequestId: requestId,
        adminNote,
        timestamp: serverTimestamp()
      });

      toast.success(`Request ${status} successfully`);
      setSelectedRequest(null);
      setAdminNote('');
    } catch (error) {
      console.error("Error processing request:", error);
      toast.error("Failed to process request");
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verification Requests</h1>
          <p className="text-sm text-gray-500">Review and approve student identity verifications.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
            <Loader2 className="w-4 h-4" /> {pendingRequests.length} Pending
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Requests List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Pending Requests</h3>
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 text-gray-400">
              No pending requests.
            </div>
          ) : (
            pendingRequests.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className={`w-full text-left p-4 rounded-3xl border-2 transition-all ${selectedRequest?.id === req.id ? 'border-black bg-white shadow-lg' : 'border-transparent bg-white hover:border-gray-200'}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{req.fullName}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                      {req.role === 'vendor' ? `${req.idType?.replace('_', ' ')}: ${req.idNumber}` : `Student ID: ${req.studentId}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${req.autoMatch ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                    {req.autoMatch ? 'Auto-Match' : 'Manual Review'}
                  </div>
                  <div className="text-[10px] font-bold text-gray-400">
                    {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Request Details */}
        <div className="lg:col-span-2">
          {selectedRequest ? (
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedRequest.fullName}</h2>
                      <p className="text-sm text-gray-500">
                        {selectedRequest.role === 'vendor' 
                          ? `${selectedRequest.idType?.replace('_', ' ').toUpperCase()}: ${selectedRequest.idNumber}` 
                          : `Student ID: ${selectedRequest.studentId}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dataset Match</p>
                    <div className={`text-2xl font-bold ${selectedRequest.autoMatch ? 'text-green-600' : 'text-orange-500'}`}>
                      {selectedRequest.autoMatch ? 'MATCHED' : 'MANUAL'}
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-3 h-3" /> ID Card Image
                  </label>
                  <div className="relative aspect-video bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 group max-w-2xl">
                    {selectedRequest.idCardImage ? (
                      <>
                        <div className="relative w-full h-full">
                          <Image 
                            src={selectedRequest.idCardImage} 
                            alt="ID Card" 
                            fill 
                            className="object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <a href={selectedRequest.idCardImage} target="_blank" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-2">
                          <ExternalLink className="w-4 h-4" /> View Full Image
                        </a>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium">
                        No ID image provided
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                <h4 className="font-bold text-sm mb-4">Admin Decision</h4>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add a note (optional, visible to student if rejected)"
                  className="w-full h-24 p-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black text-sm mb-6"
                />
                <div className="flex gap-4">
                  <button
                    onClick={() => handleAction(selectedRequest.id, selectedRequest.userId, 'rejected')}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-red-100 text-red-600 py-3 rounded-xl font-bold hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" /> Reject Request
                  </button>
                  <button
                    onClick={() => handleAction(selectedRequest.id, selectedRequest.userId, 'approved')}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-black/10 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Approve Verification
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-gray-900">Select a request to review</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto mt-2">Choose a pending verification from the list on the left to see details and make a decision.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
