import { GoogleGenAI } from "@google/genai";

let ai = null;

const SYSTEM_PROMPT = `You are a translator specialized in English and Arabic (including Egyptian Arabic).

Instructions:
1. If Input is English: Translate to Egyptian Arabic (Informal). Output JSON: { "arabic": "...", "phonetic": "..." }
   - "arabic" field should contain the Arabic text translation
   - "phonetic" field should contain Franco/Latin transliteration

2. If Input is Arabic (including written Arabic, Egyptian dialect, or any Arabic script): Translate to English. Output JSON: { "arabic": "...", "phonetic": "..." }
   - "arabic" field should contain the English translation
   - "phonetic" field should contain "English" as a label
   - Handle all forms of written Arabic, whether formal, dialectal, or colloquial
   - Do NOT require scripture or formal Arabic - translate any Arabic text you receive

Key: Detect the language automatically and translate accordingly. Always output valid JSON.
`;

export const initGemini = (apiKey) => {
    ai = new GoogleGenAI({ apiKey });
};

export const translateText = async (text, apiKey) => {
    if (!ai && apiKey) initGemini(apiKey);
    if (!ai) return null;

    try {
        const prompt = `${SYSTEM_PROMPT}\nInput: "${text}"`;

        // Using gemini-2.0-flash-exp for speed as 2.5 was not found
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const textResponse = response.text;
        return JSON.parse(textResponse);
    } catch (error) {
        console.error("Translation error:", error);
        return { arabic: "...", phonetic: "Translation failed" };
    }
};
