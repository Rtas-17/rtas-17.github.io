import { GoogleGenAI } from "@google/genai";

let ai = null;

const BASE_SYSTEM_PROMPT = `You are a translator.
Output JSON format: { "translation": "...", "phonetic": "..." }

Rules:
1. Translate the input text from Source Language to Target Language.
2. "translation" field = The translated text.
3. "phonetic" field = The phonetic transcription of the ARABIC text involved.
   - If Source is Arabic, provide phonetics of Source.
   - If Target is Arabic, provide phonetics of Target.
   - If neither, leave empty.
`;

const getPhoneticInstruction = (style) => {
    switch (style) {
        case 'precise':
            return `   - Style: **Precise/Scientific**. 
   - You MAY use symbols like '?' (glottal stop), ':' (long vowel), '3' (Ayn), etc. to ensure exact pronunciation.
   - Focus on phonetic accuracy over readability.`;

        case 'franco':
            return `   - Style: **Franco/Arabizi**.
   - Use numbers for sounds: '2' (Hamza), '3' (Ayn), '5' (Kha), '7' (Ha), '9' (Sad/Qaf).
   - Example: "Salam 3alaykom", "Sob7an Allah".`;

        case 'clean':
        default:
            return `   - Style: **Clean/Standard**.
   - Use Macrons for long vowels (e.g. 'ā', 'ī', 'ū').
   - Use Apostrophe (') or Hamza (ʾ) for Glottal Stops.
   - DO NOT use confusing symbols like '?' or ':' or numbers.
   - Focus on readability for English speakers.`;
    }
};

const getContextualInstruction = (isContextual) => {
    if (!isContextual) return "";
    return `
   - **MODE: CONTEXTUAL / SMART TRANSLATION**
   - DO NOT translate literally. Translate the **Meaning and Intent**.
   - **Target Dialect**: Egyptian Arabic (Masri) - Informal/Street level.
   - **Tone**: Local, natural, suitable for speaking to taxi drivers, shopkeepers, or hotel staff.
   - Avoid "Touristic" or "Formal" (Fusha) phrasing. Use what a local would say.
   - Example: "Can you take me to..." -> "Moomkin tow-wuss-al-nee..." (Technically "Possible to deliver me...").
   - Example: "How much is this?" -> "Bi-kam dah?"`;
};

export const initGemini = (apiKey) => {
    ai = new GoogleGenAI({ apiKey });
};

// Hardcoded Fallback Models
const FALLBACK_MODELS = [
    { name: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash Lite (Fallback)" },
    { name: "gemini-2.0-flash-lite-preview-02-05", displayName: "Gemini 2.0 Flash Lite (Preview)" },
    { name: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash (Fallback)" },
    { name: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro (Fallback)" }
];

export const getAvailableModels = async (apiKey) => {
    console.log("[Gemini] Fetching models...");
    if (!ai && apiKey) initGemini(apiKey);

    // If Init failed, use Fallback
    if (!ai) {
        console.warn("[Gemini] AI not initialized. Returning fallback.");
        return FALLBACK_MODELS;
    }

    try {
        const response = await ai.models.list();
        console.log("[Gemini] API Response:", response);

        // Handle Pager object from SDK
        // Check for .models (standard), .page (Pager), or pure array
        let rawModels = [];
        if (response.models) {
            rawModels = response.models;
        } else if (response.page) {
            rawModels = response.page;
        } else if (Array.isArray(response)) {
            rawModels = response;
        } else if (typeof response === 'object') {
            // Fallback: try to see if it behaves like an array or has internal page
            rawModels = response.pageInternal || Object.values(response);
        }

        const models = Array.isArray(rawModels) ? rawModels : [];
        console.log("[Gemini] Extracted Models:", models);

        if (models.length === 0) {
            console.warn("[Gemini] Empty model list. Returning fallback.");
            return FALLBACK_MODELS;
        }

        // Debug: Log first model structure
        if (models.length > 0) {
            console.log("[Gemini] First Model Structure:", models[0]);
        }

        // User requested ALL models
        const filtered = models.map(m => ({
            name: m.name.replace('models/', ''),
            displayName: m.displayName || m.name
        }));

        console.log(`[Gemini] Total: ${models.length}, Filtered: ${filtered.length}`);

        if (filtered.length === 0) {
            console.warn("[Gemini] No generateContent models found. Returning fallback.");
            return FALLBACK_MODELS;
        }

        return filtered;

    } catch (e) {
        console.error("Failed to list models:", e);
        return FALLBACK_MODELS;
    }
};

export const translateText = async (text, apiKey, model = "gemini-3-flash-preview", sourceLang = 'auto', targetLang = 'en', phoneticStyle = 'clean', useContextual = false) => {
    if (!ai && apiKey) initGemini(apiKey);
    if (!ai) return null;

    try {
        const phoneticRules = getPhoneticInstruction(phoneticStyle);
        const contextRules = getContextualInstruction(useContextual);
        const prompt = `${BASE_SYSTEM_PROMPT}
${phoneticRules}
${contextRules}

Source Language: ${sourceLang}
Target Language: ${targetLang}
Input: "${text}"`;

        const response = await ai.models.generateContent({
            model: model,
            contents: [{ text: prompt }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        let textResponse = '';
        if (typeof response.text === 'function') {
            textResponse = response.text();
        } else if (typeof response.text === 'string') {
            textResponse = response.text;
        } else if (response.candidates && response.candidates[0] && response.candidates[0].content) {
            // Fallback for raw structure
            textResponse = response.candidates[0].content.parts.map(p => p.text).join('');
        }

        // Strip markdown code blocks if present
        const cleanText = textResponse.replace(/```json\n?|\n?```/g, '').trim();
        const json = JSON.parse(cleanText);

        return {
            arabic: json.translation,
            phonetic: json.phonetic
        };

    } catch (error) {
        console.error("Translation error:", error);
        return { arabic: "Translation failed", phonetic: "" };
    }
};
