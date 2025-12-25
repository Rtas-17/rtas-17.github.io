import { useState, useCallback, useRef, useEffect } from 'react';
import { assemblyAIService } from '../services/assemblyAI';

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const audioContext = useRef(null);
    const processor = useRef(null);
    const source = useRef(null);
    const mediaStream = useRef(null);

    const startRecording = useCallback(async (language = 'en') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStream.current = stream;

            // Force 16000Hz sample rate, but browser may ignore
            audioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            const actualSampleRate = audioContext.current.sampleRate;
            console.log(`[AudioRecorder] AudioContext Sample Rate: ${actualSampleRate}Hz`);

            source.current = audioContext.current.createMediaStreamSource(stream);
            processor.current = audioContext.current.createScriptProcessor(4096, 1, 1);

            source.current.connect(processor.current);
            processor.current.connect(audioContext.current.destination);

            processor.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                // Convert Float32 to Int16 PCM (Exact match from AssemblyAI Example)
                const buffer = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    buffer[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
                }

                // Send ArrayBuffer
                assemblyAIService.sendAudio(buffer.buffer);
            };

            console.log("[AudioRecorder] Connecting to AssemblyAI Service...");

            // Map 'en' -> 'en_us', 'ar' -> 'ar', 'auto' -> 'auto'
            let langCode = 'auto';
            if (language === 'en') langCode = 'en_us';
            else if (language === 'ar') langCode = 'ar';

            await assemblyAIService.connect(undefined, langCode, actualSampleRate);

            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone or connecting:', err);
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback(async () => {
        if (processor.current) {
            processor.current.disconnect();
            processor.current = null;
        }
        if (source.current) {
            source.current.disconnect();
            source.current = null;
        }
        if (audioContext.current) {
            audioContext.current.close();
            audioContext.current = null;
        }
        if (mediaStream.current) {
            mediaStream.current.getTracks().forEach(track => track.stop());
            mediaStream.current = null;
        }

        await assemblyAIService.disconnect();
        setIsRecording(false);
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording
    };
};
