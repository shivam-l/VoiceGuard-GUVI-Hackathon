
import { GoogleGenAI, Type } from "@google/genai";
import { DetectionResultType, AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function analyzeAudio(
  base64Audio: string,
  mimeType: string,
  targetLanguage: string
): Promise<AnalysisResult> {
  const model = 'gemini-3-flash-preview';
  
  const systemInstruction = `
    You are an expert audio forensic analyst specialized in detecting AI-generated voices (deepfakes).
    Analyze the provided audio sample for:
    1. Spectral anomalies common in synthetic speech.
    2. Inconsistencies in breathing patterns and prosody.
    3. Artifacts from specific TTS engines (e.g., metallic timbre, robotic pacing).
    4. Language: ${targetLanguage}.
    
    You must classify the audio as either HUMAN or AI_GENERATED.
    Provide a confidence score from 0.0 to 1.0.
    Provide a detailed reasoning and specific spectral notes.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio
          }
        },
        {
          text: `Analyze this voice sample for authenticity. The spoken language is expected to be ${targetLanguage}.`
        }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          classification: {
            type: Type.STRING,
            description: "Must be 'AI_GENERATED' or 'HUMAN'",
          },
          confidence: {
            type: Type.NUMBER,
            description: "Confidence score between 0.0 and 1.0",
          },
          language: {
            type: Type.STRING,
            description: "Detected or confirmed language",
          },
          reasoning: {
            type: Type.STRING,
            description: "Detailed explanation of the classification",
          },
          spectralNotes: {
            type: Type.STRING,
            description: "Notes on the frequency domain analysis",
          }
        },
        required: ["classification", "confidence", "language", "reasoning", "spectralNotes"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return {
      classification: data.classification as DetectionResultType,
      confidence: data.confidence,
      language: data.language,
      reasoning: data.reasoning,
      spectralNotes: data.spectralNotes
    };
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Invalid response from analysis engine.");
  }
}
