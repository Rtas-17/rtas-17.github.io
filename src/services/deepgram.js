import { createClient } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = '63771d3abb82af795c47ca56d13eb21efdade672';

export class DeepgramService {
    constructor() {
        this.socket = null;
        this.listeners = new Set();
        this.keepAliveInterval = null;
    }

    connect(accessKey = DEEPGRAM_API_KEY) {
        if (this.socket) return;

        // Using nova-2 general model.
        // detect_language=true caused connection failure (1006). Reverting to default en for stability.
        this.socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&diarize=false', [
            'token',
            accessKey,
        ]);

        this.socket.onopen = () => {
            console.log('Deepgram Connected');
            this.emit('status', 'connected');
        };

        this.socket.onmessage = (message) => {
            const received = JSON.parse(message.data);
            if (received.channel && received.channel.alternatives[0]) {
                const transcript = received.channel.alternatives[0].transcript;
                if (transcript && received.is_final) {
                    this.emit('transcript_final', transcript);
                } else if (transcript) {
                    this.emit('transcript_interim', transcript);
                }
            }
        };

        this.socket.onclose = (event) => {
            console.log(`Deepgram Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
            clearInterval(this.keepAliveInterval);
            this.socket = null;
            this.emit('status', 'disconnected');
        };

        this.socket.onerror = (error) => {
            console.error('Deepgram WebSocket Error:', error);
            this.emit('error', error);
        }
    }

    sendAudio(audioData) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(audioData);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set();
        }
        this.listeners[event].add(callback);
        // Return cleanup function
        return () => this.listeners[event].delete(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

export const deepgramService = new DeepgramService();
