import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { adminDb } from '@/lib/firebase-admin';

const searchProductsDeclaration: FunctionDeclaration = {
  name: 'searchProducts',
  description: 'Search for active products in the marketplace by category or keyword.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: 'The category of the product (e.g., Electronics, Books, Clothing, Furniture, Other).',
      },
      keyword: {
        type: Type.STRING,
        description: 'A keyword to search for in the product title or description.',
      }
    }
  }
};

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are a helpful AI shopping assistant for UniMarket, a university e-commerce platform. 
Help students find products, answer questions about the marketplace, and provide recommendations.
Use the searchProducts tool to find relevant products when the user asks for recommendations or specific items.
When recommending a product, include its link (e.g., /products/123). Keep your responses concise, friendly, and format them using Markdown.`;

    let response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-preview',
      contents: messages,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: [{ functionDeclarations: [searchProductsDeclaration] }]
      }
    });

    // Handle function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      if (call.name === 'searchProducts') {
        const args = call.args as any;
        const category = args.category;
        const keyword = args.keyword?.toLowerCase();

        let query: any = adminDb!.collection('products').where('status', '==', 'active');
        
        if (category) {
          // Capitalize first letter for category matching
          const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
          query = query.where('category', '==', formattedCategory);
        }

        // Limit to 50 to prevent massive reads
        const snapshot = await query.limit(50).get();
        let products = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

        if (keyword) {
          products = products.filter((p: any) => 
            p.title?.toLowerCase().includes(keyword) || 
            p.description?.toLowerCase().includes(keyword)
          );
        }

        // Limit to top 10 results for the AI context
        products = products.slice(0, 10);

        const functionResponse = {
          name: 'searchProducts',
          response: {
            products: products.map((p: any) => ({
              id: p.id,
              title: p.title,
              category: p.category,
              price: p.price,
              description: p.description
            }))
          }
        };

        // Send the function response back to the model
        const newContents = [
          ...messages,
          response.candidates?.[0]?.content,
          {
            role: 'user',
            parts: [{ functionResponse }]
          }
        ];

        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-preview',
          contents: newContents,
          config: {
            systemInstruction,
            temperature: 0.7,
            tools: [{ functionDeclarations: [searchProductsDeclaration] }]
          }
        });
      }
    }

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
}
