import { useState, useCallback } from 'react';
import { assemblyAIService } from '../services/assemblyai';

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);

    const startRecording = useCallback(async () => {
        try {
            // Connect to AssemblyAI and start audio capture
            // The service now handles everything: token fetch, WebSocket connection, and audio streaming
            await assemblyAIService.connect();
            setIsRecording(true);
        } catch (err) {
            console.error('Error starting recording:', err);
            setIsRecording(false);
            alert(`Failed to start recording: ${err.message || 'Unknown error'}`);
        }
    }, []);

    const stopRecording = useCallback(() => {
        assemblyAIService.disconnect();
        setIsRecording(false);
    }, []);

    return { isRecording, startRecording, stopRecording };
}
