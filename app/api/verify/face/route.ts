import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const { idCardImage, selfieImage } = await req.json();

    if (!idCardImage || !selfieImage) {
      return NextResponse.json({ error: 'Missing images' }, { status: 400 });
    }

    // 3. Initialize Gemini
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Missing NEXT_PUBLIC_GEMINI_API_KEY');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // 4. Prepare images for Gemini
    // Images come as base64 data URLs: data:image/jpeg;base64,...
    const extractBase64 = (dataUrl: string) => {
      const parts = dataUrl.split(';base64,');
      return {
        mimeType: parts[0].split(':')[1],
        data: parts[1]
      };
    };

    const idCardPart = {
      inlineData: extractBase64(idCardImage)
    };
    const selfiePart = {
      inlineData: extractBase64(selfieImage)
    };

    // 5. Call Gemini to compare faces
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: 'Compare the faces in these two images. Image 1 is an ID card, Image 2 is a selfie. Determine if they belong to the same person. Return a JSON object with "isMatch" (boolean) and "similarityScore" (number from 0 to 100).' },
            idCardPart,
            selfiePart
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMatch: { type: Type.BOOLEAN },
            similarityScore: { type: Type.NUMBER }
          },
          required: ['isMatch', 'similarityScore']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Face verification API error:', error);
    
    // Fallback: If AI fails, return a "pending" status so it can be manually reviewed
    // We return a 200 with a special flag so the frontend knows to proceed to manual review
    return NextResponse.json({ 
      isMatch: false, 
      similarityScore: 0, 
      fallback: true,
      error: error.message || 'AI verification failed'
    });
  }
}
