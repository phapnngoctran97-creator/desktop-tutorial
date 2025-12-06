
export interface HistoryItem {
  id: string;
  vietnamese: string;
  english: string;
  partOfSpeech?: string;
  usageHint?: string;
  timestamp: number;
  usedInStory: boolean;
}

export interface GrammarPoint {
  structure: string; // Tên cấu trúc (e.g., Past Perfect)
  explanation: string; // Giải thích ngắn gọn
  exampleInStory: string; // Câu ví dụ trích từ truyện
  memoryTip: string; // Mẹo ghi nhớ
}

export interface LearningMethods {
  memorization: string[]; // Các phương pháp ghi nhớ từ vựng (liên tưởng, hình ảnh...)
  speaking: string[]; // Các cách thực hành giao tiếp (roleplay, questions...)
}

export interface GeneratedStory {
  id: string;
  content: string; // HTML string with bold tags for vocab (English)
  vietnameseContent: string; // Full Vietnamese translation
  timestamp: number;
  vocabularyUsed: string[];
  theme: string;
  grammarPoints?: GrammarPoint[]; // Optional for backward compatibility
  learningMethods?: LearningMethods; // New field for learning strategies
  generationTimeMs?: number; // Time taken to generate in milliseconds
}

export interface WordDefinition {
  word: string;
  phonetic: string;
  type: string;
  meaning: string;
  example: string;
  emoji?: string; // Icon minh hoạ
}

export interface TranslationResponse {
  english: string;
  phonetic: string; // IPA transcription
  partOfSpeech: string;
  usageHint: string;
  emoji?: string; // Visual illustration using Emoji
  sourceEnglish?: string; // Always holds the English text content
  tenses?: {
    past: string;    // e.g., went / walked
    present: string; // e.g., goes / walks
    future: string;  // e.g., will go / will walk
  };
}

export interface WordSuggestion {
  word: string;
  type: string; // noun, verb, adj...
  meaning: string; // short meaning
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[]; // [A, B, C, D]
  correctAnswer: string;
  explanation: string;
}
