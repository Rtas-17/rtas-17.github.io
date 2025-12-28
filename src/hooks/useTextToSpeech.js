import { useState, useCallback, useEffect, useRef } from 'react';

export const useTextToSpeech = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const synthRef = useRef(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            setSupported(true);
            synthRef.current = window.speechSynthesis;
        }
    }, []);

    const speak = useCallback((text, lang = 'en-US') => {
        if (!text || !synthRef.current) return;

        // Cancel any current speaking
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        // Attempt to select a voice that matches the language
        const voices = synthRef.current.getVoices();
        const voice = voices.find(v => v.lang.startsWith(lang));
        if (voice) {
            utterance.voice = voice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error("TTS Error:", e);
            setIsSpeaking(false);
        };

        synthRef.current.speak(utterance);
    }, []);

    const cancel = useCallback(() => {
        if (synthRef.current) {
            synthRef.current.cancel();
            setIsSpeaking(false);
        }
    }, []);

    return {
        speak,
        cancel,
        isSpeaking,
        supported
    };
};
