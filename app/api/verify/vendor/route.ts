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

    const { fullName, idType, idNumber, idCardImage } = await req.json();

    if (!fullName || !idType || !idNumber || !idCardImage) {
      return NextResponse.json({ error: 'All fields including ID image are required for vendors' }, { status: 400 });
    }

    // 0. Check if user is already verified
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data()?.isVerified) {
      return NextResponse.json({ error: 'Account is already verified' }, { status: 400 });
    }

    // 1. Check if user is a vendor
    if (!userDoc.exists || userDoc.data()?.role !== 'vendor') {
      return NextResponse.json({ error: 'Only vendor accounts can use this verification method' }, { status: 403 });
    }

    // 2. Check for duplicate ID numbers across all verification requests
    const duplicateIdQuery = await adminDb.collection('verification_requests')
      .where('idNumber', '==', idNumber.trim())
      .where('status', 'in', ['pending', 'approved'])
      .get();

    if (!duplicateIdQuery.empty) {
      const duplicate = duplicateIdQuery.docs[0].data();
      if (duplicate.userId !== uid) {
        return NextResponse.json({ error: 'This ID number is already associated with another account' }, { status: 400 });
      }
    }

    // 3. Check if a request already exists for this user
    const existingRequest = await adminDb.collection('verification_requests').doc(uid).get();
    if (existingRequest.exists && existingRequest.data()?.status === 'pending') {
      return NextResponse.json({ error: 'A verification request is already pending' }, { status: 400 });
    }

    // 4. Create Pending Verification Record
    const requestData = {
      userId: uid,
      role: 'vendor',
      fullName: fullName.trim(),
      idType: idType,
      idNumber: idNumber.trim(),
      idCardImage: idCardImage,
      status: 'pending',
      autoMatch: false, // Vendors always require manual review
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await adminDb.collection('verification_requests').doc(uid).set(requestData);

    return NextResponse.json({ 
      success: true, 
      message: 'Vendor verification request submitted successfully. Awaiting admin review.' 
    });

  } catch (error: any) {
    console.error('Vendor verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
