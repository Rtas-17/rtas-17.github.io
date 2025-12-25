import { useState, useEffect, useRef, useCallback } from 'react';
import { deepgramService } from '../services/deepgram';

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            // Setup listener for data
            mediaRecorder.current.addEventListener('dataavailable', event => {
                if (event.data.size > 0 && mediaRecorder.current?.state === 'recording') {
                    deepgramService.sendAudio(event.data);
                }
            });

            // Connect to Deepgram and wait for open
            deepgramService.connect();

            const waitForConnection = () => new Promise((resolve) => {
                if (deepgramService.socket?.readyState === WebSocket.OPEN) {
                    resolve();
                    return;
                }
                const unsub = deepgramService.on('status', (status) => {
                    if (status === 'connected') {
                        unsub();
                        resolve();
                    }
                });
            });

            await waitForConnection();

            mediaRecorder.current.start(250); // Send chunks every 250ms
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorder.current) {
            if (mediaRecorder.current.state !== 'inactive') {
                mediaRecorder.current.stop();
            }
            mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            deepgramService.disconnect();
        }
    }, []);

    return { isRecording, startRecording, stopRecording };
}
