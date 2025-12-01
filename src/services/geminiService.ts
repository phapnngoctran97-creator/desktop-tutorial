
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranslationResponse, GeneratedStory, GrammarPoint } from "../types";

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
    2. "phonetic": The IPA (International Phonetic Alphabet) transcription of the English translation.
    3. "partOfSpeech": The grammatical category (e.g., Noun, Verb, Adjective, Phrase, Sentence).
    4. "usageHint": A brief tip, collocation, or very short example of how to use it naturally.
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
            phonetic: { type: Type.STRING },
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
      phonetic: "",
      partOfSpeech: "Unknown", 
      usageHint: "Please try again." 
    };
  }
};

export const generateStoryFromWords = async (words: string[], theme: string = '', type: 'story' | 'dialogue' = 'story'): Promise<{ english: string, vietnamese: string, grammarPoints: GrammarPoint[] }> => {
  try {
    const ai = getAIClient();
    const wordListStr = words.join(', ');
    const themeStr = theme ? `The content must revolve around the theme: "${theme}".` : '';
    
    let typeInstruction = "";
    if (type === 'dialogue') {
      typeInstruction = `
        Create a natural conversation/dialogue between two specific characters.
        1. Invent two distinct names for the characters (e.g., "Sarah", "John", "Mom", "Doctor"). 
        2. Format the output so that EACH speaker's turn is strictly on a NEW line.
        3. Format: "Name: Dialogue content". (Example: "Tom: Hello there.")
        4. Do NOT use "Person A" or "Person B".
      `;
    } else {
      typeInstruction = "Create a short, engaging story (approximately 150-200 words).";
    }

    const prompt = `
      ${typeInstruction} suitable for an English learner.
      ${themeStr}
      
      You MUST use the following vocabulary words in the content:
      ${wordListStr}

      IMPORTANT: 
      1. Wrap every occurrence of the required vocabulary words in <b>...</b> tags (e.g., <b>word</b>).
      2. GRAMMAR REQUIREMENT: You MUST intentionally use a variety of grammatical tenses (e.g., Simple Present, Present Continuous, Present Perfect, Simple Past, Future) and sentence structures. This is CRITICAL to help the learner understand how different tenses interact in a context.
      3. Provide a full Vietnamese translation of the content.
      4. ANALYSIS: Identify and analyze 2 to 3 interesting grammatical structures, tenses, or idioms used in the text.

      Output JSON format:
      {
        "english": "The story/dialogue in English with <b>tags</b>. If dialogue, use newlines (\\n) for each speaker.",
        "vietnamese": "The full Vietnamese translation",
        "grammarPoints": [
          {
            "structure": "Name of the grammar structure (e.g., Present Perfect vs Past Simple)",
            "explanation": "Brief explanation of why this tense/structure was used in this specific context",
            "exampleInStory": "Quote the exact sentence from the text",
            "memoryTip": "A short, memorable tip or rule for this grammar point"
          }
        ]
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

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Story Generation Error:", error);
    // Fallback in case JSON parsing fails, though rare with correct config
    return { 
      english: "Could not generate content.", 
      vietnamese: "Không thể tạo nội dung.",
      grammarPoints: []
    };
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

export const generateSpeech = async (text: string, voice: string = 'Kore', isDialogue: boolean = false): Promise<string | undefined> => {
  try {
    const ai = getAIClient();
    
    // 1. Thoroughly clean the text
    // Remove HTML tags (<b>), Markdown bold (**), and other artifacts
    // Note: Do NOT remove colons (:) as they are needed for speaker detection
    const cleanText = text
      .replace(/<\/?[^>]+(>|$)/g, "") // Remove HTML tags
      .replace(/\*\*/g, "")           // Remove Markdown bold
      .replace(/\*/g, "")             // Remove asterisks
      .replace(/#/g, "")              // Remove hashes
      .trim();

    let speechConfig: any = {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
    };

    // If it's a dialogue, try to parse speakers and assign multi-speaker config
    if (isDialogue) {
        // IMPROVED REGEX: 
        // Handles: "Tom:", "**Tom**:", "Mr. Bean:", "Hùng:", " Speaker 1 :"
        // ^\s*[\*]* : Start of line, optional space, optional asterisks
        // ([^\:\*\n]+) : Capture the name (anything except colon, asterisk, or newline)
        // [\*]*\s*: : Optional asterisks, optional space, then Colon
        const speakerRegex = /^\s*[\*]*\s*([^\:\*\n]+)\s*[\*]*\s*:/gm;
        
        const matches = [...cleanText.matchAll(speakerRegex)];
        // Extract names and trim whitespace
        const uniqueSpeakers = [...new Set(matches.map(m => m[1].trim()))];

        console.log("Detected Speakers:", uniqueSpeakers);

        // Only use multi-speaker if we detected exactly 2 or more speakers
        if (uniqueSpeakers.length >= 2) {
            const speaker1 = uniqueSpeakers[0];
            const speaker2 = uniqueSpeakers[1];

            // Determine secondary voice based on primary voice to ensure contrast (Male vs Female)
            // Available: Kore (F), Fenrir (M), Puck (M), Charon (M)
            const isPrimaryMale = ['Fenrir', 'Puck', 'Charon'].includes(voice);
            const secondaryVoice = isPrimaryMale ? 'Kore' : 'Fenrir';

            speechConfig = {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        {
                            speaker: speaker1,
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
                        },
                        {
                            speaker: speaker2,
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: secondaryVoice } }
                        }
                    ]
                }
            };
        }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts", // Correct model for TTS
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: speechConfig,
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
};
