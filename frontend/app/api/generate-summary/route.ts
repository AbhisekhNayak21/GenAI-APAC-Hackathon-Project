import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert executive project manager. Analyze the provided file text and generate a detailed analytics payload. Evaluate the file to infer precise calendar dates where possible based on relative dates. RETURN ONLY VALID JSON strictly following this schema:
{
  "keyThemes": "A detailed 1-2 paragraph breakdown of the overarching objectives, main themes, and alignment points discussed.",
  "operationalFriction": "A detailed paragraph capturing the debates, conflicts, dependencies, or operational bottlenecks.",
  "nextSteps": "A clear, actionable paragraph detailing immediate future steps and owners.",
  "urgencyBreakdown": {
    "urgent": "Critical items requiring immediate, same-week resolution.",
    "followUp": "Mid-tier tasks or outstanding questions needing tracking.",
    "fyi": "Contextual notes or passive updates passed for general awareness."
  },
  "riskAssessment": [
    { "level": "High", "description": "Severe blockers, imminent unassigned deadlines, or critical vulnerabilities." },
    { "level": "Medium", "description": "Open structural debates or missing minor dependencies." },
    { "level": "Low", "description": "Routine items tracking closely but worth monitoring." }
  ],
  "speakerAnalytics": {
    "mostMessages": [ { "name": "string", "count": 0 } ],
    "mostQuestions": [ { "name": "string", "count": 0 } ],
    "mostDecisions": [ { "name": "string", "count": 0 } ],
    "mostTasks": [ { "name": "string", "count": 0 } ]
  },
  "deadlines": [
    { "task": "string", "targetDate": "YYYY-MM-DD", "status": "Pending | In Progress | Completed" }
  ],
  "enrichedRows": [
    {
      "date": "YYYY-MM-DD",
      "decisionCount": 0,
      "conflictDetected": 0,
      "resolutionStatus": "Decided | Still Discussing | Unresolved",
      "taskStatus": "Pending | In Progress | Completed"
    }
  ]
}
Ensure speaker analytics arrays contain AT MOST the top 3 speakers for each category based on the text. If no deadlines exist, return an empty array. Evaluate every distinct conversational point in the transcript and map it sequentially into the enrichedRows array to classify raw conversational context.

Document Context:
${transcript}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    const summary = result.response.text();

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
