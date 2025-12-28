import { useState, useCallback, useEffect, useRef } from 'react';
import { sonioxService } from '../services/soniox';

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null);
    const streamRef = useRef(null);

    const setInputGain = useCallback((val) => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = val;
        }
    }, []);

    const startRecording = useCallback(async (language = 'en', targetLanguage = null, enableDiarization = false, file = null, enableTranslation = true, audioConfig = {}) => {
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
                audioContextRef.current = audioContext; // Keep ref to close later

                // Stop recording automatically when file ends
                source.onended = () => {
                    console.log('[Hook] File playback ended.');
                    stopRecording();
                };
            } else if (audioConfig.useCustomAudio) {
                // Connect via Custom Web Audio API Pipeline (Gain + Constraints)
                console.log('[Hook] Initializing Custom Audio Pipeline...', audioConfig);
                const constraints = {
                    audio: {
                        echoCancellation: audioConfig.echoCancellation ?? true,
                        noiseSuppression: audioConfig.noiseSuppression ?? true,
                        autoGainControl: false // We handle gain manually
                    }
                };

                const userStream = await navigator.mediaDevices.getUserMedia(constraints);
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(userStream);
                const gainNode = audioContext.createGain();

                // Set initial gain
                gainNode.gain.value = audioConfig.gain || 1.0;

                const destination = audioContext.createMediaStreamDestination();

                // Connect Graph: Mic -> Gain -> Destination
                source.connect(gainNode);
                gainNode.connect(destination);

                stream = destination.stream;

                // Store refs
                streamRef.current = userStream; // To stop tracks later
                audioContextRef.current = audioContext;
                gainNodeRef.current = gainNode;
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

            // Cleanup Custom Audio
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            gainNodeRef.current = null;

        } catch (err) {
            console.error('[Hook] Failed to stop recording:', err);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            sonioxService.stop();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        setInputGain
    };
};
