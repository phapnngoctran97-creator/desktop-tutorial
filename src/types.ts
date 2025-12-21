
export enum ToolType {
  DASHBOARD = 'DASHBOARD',
  TRANSLATE = 'TRANSLATE',
  HISTORY = 'HISTORY',
  STORIES = 'STORIES',
  QUIZ = 'QUIZ',
  SETTINGS = 'SETTINGS'
}

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
  structure: string;
  explanation: string;
  exampleInStory: string;
  memoryTip: string;
}

export interface LearningMethods {
  memorization: string[];
  speaking: string[];
}

export interface GeneratedStory {
  id: string;
  content: string;
  vietnameseContent: string;
  timestamp: number;
  vocabularyUsed: string[];
  theme: string;
  grammarPoints?: GrammarPoint[];
  learningMethods?: LearningMethods;
  generationTimeMs?: number;
}

export interface WordDefinition {
  word: string;
  phonetic: string;
  type: string;
  meaning: string;
  example: string;
  emoji?: string;
}

export interface TranslationResponse {
  english: string;
  phonetic: string;
  partOfSpeech: string;
  usageHint: string;
  emoji?: string;
  sourceEnglish?: string;
  tenses?: {
    past: string;
    present: string;
    future: string;
  };
}

export interface WordSuggestion {
  word: string;
  type: string;
  meaning: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}
