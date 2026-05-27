import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { checkProgrammaticMatch } from '@/lib/name-matcher';
import { GoogleGenAI, Type } from '@google/genai';

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

    const { fullName, studentId, idCardImage, selfieImage, faceScore, isMatch } = await req.json();

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
    const masterName = masterData?.fullName || '';

    // Run programmatic name-matching pipeline
    const matchResult = checkProgrammaticMatch(masterName, fullName);

    let isMatchApproved = false;
    let matchMethod: 'programmatic' | 'ai_fallback' | 'none' = 'none';
    let aiReason = '';
    let confidenceScore = matchResult.score;

    if (matchResult.isProgrammaticMatch) {
      isMatchApproved = true;
      matchMethod = 'programmatic';
    } else if (matchResult.isNearMiss) {
      // 1.5 Execute Gemini AI Fallback Verification for name-matching Near Misses
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const systemMessage = "You are a professional administrative verification agent. Your job is to analyze name differences and determine if a user-entered name matches the master records. Ensure names are equivalent despite inverted first/last names, typos, middle name omissions, or standard variations (e.g. Emmanuel to Manny). Return strictly valid JSON matching the schema.";

        const prompt = `Official Master Record Name: "${masterName}"\nUser Entered Name: "${fullName}"\n\nAnalyze these names for inversions, minor spelling errors, abbreviations, and middle name omissions. Decide whether they highly likely represent the same student.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            systemInstruction: systemMessage,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isMatches: {
                  type: Type.BOOLEAN,
                  description: 'Whether names match with reasonable administrative certainty'
                },
                confidence: {
                  type: Type.NUMBER,
                  description: 'Confidence value between 0.0 and 1.0 (e.g. 0.95)'
                },
                reason: {
                  type: Type.STRING,
                  description: 'administrative reasoning description'
                }
              },
              required: ['isMatches', 'confidence', 'reason']
            }
          }
        });

        const responseText = response.text || '{}';
        const aiResult = JSON.parse(responseText.trim());

        if (aiResult.isMatches && aiResult.confidence >= 0.90) {
          isMatchApproved = true;
          matchMethod = 'ai_fallback';
          confidenceScore = aiResult.confidence;
          aiReason = aiResult.reason || 'AI alignment verified';
        } else {
          aiReason = aiResult.reason || 'AI verification confidence too low';
        }
      } catch (err: any) {
        console.error('Gemini verification fallback failed:', err);
        aiReason = `Pipeline error: ${err.message || err}`;
      }
    } else {
      // Blatant mismatch (not even a near miss), reject the request immediately to protect system integrity
      return NextResponse.json({ error: 'Name does not match our records for this Student ID' }, { status: 400 });
    }

    // 2. Check if a request already exists
    const existingRequest = await adminDb.collection('verification_requests').doc(uid).get();
    if (existingRequest.exists && existingRequest.data()?.status === 'pending') {
      return NextResponse.json({ error: 'A verification request is already pending' }, { status: 400 });
    }

    // 3. Create Verification Record (Status depends on match approval result)
    const requestData = {
      userId: uid,
      role: 'student',
      fullName: masterName, // Store the official name from students_master
      studentId: studentId,
      idCardImage: idCardImage || null,
      selfieImage: selfieImage || null,
      faceScore: faceScore || null,
      faceMatchScore: faceScore || null,
      isMatch: isMatch || null,
      status: isMatchApproved ? 'approved' : 'pending',
      autoMatch: isMatchApproved,
      matchMethod,
      matchReasons: matchResult.reasons,
      aiReason: aiReason || null,
      confidenceScore: confidenceScore,
      createdAt: new Date(),
      updatedAt: new Date(),
      adminNote: isMatchApproved
        ? `Automatically verified on submission using ${matchMethod === 'programmatic' ? 'Programmatic Rules' : 'AI semantic fallback'}.`
        : `Flagged Name Near-Miss (Programmatic Score: ${(matchResult.score * 100).toFixed(0)}%). Awaiting administrative handcraft verification.`
    };

    await adminDb.collection('verification_requests').doc(uid).set(requestData);

    if (isMatchApproved) {
      // 4. Update core user verification document directly for Auto-Approval!
      await adminDb.collection('users').doc(uid).update({
        isVerified: true
      });

      // 5. Update user's products denormalization
      const productsSnap = await adminDb.collection('products')
        .where('sellerId', '==', uid)
        .get();

      if (!productsSnap.empty) {
        const batch = adminDb.batch();
        productsSnap.docs.forEach((doc) => {
          batch.update(adminDb.collection('products').doc(doc.id), {
            sellerIsVerified: true
          });
        });
        await batch.commit();
      }

      // 6. Create success notification
      const notifRef = adminDb.collection('notifications').doc();
      await notifRef.set({
        userId: uid,
        title: 'Account Verified!',
        message: 'Congratulations! Your student identity has been verified automatically. You now have full access to UniMart.',
        type: 'system',
        read: false,
        link: '/profile',
        createdAt: new Date()
      });

      // 7. Create verification audit log
      const auditRef = adminDb.collection('audit_logs').doc();
      await auditRef.set({
        action: 'verification_approved_auto',
        targetUserId: uid,
        targetRequestId: uid,
        adminNote: `Automatically verified with precision method: ${matchMethod}. Score: ${(confidenceScore * 100).toFixed(0)}%. ${aiReason}`,
        timestamp: new Date()
      });

      return NextResponse.json({
        success: true,
        autoApproved: true,
        message: 'Verification request verified automatically!'
      });
    }

    // Near miss that degrades gracefully to administrative review
    return NextResponse.json({
      success: true,
      autoApproved: false,
      message: 'Verification request submitted. Name near-miss routed for manual quick administration review.'
    });

  } catch (error: any) {
    console.error('Student verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
