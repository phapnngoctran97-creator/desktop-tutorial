
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResponse, GrammarPoint, WordSuggestion, QuizQuestion, LearningMethods } from "../types";

// Hàm hỗ trợ khởi tạo AI với API Key hiện tại
// Phải luôn lấy từ process.env.API_KEY mỗi khi gọi để đảm bảo lấy key mới nhất từ dialog
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Basic Text Task: Using gemini-3-flash-preview
export const translateText = async (text: string, direction: 'vi_en' | 'en_vi' = 'vi_en'): Promise<TranslationResponse> => {
  try {
    const ai = getAI();
    let promptInstructions = direction === 'vi_en' 
      ? `Translate the Vietnamese word or phrase "${text}" to English.` 
      : `Translate the English word or phrase "${text}" to Vietnamese.`;

    const prompt = `
      ${promptInstructions}
      Return a clean JSON object with:
      1. "english": The English translation.
      2. "phonetic": International Phonetic Alphabet (IPA) for the English word.
      3. "partOfSpeech": Noun, Verb, Adjective, etc.
      4. "usageHint": A short tip on how to use it correctly in a sentence.
      5. "emoji": One relevant emoji character.
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

    const result = JSON.parse(response.text.trim());
    return result;
  } catch (error: any) {
    console.error("Translation Error:", error);
    
    // Xử lý lỗi Project/Key không hợp lệ
    if (error.message?.includes("entity was not found") || error.message?.includes("API key")) {
      try {
        if (window.aistudio) {
          window.aistudio.openSelectKey();
        }
      } catch (e) {}
    }

    return { 
      english: `Lỗi kết nối`, 
      phonetic: "", 
      partOfSpeech: "Error", 
      usageHint: "Vui lòng kiểm tra lại API Key hoặc trạng thái Billing của bạn.",
      emoji: "⚠️"
    };
  }
};

// Các hàm khác cũng tuân thủ việc lấy instance AI mới
export const getWordSuggestions = async (text: string, direction: 'vi_en' | 'en_vi'): Promise<WordSuggestion[]> => {
  try {
    const ai = getAI();
    const prompt = `Suggest 5 common words starting with "${text}" in ${direction === 'vi_en' ? 'Vietnamese' : 'English'}. Return JSON Array.`;
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
              word: { type: Type.STRING },
              type: { type: Type.STRING },
              meaning: { type: Type.STRING }
            },
            required: ["word", "type", "meaning"]
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch { return []; }
};

export const generateStoryFromWords = async (words: string[], theme: string = '', type: 'story' | 'dialogue' = 'story'): Promise<{ english: string, vietnamese: string, grammarPoints: GrammarPoint[], learningMethods?: LearningMethods }> => {
  try {
    const ai = getAI();
    const prompt = `Write a short ${type} with theme "${theme}" using these words: ${words.join(', ')}. Return JSON with fields: english, vietnamese, grammarPoints (array of {structure, explanation, exampleInStory, memoryTip}), learningMethods.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            vietnamese: { type: Type.STRING },
            grammarPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  structure: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  exampleInStory: { type: Type.STRING },
                  memoryTip: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch { return { english: "Error generating story.", vietnamese: "", grammarPoints: [] }; }
};

export const generateSpeech = async (text: string, voice: string = 'Kore'): Promise<string | undefined> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.replace(/<\/?[^>]+(>|$)/g, "") }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch { return undefined; }
};
