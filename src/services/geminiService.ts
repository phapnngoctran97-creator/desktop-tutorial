
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResponse } from "../types";

const getAIClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const translateText = async (text: string): Promise<TranslationResponse> => {
  try {
    const ai = getAIClient();
    const prompt = `Translate the following Vietnamese text to English. 
    
    Vietnamese: "${text}"
    
    Return a JSON object with:
    1. "english": The English translation.
    2. "partOfSpeech": The grammatical category (e.g., Noun, Verb, Adjective, Phrase, Sentence).
    3. "usageHint": A brief tip, collocation, or very short example of how to use it naturally.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            usageHint: { type: Type.STRING },
          },
        },
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI");
    
    return JSON.parse(resultText) as TranslationResponse;
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    // Fallback in case of error
    return { 
      english: "Error translating", 
      partOfSpeech: "Unknown", 
      usageHint: "Please try again." 
    };
  }
};

export const generateStoryFromWords = async (words: string[], theme: string = ''): Promise<{ english: string, vietnamese: string }> => {
  try {
    const ai = getAIClient();
    const wordListStr = words.join(', ');
    const themeStr = theme ? `The story must have the following theme/genre: "${theme}".` : '';

    const prompt = `
      Create a short, engaging story (approximately 150-200 words) suitable for an English learner.
      ${themeStr}
      
      You MUST use the following vocabulary words in the story:
      ${wordListStr}

      IMPORTANT: 
      1. Wrap every occurrence of the required vocabulary words in <b>...</b> tags (e.g., <b>word</b>).
      2. The story should be simple but grammatically correct.
      3. Provide a full Vietnamese translation of the story.

      Output JSON format:
      {
        "english": "The story in English with <b>tags</b>",
        "vietnamese": "The full Vietnamese translation"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            vietnamese: { type: Type.STRING },
          },
        },
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Story Generation Error:", error);
    // Fallback in case JSON parsing fails, though rare with correct config
    return { english: "Could not generate story.", vietnamese: "Không thể tạo bản dịch." };
  }
};

export const lookupWord = async (word: string, context: string): Promise<{ phonetic: string, type: string, meaning: string, example: string }> => {
  try {
    const ai = getAIClient();
    const prompt = `
      Define the word "${word}" in Vietnamese contextually based on this sentence/context: "${context.substring(0, 100)}...".
      
      Return JSON:
      {
        "phonetic": "/.../",
        "type": "noun/verb/adj...",
        "meaning": "Meaning in Vietnamese",
        "example": "A short example sentence in English"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
          },
        },
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Lookup Error", error);
    return { phonetic: "", type: "", meaning: "Không thể tra cứu", example: "" };
  }
};
