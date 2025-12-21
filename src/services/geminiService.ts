
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResponse, GrammarPoint, WordSuggestion, QuizQuestion, LearningMethods } from "../types";

/**
 * Khởi tạo client AI. 
 * API Key được lấy từ process.env.API_KEY (được platform tự động inject sau khi chọn key).
 */
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const translateText = async (text: string, direction: 'vi_en' | 'en_vi' = 'vi_en'): Promise<TranslationResponse> => {
  try {
    const ai = getAI();
    const isEnToVi = direction === 'en_vi';

    const prompt = `
      Task: Translate "${text}" ${isEnToVi ? 'from English to Vietnamese' : 'from Vietnamese to English'}.
      Return a JSON object with:
      1. "english": The English version of the word.
      2. "phonetic": Standard IPA phonetic.
      3. "partOfSpeech": Noun, Verb, etc.
      4. "usageHint": A practical example sentence or tip.
      5. "emoji": A single representative emoji.
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
        },
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    
    // Nếu lỗi do key (404/entity not found), yêu cầu người dùng chọn lại key
    if (error.message?.includes("not found") || error.message?.includes("API_KEY")) {
      if (window.aistudio && window.aistudio.openSelectKey) {
        window.aistudio.openSelectKey();
      }
    }

    return { 
      english: "Error", 
      phonetic: "N/A", 
      partOfSpeech: "N/A", 
      usageHint: "Không thể kết nối AI. Vui lòng kiểm tra API Key.",
      emoji: "❌"
    };
  }
};

export const generateStoryFromWords = async (words: string[]): Promise<any> => {
  try {
    const ai = getAI();
    const prompt = `Write a short story using these words: ${words.join(', ')}. Return JSON with fields: english, vietnamese.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text.trim());
  } catch {
    return { english: "Error", vietnamese: "Lỗi" };
  }
};
