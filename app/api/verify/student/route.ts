import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { fullName, studentId, idCardImage } = await req.json();

    if (!fullName || !studentId) {
      return NextResponse.json({ error: 'Full Name and Student ID are required' }, { status: 400 });
    }

    // 0. Check if user is already verified
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data()?.isVerified) {
      return NextResponse.json({ error: 'Account is already verified' }, { status: 400 });
    }

    // 1. Check against master dataset
    const masterDoc = await adminDb.collection('students_master').doc(studentId).get();

    if (!masterDoc.exists) {
      return NextResponse.json({ error: 'Student ID not found in university records' }, { status: 404 });
    }

    const masterData = masterDoc.data();
    const masterName = masterData?.fullName?.toLowerCase() || '';
    const inputName = fullName.toLowerCase();

    // Fuzzy match name (check if input name is contained in master name or vice versa)
    const isNameMatch = masterName.includes(inputName) || inputName.includes(masterName);

    if (!isNameMatch) {
      return NextResponse.json({ error: 'Name does not match our records for this Student ID' }, { status: 400 });
    }

    // 2. Check if a request already exists
    const existingRequest = await adminDb.collection('verification_requests').doc(uid).get();
    if (existingRequest.exists && existingRequest.data()?.status === 'pending') {
      return NextResponse.json({ error: 'A verification request is already pending' }, { status: 400 });
    }

    // 3. Create Pending Verification Record
    const requestData = {
      userId: uid,
      role: 'student',
      fullName: masterData?.fullName,
      studentId: studentId,
      idCardImage: idCardImage || null, // Optional for Phase 1 if just matching dataset, but good for admin audit
      status: 'pending',
      autoMatch: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await adminDb.collection('verification_requests').doc(uid).set(requestData);

    return NextResponse.json({ 
      success: true, 
      message: 'Verification request submitted successfully. Awaiting admin approval.' 
    });

  } catch (error: any) {
    console.error('Student verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
