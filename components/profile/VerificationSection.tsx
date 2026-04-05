'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { ShieldCheck, Upload, Camera, CheckCircle2, AlertCircle, Loader2, User, FileText, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

export default function VerificationSection() {
  const { user, userData, refreshUserData } = useAuth();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [idType, setIdType] = useState('student_id');
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idCardImage, setIdCardImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Verification results
  const [idMatch, setIdMatch] = useState<boolean | null>(null);
  const [nameMatch, setNameMatch] = useState<boolean | null>(null);
  const [faceScore, setFaceScore] = useState<number | null>(null);
  const [autoVerify, setAutoVerify] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'verification_requests', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setRequest(docSnap.data());
      } else {
        setRequest(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to verification request:", error);
      setLoading(false);
    });

    if (userData?.role === 'vendor') {
      setIdType('ghana_card');
    } else {
      setIdType('student_id');
    }

    return () => unsubscribe();
  }, [user, userData?.role]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'selfie') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'id') setIdCardImage(reader.result as string);
      else setSelfieImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const runAutomatedChecks = async () => {
    if (!user) return;
    if (!idNumber || !fullName) {
      toast.error("Please complete all steps first");
      return;
    }

    setIsSubmitting(true);
    toast.loading("Submitting verification request...", { id: 'verify' });

    try {
      const idToken = await user.getIdToken();
      
      // Student Verification via Admin Dataset API
      if (userData?.role === 'student') {
        const response = await fetch('/api/verify/student', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            fullName,
            studentId: idNumber.trim(),
            idCardImage // Optional for student, but good for admin review
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Verification failed');
        }

        toast.dismiss('verify');
        toast.success("Verification request submitted. Admin review required.");
      } else if (userData?.role === 'vendor') {
        // Vendor Verification API
        const response = await fetch('/api/verify/vendor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            fullName,
            idType,
            idNumber: idNumber.trim(),
            idCardImage
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Verification failed');
        }

        toast.dismiss('verify');
        toast.success("Vendor verification request submitted. Admin review required.");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.dismiss('verify');
      toast.error(error.message || "Verification failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300 mb-4" />
        <p className="text-gray-400 font-medium">
          Checking verification status...
        </p>
      </div>
    );
  }

  // If already verified or has a pending request
  if (request) {
    return (
      <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-gray-50 text-center max-w-2xl mx-auto">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${request.status === 'approved' ? 'bg-green-100 text-green-600' : request.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
          {request.status === 'approved' ? <CheckCircle2 className="w-10 h-10" /> : request.status === 'rejected' ? <AlertCircle className="w-10 h-10" /> : <RefreshCw className="w-10 h-10 animate-spin-slow" />}
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {request.status === 'approved' ? 'Verified Identity' : request.status === 'rejected' ? 'Verification Rejected' : 'Verification Pending'}
        </h2>
        <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Submitted Details</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Full Name</span>
              <span className="font-bold">{request.fullName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Role</span>
              <span className="font-bold capitalize">{request.role}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{request.role === 'vendor' ? request.idType?.replace('_', ' ').toUpperCase() : 'Student ID'}</span>
              <span className="font-mono font-bold">{request.role === 'vendor' ? request.idNumber : request.studentId}</span>
            </div>
          </div>
        </div>
        <p className="text-gray-500 mb-8 leading-relaxed">
          {request.status === 'approved' 
            ? 'Your account is fully verified. You have full access to all marketplace features.' 
            : request.status === 'rejected'
            ? `Your verification request was rejected. Reason: ${request.adminNote || 'No reason provided.'}`
            : 'Your verification request is currently under review by the university administration. We will notify you once it is processed.'}
        </p>

        {request.status === 'rejected' && (
          <button 
            onClick={() => setRequest(null)}
            className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-gray-50 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{userData?.role === 'vendor' ? 'Vendor Verification' : 'Student Verification'}</h2>
          <p className="text-sm text-gray-500">Complete these steps to verify your identity.</p>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-4 mb-10">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step >= s ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
              {s}
            </div>
            {s < 2 && <div className={`w-12 h-0.5 rounded-full ${step > s ? 'bg-black' : 'bg-gray-100'}`}></div>}
          </div>
        ))}
      </div>

      {/* Step 1: ID Details */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          {userData?.role === 'vendor' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select ID Type</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black font-medium text-lg appearance-none"
              >
                <option value="ghana_card">Ghana Card</option>
                <option value="passport">International Passport</option>
              </select>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Full Name
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black font-medium text-lg"
                placeholder="e.g. John Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {userData?.role === 'vendor' ? 'Enter ID Number' : 'Enter Student ID Number'}
            </label>
            <div className="relative">
              <FileText className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black font-mono text-lg"
                placeholder={userData?.role === 'vendor' ? (idType === 'ghana_card' ? 'e.g. GHA-123456789-0' : 'e.g. G1234567') : 'e.g. STU12345'}
              />
            </div>
            <p className="text-xs text-gray-400">
              {userData?.role === 'vendor' ? 'This must match your official ID document.' : 'This must match your official university ID card.'}
            </p>
          </div>
          <button 
            onClick={() => (idNumber && fullName) ? setStep(2) : toast.error("Please enter your name and ID number")}
            className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
          >
            Next Step <CheckCircle2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Step 2: ID Card Upload */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {userData?.role === 'vendor' ? 'Upload ID Document' : 'Upload Student ID Card'}
            </label>
            <div className="relative aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2rem] overflow-hidden group hover:border-black transition-all">
              {idCardImage ? (
                <div className="relative w-full h-full">
                  <Image 
                    src={idCardImage} 
                    alt="ID Card" 
                    fill 
                    className="object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <Upload className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-bold text-sm">Click to upload ID Card</p>
                  <p className="text-xs mt-1">Make sure the photo and name are clear</p>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'id')}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setStep(1)}
              className="flex-1 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
            >
              Back
            </button>
            <button 
              onClick={runAutomatedChecks}
              disabled={isSubmitting || !idCardImage}
              className="flex-[2] bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {isSubmitting ? 'Submitting...' : 'Submit Verification'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
