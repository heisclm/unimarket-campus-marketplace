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

  // Camera states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 480, height: 480, facingMode: 'user' } 
      });
      setStream(mediaStream);
      setCameraActive(true);
      // Brief delay to ensure component is rendered to DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error("Error starting camera:", err);
      toast.error("Could not access camera. Please check browser permissions, or select/upload a portrait file directly.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 480, 480);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setSelfieImage(dataUrl);
      stopCamera();
      toast.success("Selfie captured successfully!");
    }
  };

  const runAutomatedChecks = async () => {
    if (!user) return;
    if (!idNumber || !fullName || !idCardImage || !selfieImage) {
      toast.error("Please complete all steps first");
      return;
    }

    setIsSubmitting(true);
    toast.loading("Analyzing face biometrics with Gemini AI...", { id: 'verify' });

    try {
      const idToken = await user.getIdToken();
      
      // 1. Call face similarity comparison API
      let similarityScore = 0;
      let matched = false;

      try {
        const faceRes = await fetch('/api/verify/face', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            idCardImage,
            selfieImage
          })
        });

        if (faceRes.ok) {
          const faceResult = await faceRes.json();
          similarityScore = faceResult.similarityScore || 0;
          matched = faceResult.isMatch || false;
          
          if (matched) {
            toast.success(`Facial Biometry Match! Score: ${similarityScore}%`, { id: 'verify', duration: 4000 });
          } else {
            toast.success(`Face mismatch identified (${similarityScore}%). Logging for comprehensive admin review.`, { id: 'verify', duration: 4000 });
          }
        } else {
          console.warn("Face verification returned non-OK status. Proceeding with manual review.");
          toast.success("Scanning completed. Logging registration for review.", { id: 'verify', duration: 4000 });
        }
      } catch (faceErr) {
        console.error("Biometric face matching error:", faceErr);
        toast.success("Face comparison server fallback. Proceeding with review.", { id: 'verify', duration: 4500 });
      }

      // 2. Submit formal registration request
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
            idCardImage,
            selfieImage,
            faceScore: similarityScore,
            isMatch: matched
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Verification failed');
        }

        toast.success("Student verification details submitted successfully!");
      } else if (userData?.role === 'vendor') {
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
            idCardImage,
            selfieImage,
            faceScore: similarityScore,
            isMatch: matched
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Verification failed');
        }

        toast.success("Vendor verification request standard submitted. Awaiting admin review.");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
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
      <div className="bg-white rounded-[2rem] p-6 md:p-12 shadow-sm border border-gray-50 text-center max-w-2xl mx-auto">
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
    <div className="bg-white rounded-[2rem] p-6 md:p-12 shadow-sm border border-gray-50 max-w-3xl mx-auto">
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
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step >= s ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
              {s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 rounded-full ${step > s ? 'bg-black' : 'bg-gray-100'}`}></div>}
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
              onClick={() => idCardImage ? setStep(3) : toast.error("Please upload your ID Card first")}
              className="flex-[2] bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
              Next Step <CheckCircle2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Biometric Face Scan */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 text-center">
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
              Live Biometric Face Scan
            </label>
            <p className="text-xs text-gray-400 mb-4">
              To verify authenticity, look directly at the camera. We use real-time face comparison against your ID document face image to secure the community.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center">
            {cameraActive ? (
              <div className="relative w-80 h-80 rounded-[2rem] overflow-hidden border-4 border-black bg-gray-950 aspect-square shadow-xl">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 border-2 border-[#d9ff00]/40 rounded-full scale-95 pointer-events-none border-dashed animate-pulse"></div>
              </div>
            ) : selfieImage ? (
              <div className="relative w-80 h-80 rounded-[2rem] overflow-hidden border-4 border-gray-100 bg-gray-50 aspect-square shadow-xl">
                <Image 
                  src={selfieImage} 
                  alt="Captured Selfie" 
                  fill 
                  className="object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-80 h-80 rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-400 shadow-sm">
                <Camera className="w-12 h-12 mb-3" />
                <p className="font-bold text-sm">No Face Captured Yet</p>
                <p className="text-xs mt-1 text-gray-400 px-6 text-center">Use your camera or select a local photo below</p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-4 mt-6">
              {cameraActive ? (
                <>
                  <button
                    onClick={capturePhoto}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Take Snapshot
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    Cancel Scan
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startCamera}
                    className="px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Camera className="w-5 h-5 text-[#d9ff00]" /> {selfieImage ? 'Scan Face Again' : 'Start Camera Scan'}
                  </button>
                  
                  <div className="relative">
                    <button
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Upload className="w-5 h-5 text-gray-500" /> Upload Selfie Image
                    </button>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'selfie')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-100 mt-6">
            <button 
              onClick={() => {
                stopCamera();
                setStep(2);
              }}
              disabled={isSubmitting}
              className="flex-1 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              Back
            </button>
            <button 
              onClick={runAutomatedChecks}
              disabled={isSubmitting || !selfieImage}
              className="flex-[2] bg-black text-[#d9ff00] hover:text-white py-4 rounded-xl font-black uppercase tracking-wider hover:bg-gray-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin animate-spin-slow" /> : <ShieldCheck className="w-5 h-5" />}
              {isSubmitting ? 'Analyzing...' : 'Complete & Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
