
export interface HistoryItem {
  id: string;
  vietnamese: string;
  english: string;
  partOfSpeech?: string;
  usageHint?: string;
  timestamp: number;
  usedInStory: boolean;
}

export interface GeneratedStory {
  id: string;
  content: string; // HTML string with bold tags for vocab (English)
  vietnameseContent: string; // Full Vietnamese translation
  timestamp: number;
  vocabularyUsed: string[];
  theme: string;
}

export interface WordDefinition {
  word: string;
  phonetic: string;
  type: string;
  meaning: string;
  example: string;
}

export interface TranslationResponse {
  english: string;
  partOfSpeech: string;
  usageHint: string;
}
