
import { GoogleTTS } from './google';
import { EdgeTTS } from './edge';
import { ElevenLabsTTS, OpenAITTS } from './premium';

export const TTSService = {
    async speak({ text, lang = 'en-US', provider = 'google', voiceURI = null, apiKey = null }) {
        console.log(`[TTS] Speaking via ${provider}:`, { text, lang, voiceURI });

        try {
            switch (provider) {
                case 'google':
                    return await GoogleTTS.speak(text, lang);
                case 'edge':
                    // Map voiceURI if it's a short code or use default smarts in EdgeTTS
                    return await EdgeTTS.speak(text, lang, voiceURI);
                case 'elevenlabs':
                    return await ElevenLabsTTS.speak(text, apiKey, voiceURI); // voiceURI is voiceId here
                case 'openai':
                    return await OpenAITTS.speak(text, apiKey, voiceURI); // voiceURI is voice name
                case 'system':
                default:
                    // Handled by standard hook logic, this might be a fallback call
                    throw new Error("System TTS should be handled by hook");
            }
        } catch (error) {
            console.error(`[TTS] Provider ${provider} failed:`, error);
            // Fallback chain could go here, but for now let's just error
            throw error;
        }
    }
};
