
import { GoogleGenAI, Type } from "@google/genai";
import { DetectionResultType, AnalysisResult } from "../types";

// Always use process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeAudio(
  base64Audio: string,
  mimeType: string,
  targetLanguage: string
): Promise<AnalysisResult> {
  // Switched to 'gemini-3-flash-preview' as it supports multimodal (audio) inputs via generateContent.
  // The 'gemini-2.5-flash-native-audio-preview-12-2025' model is intended for the Live API.
  const model = 'gemini-3-flash-preview';
  
  const systemInstruction = `
    You are an elite audio forensic scientist specializing in AI-generated voice detection (deepfakes).
    Your task is to analyze the provided audio for authenticity across the following criteria:
    1. Spectral Signature: Check for phase discontinuities or unnatural frequency distributions.
    2. Prosody & Breathing: Look for inconsistent intake of breath or lack of natural micro-hesitations.
    3. Artifacts: Identify specific mechanical timbres associated with TTS models (e.g., ElevenLabs, RVC, VITS).
    4. Language Context: The sample is in ${targetLanguage}.
    
    You MUST classify the output as either 'HUMAN' or 'AI_GENERATED'.
    Include a confidence score (0.0 - 1.0), a concise reasoning, and technical spectral notes.
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
          text: `Evaluate this audio sample for authenticity. Spoken Language: ${targetLanguage}. Determine if it is a real human recording or an AI-generated synthesis.`
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
            description: "The detected language",
          },
          reasoning: {
            type: Type.STRING,
            description: "Technical reasoning for the classification",
          },
          spectralNotes: {
            type: Type.STRING,
            description: "Specific observations on the audio spectrum",
          }
        },
        required: ["classification", "confidence", "language", "reasoning", "spectralNotes"]
      }
    }
  });

  try {
    const text = response.text || '{}';
    const data = JSON.parse(text);
    return {
      classification: data.classification as DetectionResultType,
      confidence: data.confidence,
      language: data.language,
      reasoning: data.reasoning,
      spectralNotes: data.spectralNotes
    };
  } catch (error) {
    console.error("Analysis decoding failed:", error);
    throw new Error("Forensic engine failed to provide a valid JSON report. Please try again.");
  }
}
