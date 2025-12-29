
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResponse, GeneratedStory, QuizQuestion, HistoryItem } from "../types";

const getAI = () => {
  const key = process.env.API_KEY;
  if (!key || key.trim() === "") {
    throw new Error("API Key chưa được cấu hình. Vui lòng kiểm tra lại Cloudflare Variables.");
  }
  return new GoogleGenAI({ apiKey: key });
};

export const translateText = async (text: string, direction: 'vi_en' | 'en_vi' = 'vi_en'): Promise<TranslationResponse> => {
  try {
    const ai = getAI();
    const isEnToVi = direction === 'en_vi';

    const prompt = `
      Task: Translate "${text}" ${isEnToVi ? 'from English to Vietnamese' : 'from Vietnamese to English'}.
      Rules: Return valid JSON with:
      1. "english": Correct English spelling.
      2. "phonetic": Accuracy IPA.
      3. "partOfSpeech": (n/v/adj/adv).
      4. "usageHint": Short example sentence.
      5. "emoji": One related emoji.
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
    return { 
      english: "Error", 
      phonetic: "/err/", 
      partOfSpeech: "error", 
      usageHint: "Vui lòng kiểm tra lại API Key.", 
      emoji: "⚠️" 
    };
  }
};

export const generateStoryFromWords = async (words: string[]): Promise<GeneratedStory> => {
  const ai = getAI();
  const prompt = `
    Write a short, engaging bilingual story (English first, then Vietnamese) using these vocabulary words: ${words.join(', ')}.
    The story should be natural and easy to remember.
    Return JSON format.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "The story in English" },
          vietnameseContent: { type: Type.STRING, description: "The story translated to Vietnamese" },
          vocabularyUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
          theme: { type: Type.STRING }
        },
        required: ["content", "vietnameseContent", "vocabularyUsed", "theme"]
      }
    }
  });

  const data = JSON.parse(response.text.trim());
  return {
    ...data,
    id: Date.now().toString(),
    timestamp: Date.now()
  };
};

export const generateQuizFromHistory = async (history: HistoryItem[]): Promise<QuizQuestion[]> => {
  const ai = getAI();
  const words = history.map(h => `${h.english} (${h.vietnamese})`).join(', ');
  const prompt = `
    Based on this list: ${words}, create 4 multiple choice questions to test vocabulary.
    Each question must have 4 options and 1 correct answer.
    Return a JSON array.
  `;

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

  return JSON.parse(response.text.trim());
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this naturally: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
};
