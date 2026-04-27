import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    if (!adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const userDoc = await adminDb.collection('users').doc(id).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data()!;

    // Only return safe public fields
    const publicProfile = {
      uid: userData.uid,
      displayName: userData.displayName,
      photoURL: userData.photoURL,
      role: userData.role,
      isVerified: userData.isVerified,
      createdAt: userData.createdAt,
    };

    return NextResponse.json(publicProfile);
  } catch (error: any) {
    console.error('Error fetching public profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
