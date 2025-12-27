
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResponse, GeneratedStory, QuizQuestion, HistoryItem } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const translateText = async (text: string, direction: 'vi_en' | 'en_vi' = 'vi_en'): Promise<TranslationResponse> => {
  try {
    const ai = getAI();
    const isEnToVi = direction === 'en_vi';

    const prompt = `
      Translate "${text}" ${isEnToVi ? 'from English to Vietnamese' : 'from Vietnamese to English'}.
      Return JSON:
      1. "english": English version.
      2. "phonetic": IPA pronunciation.
      3. "partOfSpeech": Noun/Verb/Adj/Adv.
      4. "usageHint": A practical example sentence.
      5. "emoji": One matching emoji.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            phonetic: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            usageHint: { type: Type.STRING },
            emoji: { type: Type.STRING }
          },
          required: ["english", "phonetic", "partOfSpeech", "usageHint", "emoji"]
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return { english: "Error", phonetic: "N/A", partOfSpeech: "Error", usageHint: "Check your API key.", emoji: "⚠️" };
  }
};

export const generateStoryFromWords = async (words: string[]): Promise<GeneratedStory> => {
  try {
    const ai = getAI();
    const prompt = `Write a short bilingual story (max 100 words) using these English words: ${words.join(', ')}.
    Return JSON:
    1. "content": The English version of the story.
    2. "vietnameseContent": The Vietnamese translation.
    3. "vocabularyUsed": The list of words provided.
    4. "theme": A one-word theme for the story.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            vietnameseContent: { type: Type.STRING },
            vocabularyUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
            theme: { type: Type.STRING }
          }
        }
      }
    });

    const data = JSON.parse(response.text.trim());
    return {
      ...data,
      id: Date.now().toString(),
      timestamp: Date.now()
    };
  } catch (error) {
    throw error;
  }
};

export const generateQuizFromHistory = async (history: HistoryItem[]): Promise<QuizQuestion[]> => {
  try {
    const ai = getAI();
    const wordsJson = JSON.stringify(history.map(h => ({ en: h.english, vi: h.vietnamese })));
    const prompt = `Create 3 multiple-choice questions to test the meaning of these words: ${wordsJson}. 
    Return JSON array of objects with fields: id, question, options (array of 4), correctAnswer, explanation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    throw error;
  }
};
