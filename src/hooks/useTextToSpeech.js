import { useState, useCallback, useEffect, useRef } from 'react';
import { TTSService } from '../services/tts';

export const useTextToSpeech = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const [voices, setVoices] = useState([]);
    const synthRef = useRef(null);
    const audioRef = useRef(null); // For non-system audio

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            setSupported(true);
            synthRef.current = window.speechSynthesis;

            const loadVoices = () => {
                let vs = window.speechSynthesis.getVoices();
                if (vs.length > 0) setVoices(vs);
            };

            loadVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
    }, []);

    const speak = useCallback(async (text, lang = 'en-US', voiceURI = null) => {
        if (!text) return;

        // 1. Get Settings
        const provider = localStorage.getItem('tts_provider') || 'google'; // Default to Google now!
        const elevenKey = localStorage.getItem('elevenlabs_key');
        const openAIKey = localStorage.getItem('openai_key');

        // Cancel previous
        cancel();

        if (provider === 'system') {
            if (!synthRef.current) return;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;

            // ... (Keep existing Voice Selection Logic for System) ...
            const allVoices = synthRef.current.getVoices();
            let selectedVoice = null;
            if (voiceURI) selectedVoice = allVoices.find(v => v.voiceURI === voiceURI);
            if (!selectedVoice) selectedVoice = allVoices.find(v => v.lang === lang);
            if (!selectedVoice) {
                const prefix = lang.split('-')[0];
                selectedVoice = allVoices.find(v => v.lang.startsWith(prefix)) || allVoices.find(v => v.lang.includes(prefix));
            }

            if (selectedVoice) utterance.voice = selectedVoice;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            synthRef.current.speak(utterance);
        } else {
            // Cloud / External Providers
            setIsSpeaking(true);
            try {
                // Pass apiKey based on provider
                let key = null;
                if (provider === 'elevenlabs') key = elevenKey;
                if (provider === 'openai') key = openAIKey;

                await TTSService.speak({
                    text,
                    lang,
                    provider,
                    voiceURI,
                    apiKey: key
                });
            } catch (err) {
                console.error("TTS Service Failed:", err);

                // Automatic Fallback to System Voices (Safety Net for Production)
                if (provider !== 'system') {
                    console.warn(`Falling back to System TTS due to ${provider} failure.`);
                    try {
                        // Recursively call for system
                        if (!synthRef.current) return;
                        const utterance = new SpeechSynthesisUtterance(text);
                        utterance.lang = lang;
                        utterance.onstart = () => setIsSpeaking(true);
                        utterance.onend = () => setIsSpeaking(false);
                        utterance.onerror = () => setIsSpeaking(false);
                        synthRef.current.speak(utterance);
                        return;
                    } catch (sysErr) {
                        console.error("System Fallback failed:", sysErr);
                    }
                }

                alert(`TTS Error (${provider}): ${err.message}`);
            } finally {
                // If allowed to fall through
                if (provider === 'system') setIsSpeaking(false);
            }
        }
    }, []);

    const cancel = useCallback(() => {
        if (synthRef.current) {
            synthRef.current.cancel();
        }
        // If we had a global audio object for cloud TTS, we'd pause it here.
        // The current simple service implementation creates new Audio() each time.
        // Ideally we should track the active Audio object to stop it. 
        // For this MVP, native Audio stops on page methods, but we can't easily stop "await audio.play()" remotely 
        // without refining the service to return the audio object.
        setIsSpeaking(false);
    }, []);

    return {
        speak,
        cancel,
        isSpeaking,
        supported,
        voices
    };
};
