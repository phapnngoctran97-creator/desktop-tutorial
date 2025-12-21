
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResponse, GeneratedStory, GrammarPoint, WordSuggestion, QuizQuestion, LearningMethods } from "../types";

/**
 * Helper to get a fresh instance of the GoogleGenAI client using the pre-configured API key.
 * This ensures we always pick up the runtime environment variable correctly.
 */
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API key is missing. Please ensure the API_KEY environment variable is configured.");
  }
  return new GoogleGenAI({ apiKey });
};

export const translateText = async (text: string, direction: 'vi_en' | 'en_vi' = 'vi_en'): Promise<TranslationResponse> => {
  try {
    const ai = getAI();
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
      model: 'gemini-2.5-flash-latest',
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
    return { 
      english: `Lỗi: ${error.message || "Không thể kết nối với Gemini"}`, 
      phonetic: "", 
      partOfSpeech: "System Error", 
      usageHint: "Vui lòng kiểm tra lại cấu hình API key hoặc kết nối mạng." 
    };
  }
};

export const getWordSuggestions = async (text: string, direction: 'vi_en' | 'en_vi'): Promise<WordSuggestion[]> => {
  try {
    const ai = getAI();
    const prompt = `Suggest 5 words starting with "${text}" in ${direction === 'vi_en' ? 'Vietnamese' : 'English'}. Return JSON Array.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
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
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch { return []; }
};

export const generateStoryFromWords = async (words: string[], theme: string = '', type: 'story' | 'dialogue' = 'story'): Promise<{ english: string, vietnamese: string, grammarPoints: GrammarPoint[], learningMethods?: LearningMethods }> => {
  try {
    const ai = getAI();
    const prompt = `Create a ${type} with theme "${theme}" using these words: ${words.join(', ')}. Wrap key vocabulary in <b> tags. Return JSON with english, vietnamese, grammarPoints, learningMethods.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
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
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Story Gen Error:", error);
    return { english: "Error generating story.", vietnamese: "", grammarPoints: [] };
  }
};

export const lookupWord = async (text: string, context: string): Promise<any> => {
  try {
    const ai = getAI();
    const prompt = `Define the word "${text}" as used in the context: "${context}". Return JSON: phonetic, type, meaning, example, emoji.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: prompt,
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
          }
        }
      }
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch { return {}; }
};

export const generateSpeech = async (text: string, voice: string = 'Kore'): Promise<string | undefined> => {
  try {
    const ai = getAI();
    // Use the specialized TTS preview model for audio generation
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
  } catch (err) {
    console.error("TTS Error:", err);
    return undefined;
  }
};

export const generateQuizFromWords = async (words: string[]): Promise<QuizQuestion[]> => {
  try {
    const ai = getAI();
    const prompt = `Generate 10 multiple-choice questions for the following vocabulary: ${words.join(', ')}. Return a JSON array of objects.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
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
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch { return []; }
};
