
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResponse, GeneratedStory, GrammarPoint, WordSuggestion, QuizQuestion, LearningMethods } from "../types";

// Always use the API Key from process.env.API_KEY
// Initialization as per guideline: const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const translateText = async (text: string, direction: 'vi_en' | 'en_vi' = 'vi_en'): Promise<TranslationResponse> => {
  try {
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

    // Always use ai.models.generateContent with model name and prompt directly
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

    // Extracting text output via .text property as per guideline
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error("Translation Error:", error);
    return { english: `Lỗi: ${error.message}`, phonetic: "", partOfSpeech: "System", usageHint: "Đã có lỗi xảy ra khi gọi AI." };
  }
};

export const getWordSuggestions = async (text: string, direction: 'vi_en' | 'en_vi'): Promise<WordSuggestion[]> => {
  try {
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
    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch { return []; }
};

export const generateStoryFromWords = async (words: string[], theme: string = '', type: 'story' | 'dialogue' = 'story'): Promise<{ english: string, vietnamese: string, grammarPoints: GrammarPoint[], learningMethods?: LearningMethods }> => {
  const prompt = `Create a ${type} with theme "${theme}" using: ${words.join(', ')}. Wrap keywords in <b> tags. Return JSON with english, vietnamese, grammarPoints (structure, explanation, exampleInStory, memoryTip), learningMethods (memorization, speaking).`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
};

export const lookupWord = async (text: string, context: string): Promise<any> => {
  const prompt = `Define "${text}" in context: "${context}". Return JSON: phonetic, type, meaning, example, emoji.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
};

export const generateSpeech = async (text: string, voice: string = 'Kore'): Promise<string | undefined> => {
  try {
    // Generate speech using the correct model and modality
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
  const prompt = `Create 10 multiple choice questions (MCQs) for the following words: ${words.join(', ')}. Return a JSON array of objects with id, question, options (array of 4 strings), correctAnswer, and explanation.`;
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
          },
          required: ["id", "question", "options", "correctAnswer", "explanation"]
        }
      }
    }
  });
  const jsonStr = response.text.trim();
  return JSON.parse(jsonStr);
};
