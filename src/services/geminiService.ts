import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { TranslationResponse, GeneratedStory, GrammarPoint, WordSuggestion, QuizQuestion, LearningMethods } from "../types";

const getAIClient = () => {
  // Strictly require API Key from Dashboard (Settings)
  // Trim the key to avoid copy-paste errors
  const apiKey = localStorage.getItem('VOCA_CUSTOM_API_KEY')?.trim();

  if (!apiKey) {
    throw new Error("API Key not found. Please enter your Google Gemini API Key in the Settings menu.");
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

// Common safety settings to prevent blocking of educational content
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Helper to clean Markdown code blocks from JSON string and find JSON objects/arrays
const cleanJsonResponse = (text: string): string => {
  if (!text) return "{}";
  
  // Remove markdown code blocks if present
  let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Attempt to find the outermost JSON object or array
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');

  // Determine if it looks like an Object or an Array
  // We prioritize whichever comes first and has a matching pair
  let isObject = false;
  let isArray = false;

  if (firstBrace !== -1 && lastBrace !== -1) isObject = true;
  if (firstBracket !== -1 && lastBracket !== -1) isArray = true;

  if (isObject && isArray) {
    // If both exist, take the one that starts earlier
    if (firstBracket < firstBrace) {
       clean = clean.substring(firstBracket, lastBracket + 1);
    } else {
       clean = clean.substring(firstBrace, lastBrace + 1);
    }
  } else if (isObject) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  } else if (isArray) {
    clean = clean.substring(firstBracket, lastBracket + 1);
  }

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
      5. "tenses": If the word is a VERB, provide an object with "past" (Simple Past), "present" (Simple Present 3rd person/Base), and "future" (Simple Future). If not a verb or not applicable, return empty strings for these fields.
      6. "emoji": A single relevant emoji or a set of emojis representing the word/meaning to act as an icon/illustration. If abstract, use a symbolic emoji.
      
      Response JSON Schema:
      {
        "english": "string",
        "phonetic": "string",
        "partOfSpeech": "string",
        "usageHint": "string",
        "emoji": "string",
        "tenses": {
           "past": "string",
           "present": "string",
           "future": "string"
        }
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
        },
      }
    });

    if (!response || !response.text) {
        throw new Error("Empty response from AI (Content Blocked?)");
    }

    const cleanText = cleanJsonResponse(response.text);
    return JSON.parse(cleanText) as TranslationResponse;
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    
    // Extract precise error message
    let msg = error?.message || String(error);
    
    // Friendly error mapping for user
    if (msg.includes("400") || msg.includes("API key")) {
        msg = "Invalid API Key. Please check your settings.";
    } else if (msg.includes("429") || msg.includes("quota")) {
        msg = "Quota Exceeded. Please try again later.";
    } else if (msg.includes("fetch failed") || msg.includes("Network")) {
        msg = "Network Error. Please check internet connection.";
    } else if (msg.includes("503") || msg.includes("Overloaded")) {
        msg = "AI Server Busy. Please try again.";
    }

    return { 
      english: `Error: ${msg}`, 
      phonetic: "",
      partOfSpeech: "System", 
      usageHint: "Check the error message above."
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

export const generateStoryFromWords = async (words: string[], theme: string = '', type: 'story' | 'dialogue' = 'story'): Promise<{ english: string, vietnamese: string, grammarPoints: GrammarPoint[], learningMethods?: LearningMethods }> => {
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
      4. Provide 'learningMethods' in VIETNAMESE language to help the user learn these specific words and this story:
         - memorization: List 2 specific mnemonic or imagery tips to remember the vocabulary.
         - speaking: List 2 specific roleplay ideas or questions to practice speaking based on this story context.
      
      Return JSON with english, vietnamese, grammarPoints, and learningMethods.
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
            },
            learningMethods: {
              type: Type.OBJECT,
              properties: {
                memorization: { type: Type.ARRAY, items: { type: Type.STRING } },
                speaking: { type: Type.ARRAY, items: { type: Type.STRING } }
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

export const lookupWord = async (text: string, context: string): Promise<{ phonetic: string, type: string, meaning: string, example: string, emoji?: string }> => {
  try {
    const ai = getAIClient();
    
    const isSentence = text.trim().split(/\s+/).length > 3;
    
    let prompt = "";
    if (isSentence) {
        prompt = `
          Translate and explain this English sentence/phrase to Vietnamese: "${text}".
          Context: "${context.substring(0, 100)}...".
          
          Return JSON:
          - phonetic: (Leave empty or simplified pronunciation guide if applicable)
          - type: "Sentence" or "Phrase"
          - meaning: The Vietnamese translation.
          - example: A grammatical note or key vocabulary from the sentence.
        `;
        // NO Emoji for sentences
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

    } else {
        prompt = `
          Define the word "${text}" in Vietnamese based on context: "${context.substring(0, 100)}...".
          Return JSON: phonetic, type, meaning, example (English), and a relevant emoji.
        `;
        // Include Emoji for single words
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
                    emoji: { type: Type.STRING },
                },
                },
            }
        });
        const cleanText = cleanJsonResponse(response.text || "{}");
        return JSON.parse(cleanText);
    }

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
      IMPORTANT: The "correctAnswer" field MUST contain the EXACT string value of one of the options in the "options" array, not just the letter (A/B/C/D).
      
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
