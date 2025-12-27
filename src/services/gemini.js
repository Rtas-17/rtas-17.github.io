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

export const getAvailableModels = async (apiKey) => {
    if (!ai && apiKey) initGemini(apiKey);
    if (!ai) return [];
    try {
        const response = await ai.models.list();
        const rawModels = response.models || response;
        const models = Array.isArray(rawModels) ? rawModels : (rawModels && typeof rawModels === 'object' ? Object.values(rawModels) : []);

        if (!Array.isArray(models)) return [];

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
