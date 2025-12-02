
import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { TranslationResponse, GeneratedStory, GrammarPoint, WordSuggestion, QuizQuestion } from "../types";

const getAIClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Common safety settings to prevent blocking of educational content
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Helper to clean Markdown code blocks from JSON string
const cleanJsonResponse = (text: string): string => {
  if (!text) return "{}";
  // Remove ```json ... ``` or ``` ... ``` wrappers
  let clean = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  return clean;
};

export const translateText = async (text: string, direction: 'vi_en' | 'en_vi' = 'vi_en'): Promise<TranslationResponse> => {
  try {
    const ai = getAIClient();
    
    let promptInstructions = "";
    
    if (direction === 'vi_en') {
      promptInstructions = `
        Translate the following Vietnamese text to English.
        Vietnamese: "${text}"
        
        Return JSON with:
        1. "english": The English translation.
        2. "phonetic": The IPA transcription of the English translation.
      `;
    } else {
      promptInstructions = `
        Translate the following English text to Vietnamese.
        English: "${text}"
        
        Return JSON with:
        1. "english": The Vietnamese translation (Put the Vietnamese result here).
        2. "phonetic": The IPA transcription of the INPUT English text.
      `;
    }

    const prompt = `
      ${promptInstructions}
      3. "partOfSpeech": The grammatical category (e.g., Noun, Verb).
      4. "usageHint": A brief tip, collocation, or very short example of how to use the English word/phrase naturally.
      
      Response JSON Schema:
      {
        "english": "string",
        "phonetic": "string",
        "partOfSpeech": "string",
        "usageHint": "string"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        safetySettings: safetySettings,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            phonetic: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            usageHint: { type: Type.STRING },
          },
        },
      }
    });

    const cleanText = cleanJsonResponse(response.text || "");
    return JSON.parse(cleanText) as TranslationResponse;
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    return { 
      english: "Error translating", 
      phonetic: "",
      partOfSpeech: "Unknown", 
      usageHint: "Please check your network." 
    };
  }
};

export const getWordSuggestions = async (text: string, direction: 'vi_en' | 'en_vi'): Promise<WordSuggestion[]> => {
  try {
    const ai = getAIClient();
    const lang = direction === 'vi_en' ? 'Vietnamese' : 'English';
    const targetLang = direction === 'vi_en' ? 'English' : 'Vietnamese';

    if (text.length > 40) return [];

    const prompt = `
      The user is typing a word in ${lang}: "${text}".
      Suggest up to 5 relevant completions or related words.
      For each suggestion, provide the word, its part of speech, and a short meaning in ${targetLang}.
      
      Response format: JSON Array.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        safetySettings: safetySettings,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              type: { type: Type.STRING },
              meaning: { type: Type.STRING }
            }
          }
        }
      }
    });

    const cleanText = cleanJsonResponse(response.text || "[]");
    return JSON.parse(cleanText);
  } catch (error) {
    console.warn("Suggestion Error", error);
    return [];
  }
};

export const generateStoryFromWords = async (words: string[], theme: string = '', type: 'story' | 'dialogue' = 'story'): Promise<{ english: string, vietnamese: string, grammarPoints: GrammarPoint[] }> => {
  const ai = getAIClient();
  const wordListStr = words.join(', ');
  
  // ATTEMPT 1: Structured JSON Generation
  try {
    const typeInstruction = type === 'dialogue' 
      ? `Create a dialogue between two named characters. Format: "Name: Content". Use newlines.` 
      : `Create a short story (150 words).`;

    const prompt = `
      ${typeInstruction}
      Theme: "${theme}".
      Vocab to use: ${wordListStr}.
      
      Requirements:
      1. Wrap vocabulary words in <b> tags.
      2. Use mixed tenses (Present, Past, Perfect).
      3. Analyze 2 grammar points.
      
      Return JSON with english, vietnamese, and grammarPoints.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        safetySettings: safetySettings,
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
                  memoryTip: { type: Type.STRING },
                }
              }
            }
          },
        },
      }
    });

    const cleanText = cleanJsonResponse(response.text || "");
    return JSON.parse(cleanText);
  } catch (error) {
    console.warn("JSON Story Generation failed, falling back to simple text...", error);
    
    // ATTEMPT 2: Fallback to Simple Text (If JSON fails)
    try {
        const fallbackPrompt = `
           Write a short English story (or dialogue) using these words: ${wordListStr}.
           Theme: ${theme}.
           Then provide a Vietnamese translation below it separated by "---".
           Highlight the words using <b> tags.
        `;
        const fallbackRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fallbackPrompt,
            config: { safetySettings: safetySettings }
        });
        
        const fullText = fallbackRes.text || "";
        const parts = fullText.split('---');
        
        return {
            english: parts[0]?.trim() || fullText,
            vietnamese: parts[1]?.trim() || "Bản dịch đang cập nhật...",
            grammarPoints: [] // No grammar points in fallback mode
        };
    } catch (fallbackError) {
        throw new Error("Could not generate content.");
    }
  }
};

export const lookupWord = async (word: string, context: string): Promise<{ phonetic: string, type: string, meaning: string, example: string }> => {
  try {
    const ai = getAIClient();
    const prompt = `
      Define "${word}" in Vietnamese based on context: "${context.substring(0, 50)}...".
      Return JSON: phonetic, type, meaning, example (English).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        safetySettings: safetySettings,
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

    const cleanText = cleanJsonResponse(response.text || "{}");
    return JSON.parse(cleanText);
  } catch (error) {
    return { phonetic: "", type: "", meaning: "Lỗi tra cứu", example: "" };
  }
};

export const generateSpeech = async (text: string, voice: string = 'Kore', isDialogue: boolean = false): Promise<string | undefined> => {
  const ai = getAIClient();
  const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "").replace(/\*/g, "").trim();
  if(!cleanText) return undefined;

  // Use Try/Catch to handle Quota Exceeded or API Errors
  try {
    // 1. Try Multi-speaker if dialogue
    if (isDialogue) {
      const speakerRegex = /^\s*([^\:\n]+)\s*:/gm;
      const matches = [...cleanText.matchAll(speakerRegex)];
      const uniqueSpeakers = [...new Set(matches.map(m => m[1].trim()))];

      if (uniqueSpeakers.length >= 2) {
        const primary = uniqueSpeakers[0];
        const secondary = uniqueSpeakers[1];
        const voice2 = ['Fenrir', 'Puck', 'Charon'].includes(voice) ? 'Kore' : 'Fenrir';

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: cleanText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            safetySettings: safetySettings,
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  { speaker: primary, voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
                  { speaker: secondary, voiceConfig: { prebuiltVoiceConfig: { voiceName: voice2 } } }
                ]
              }
            },
          },
        });
        const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audio) return audio;
      }
    }

    // 2. Standard Single Speaker
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        safetySettings: safetySettings,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    // If API fails (Quota, Network, etc.), return undefined to trigger App.tsx fallback
    return undefined; 
  }
};

export const generateQuizFromWords = async (words: string[]): Promise<QuizQuestion[]> => {
  try {
    const ai = getAIClient();
    const wordListStr = words.join(', ');
    
    const prompt = `
      Create 10 multiple-choice questions to test the user's understanding of these words: ${wordListStr}.
      Questions can be: "What does X mean?", "Fill in the blank", or "Find the synonym".
      Provide 4 options (A, B, C, D) and identify the correct one.
      
      Return JSON Array of objects.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        safetySettings: safetySettings,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.NUMBER },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            }
          }
        }
      }
    });

    const cleanText = cleanJsonResponse(response.text || "[]");
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Quiz Generation Error", error);
    throw new Error("Could not generate quiz.");
  }
};
