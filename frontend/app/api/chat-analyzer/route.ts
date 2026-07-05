import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { transcript, question, history = [] } = await req.json();

    if (!transcript || !question) {
      return NextResponse.json({ error: 'Transcript and question are required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `You are an expert Data Analyzer Agent. Analyze the provided data from the uploaded file and answer the user's questions in a genuine, direct 1–2 sentences based strictly on this resource without inventing any outside information.\n\nContext:\n${transcript}`
    });

    // Format history for Gemini SDK
    const formattedHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: formattedHistory
    });

    const result = await chat.sendMessage(question);
    const response = result.response.text();

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('Error in chat-analyzer:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
