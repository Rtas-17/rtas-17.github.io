import { GoogleGenAI } from "@google/genai";

let ai = null;

const SYSTEM_PROMPT = `You are a translator.
If Input is English: Translate to Egyptian Arabic (Informal). Output JSON: { "arabic": "...", "phonetic": "..." }
If Input is Arabic: Translate to English. Output JSON: { "arabic": "...", "phonetic": "..." } 
Target Field 'arabic' should contain the Translation.
Target Field 'phonetic' should contain the transliteration/pronunciation (Franco/Latini).
Rule:
En -> Ar: "arabic" = Arabic Text, "phonetic" = Phonetic of Arabic Text
Ar -> En: "arabic" = English Translation, "phonetic" = Phonetic of Arabic Input
`;

export const initGemini = (apiKey) => {
    ai = new GoogleGenAI({ apiKey });
};

export const getAvailableModels = async (apiKey) => {
    if (!ai && apiKey) initGemini(apiKey);
    if (!ai) return [];
    try {
        const response = await ai.models.list();
        // The response might be an async iterable or a list depending on SDK version.
        // @google/genai usually returns a Promise that resolves to a list wrapper
        // Checking documentation: usually it returns { models: [...] } or iterable.
        // Let's assume standard array or handle it.
        // Actually, for @google/genai, it might return { models: [...] }.
        // Let's try to map it.
        const rawModels = response.models || response;
        console.log("Raw models response:", rawModels);
        const models = Array.isArray(rawModels) ? rawModels : (rawModels && typeof rawModels === 'object' ? Object.values(rawModels) : []);

        if (!Array.isArray(models)) return [];

        // Filter for generation models
        return models
            .filter(m => m && m.supportedGenerationMethods && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => ({
                name: m.name.replace('models/', ''),
                displayName: m.displayName || m.name
            }));
    } catch (e) {
        console.error("Failed to list models:", e);
        return [];
    }
};

export const translateText = async (text, apiKey, model = "gemini-3-flash-preview") => {
    if (!ai && apiKey) initGemini(apiKey);
    if (!ai) return null;

    try {
        const prompt = `${SYSTEM_PROMPT}\nInput: "${text}"`;

        const response = await ai.models.generateContent({
            model: model,
            contents: [{ text: prompt }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const textResponse = response.text;
        // Strip markdown code blocks if present
        const cleanText = textResponse.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Translation error:", error);
        return { arabic: "...", phonetic: "Translation failed" };
    }
};
