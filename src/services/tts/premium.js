
export const ElevenLabsTTS = {
    async speak(text, apiKey, voiceId = '21m00Tcm4TlvDq8ikWAM') { // Default 'Rachel'
        if (!apiKey) throw new Error("ElevenLabs API Key required");

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_multilingual_v2", // Better for mixed Arabic/English
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail?.message || "ElevenLabs Error");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        return new Promise((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = reject;
            audio.play().catch(reject);
        });
    }
};

export const OpenAITTS = {
    async speak(text, apiKey, voice = 'alloy') {
        if (!apiKey) throw new Error("OpenAI API Key required");

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "tts-1",
                input: text,
                voice: voice
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "OpenAI TTS Error");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        return new Promise((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = reject;
            audio.play().catch(reject);
        });
    }
};
