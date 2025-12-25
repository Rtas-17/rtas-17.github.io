import { GoogleGenAI } from "@google/genai";

let ai = null;

const SYSTEM_PROMPT = `You are a translator.
If Input is English: Translate to Egyptian Arabic (Informal). Output JSON: { "arabic": "...", "phonetic": "..." }
If Input is Arabic: Translate to English. Output JSON: { "arabic": "...", "phonetic": "..." } (Put English translation in 'arabic' field for UI consistency, or 'english'). 
Actually, to keep UI simple:
Target Field 'arabic' should contain the Translation.
Target Field 'phonetic' should contain the transliteration/pronunciation/or empty if not needed.
Rule:
En -> Ar: "arabic" = Arabic Text, "phonetic" = Franco/Latini
Ar -> En: "arabic" = English Translation, "phonetic" = "English" (label)
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
