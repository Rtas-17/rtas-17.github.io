const ASSEMBLYAI_API_KEY = 'cecc12bdb280498b9c5d37868bc79184';

export class AssemblyAIService {
    constructor() {
        this.socket = null;
        this.listeners = {};
        this.sessionId = null;
    }

    async connect(apiKey = ASSEMBLYAI_API_KEY) {
        if (this.socket) return;

        try {
            // First, get a temporary token from AssemblyAI
            const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
                method: 'POST',
                headers: {
                    'authorization': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ expires_in: 3600 })
            });

            const data = await response.json();
            const token = data.token;

            // Connect to AssemblyAI WebSocket with language detection and Arabic support
            // sample_rate=16000 is the default for browser audio
            this.socket = new WebSocket(
                `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
            );

            this.socket.onopen = () => {
                console.log('AssemblyAI Connected');
                this.emit('status', 'connected');
            };

            this.socket.onmessage = (message) => {
                const received = JSON.parse(message.data);
                
                if (received.message_type === 'SessionBegins') {
                    this.sessionId = received.session_id;
                    console.log('AssemblyAI session started:', this.sessionId);
                } else if (received.message_type === 'PartialTranscript') {
                    const transcript = received.text;
                    if (transcript) {
                        this.emit('transcript_interim', transcript);
                    }
                } else if (received.message_type === 'FinalTranscript') {
                    const transcript = received.text;
                    if (transcript) {
                        this.emit('transcript_final', transcript);
                    }
                }
            };

            this.socket.onclose = (event) => {
                console.log(`AssemblyAI Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
                this.socket = null;
                this.sessionId = null;
                this.emit('status', 'disconnected');
            };

            this.socket.onerror = (error) => {
                console.error('AssemblyAI WebSocket Error:', error);
                this.emit('error', error);
            };
        } catch (error) {
            console.error('Failed to connect to AssemblyAI:', error);
            this.emit('error', error);
        }
    }

    sendAudio(audioData) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // AssemblyAI expects base64-encoded audio data
            if (audioData instanceof Blob) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result.split(',')[1];
                    this.socket.send(JSON.stringify({ audio_data: base64Audio }));
                };
                reader.readAsDataURL(audioData);
            } else if (audioData instanceof ArrayBuffer) {
                // Convert ArrayBuffer to base64
                const base64Audio = btoa(
                    new Uint8Array(audioData).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                this.socket.send(JSON.stringify({ audio_data: base64Audio }));
            }
        }
    }

    disconnect() {
        if (this.socket) {
            // Send terminate message
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ terminate_session: true }));
            }
            this.socket.close();
            this.socket = null;
            this.sessionId = null;
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

export const assemblyAIService = new AssemblyAIService();
