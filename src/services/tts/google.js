
const getGoogleUrl = (targetLang, encodedText) => {
    // If running on localhost, use the Vite proxy
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        const protocol = window.location.protocol;
        return `${protocol}//${window.location.host}/google-tts/translate_tts?client=gtx&ie=UTF-8&tl=${targetLang}&q=${encodedText}`;
    }
    // Production / Direct
    // Use 'tw-ob' client which is more CORS-friendly for direct browser access
    return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${targetLang}&total=1&idx=0&textlen=${encodedText.length}&client=tw-ob`;
};

export const GoogleTTS = {
    getAudioUrl(text, lang = 'en-US') {
        // Handle 'auto' or 'ar-EG' -> 'ar'
        let targetLang = lang;
        if (lang === 'auto' || !lang) {
            targetLang = /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
        } else {
            targetLang = lang.split('-')[0];
        }

        const encodedText = encodeURIComponent(text);
        return getGoogleUrl(targetLang, encodedText);
    },

    async speak(text, lang = 'en-US') {
        const url = this.getAudioUrl(text, lang);

        try {
            // Fetch the audio content directly to control headers (specifically Referrer)
            const response = await fetch(url, {
                referrerPolicy: 'no-referrer'
            });

            if (!response.ok) {
                throw new Error(`Google TTS API returned ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);

            return new Promise((resolve, reject) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl); // Cleanup
                    resolve();
                };
                audio.onerror = (e) => {
                    URL.revokeObjectURL(audioUrl);
                    reject(e);
                };
                audio.play().catch(reject);
            });
        } catch (error) {
            console.error("Google TTS Fetch Error:", error);
            throw error;
        }
    }
};
