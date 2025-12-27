import { useState, useCallback, useEffect } from 'react';
import { sonioxService } from '../services/soniox';

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);

    const startRecording = useCallback(async (language = 'en', targetLanguage = null, enableDiarization = false, file = null, enableTranslation = true) => {
        try {
            let stream = null;
            if (file) {
                // Simulate Stream from File
                console.log('[Hook] Simulating stream from file:', file.name);
                const arrayBuffer = await file.arrayBuffer();
                const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;

                const destination = audioContext.createMediaStreamDestination();
                source.connect(destination);
                source.start();

                stream = destination.stream;

                // Stop recording automatically when file ends
                source.onended = () => {
                    console.log('[Hook] File playback ended.');
                    stopRecording();
                };
            }

            await sonioxService.start(language, targetLanguage, enableDiarization, stream, enableTranslation);
            setIsRecording(true);
        } catch (err) {
            console.error('[Hook] Failed to start recording:', err);
            alert(`Failed to start recording: ${err.message}`);
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback(async () => {
        try {
            await sonioxService.stop();
            setIsRecording(false);
        } catch (err) {
            console.error('[Hook] Failed to stop recording:', err);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            sonioxService.stop();
        };
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording
    };
};
