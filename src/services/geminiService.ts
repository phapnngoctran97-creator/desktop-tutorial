
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResponse, GrammarPoint, WordSuggestion, QuizQuestion, LearningMethods } from "../types";

// Hàm hỗ trợ khởi tạo AI với API Key hiện tại
const createAIClient = () => {
  // Always use process.env.API_KEY directly as a named parameter
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Basic Text Task: Using gemini-3-flash-preview
export const translateText = async (text: string, direction: 'vi_en' | 'en_vi' = 'vi_en'): Promise<TranslationResponse> => {
  try {
    const ai = createAIClient();
    let promptInstructions = direction === 'vi_en' 
      ? `Translate to English: "${text}"` 
      : `Translate to Vietnamese: "${text}"`;

    const prompt = `
      ${promptInstructions}
      Return JSON with:
      1. "english": The translation result.
      2. "phonetic": IPA of English word.
      3. "partOfSpeech": Category.
      4. "usageHint": Short usage tip.
      5. "tenses": Past, present, future (for verbs).
      6. "emoji": One relevant emoji.
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
            emoji: { type: Type.STRING },
            tenses: {
              type: Type.OBJECT,
              properties: {
                past: { type: Type.STRING },
                present: { type: Type.STRING },
                future: { type: Type.STRING },
              }
            }
          },
          required: ["english", "phonetic", "partOfSpeech", "usageHint", "emoji"]
        },
      }
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error("Translation Error:", error);
    if (error.message?.includes("entity was not found")) {
      // @ts-ignore
      window.aistudio.openSelectKey();
    }
    return { 
      english: `Lỗi: ${error.message || "Không thể kết nối"}`, 
      phonetic: "", 
      partOfSpeech: "Error", 
      usageHint: "Vui lòng kiểm tra lại API Key bằng cách nhấn vào biểu tượng cài đặt." 
    };
  }
};

// Basic Text Task: Using gemini-3-flash-preview
export const getWordSuggestions = async (text: string, direction: 'vi_en' | 'en_vi'): Promise<WordSuggestion[]> => {
  try {
    const ai = createAIClient();
    const prompt = `Suggest 5 words starting with "${text}" in ${direction === 'vi_en' ? 'Vietnamese' : 'English'}. Return JSON Array.`;
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

// Complex Text Task: Using gemini-3-pro-preview for story generation
export const generateStoryFromWords = async (words: string[], theme: string = '', type: 'story' | 'dialogue' = 'story'): Promise<{ english: string, vietnamese: string, grammarPoints: GrammarPoint[], learningMethods?: LearningMethods }> => {
  try {
    const ai = createAIClient();
    const prompt = `Create a ${type} with theme "${theme}" using: ${words.join(', ')}. Return JSON with english, vietnamese, grammarPoints, learningMethods.`;
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
            },
            learningMethods: {
              type: Type.OBJECT,
              properties: {
                memorization: { type: Type.ARRAY, items: { type: Type.STRING } },
                speaking: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch { return { english: "Error", vietnamese: "", grammarPoints: [] }; }
};

// Basic Text Task: Using gemini-3-flash-preview
export const lookupWord = async (text: string, context: string): Promise<any> => {
  try {
    const ai = createAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Define "${text}" in context: "${context}". Return JSON: phonetic, type, meaning, example, emoji.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            phonetic: { type: Type.STRING },
            type: { type: Type.STRING },
            meaning: { type: Type.STRING },
            example: { type: Type.STRING },
            emoji: { type: Type.STRING }
          },
          required: ["phonetic", "type", "meaning", "example"]
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch { return {}; }
};

// Fix typo in responseModalities and use gemini-2.5-flash-preview-tts for speech tasks
export const generateSpeech = async (text: string, voice: string = 'Kore'): Promise<string | undefined> => {
  try {
    const ai = createAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.replace(/<\/?[^>]+(>|$)/g, "") }] }],
      config: {
        // Fix spelling: responseModalities instead of responseModalalities
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch { return undefined; }
};

// Basic Text Task: Using gemini-3-flash-preview
export const generateQuizFromWords = async (words: string[]): Promise<QuizQuestion[]> => {
  try {
    const ai = createAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create quiz for: ${words.join(', ')}. Return JSON Array.`,
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
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch { return []; }
};
