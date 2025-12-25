import { useState, useRef, useCallback } from 'react';
import { assemblyAIService } from '../services/assemblyai';

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef(null);

    const startRecording = useCallback(async () => {
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            // Setup listener for data
            mediaRecorder.current.addEventListener('dataavailable', event => {
                if (event.data.size > 0 && mediaRecorder.current?.state === 'recording') {
                    assemblyAIService.sendAudio(event.data);
                }
            });

            // Connect to AssemblyAI and wait for connection
            // The connect() method now returns a Promise that resolves when connected
            await assemblyAIService.connect();

            mediaRecorder.current.start(250); // Send chunks every 250ms
            setIsRecording(true);
        } catch (err) {
            console.error('Error starting recording:', err);
            // Clean up on error - stop any active media tracks
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            alert(`Failed to start recording: ${err.message || 'Unknown error'}`);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorder.current) {
            if (mediaRecorder.current.state !== 'inactive') {
                mediaRecorder.current.stop();
            }
            mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            assemblyAIService.disconnect();
        }
    }, []);

    return { isRecording, startRecording, stopRecording };
}
