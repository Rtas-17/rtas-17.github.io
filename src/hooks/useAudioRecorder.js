import { useState, useCallback, useEffect } from 'react';
import { sonioxService } from '../services/soniox';

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);

    const startRecording = useCallback(async (language = 'en', targetLanguage = null) => {
        try {
            await sonioxService.start(language, targetLanguage);
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
