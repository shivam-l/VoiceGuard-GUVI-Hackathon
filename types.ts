
export enum DetectionResultType {
  AI_GENERATED = 'AI_GENERATED',
  HUMAN = 'HUMAN'
}

export interface AnalysisResult {
  classification: DetectionResultType;
  confidence: number;
  language: string;
  reasoning: string;
  spectralNotes: string;
}

export interface AudioMetadata {
  name: string;
  size: number;
  type: string;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ta', name: 'Tamil' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'te', name: 'Telugu' }
] as const;

export interface TesterState {
  endpoint: string;
  apiKey: string;
  audioUrl: string;
  message: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  response: any;
  latency: number | null;
}

export interface HoneypotTesterState {
  endpoint: string;
  apiKey: string;
  headerKey: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  response: any;
  statusCode: number | null;
  headers: Record<string, string>;
}
