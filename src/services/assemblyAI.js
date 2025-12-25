const ASSEMBLY_API_KEY = 'cecc12bdb280498b9c5d37868bc79184';

export class AssemblyAIService {
    constructor() {
        this.socket = null;
        this.listeners = {};
        this.sampleRate = 16000;
    }

    async connect(apiKey = ASSEMBLY_API_KEY, languageCode = 'en_us', sampleRate = 16000) {
        if (this.socket) return;

        this.sampleRate = sampleRate;

        let url = `wss://streaming.assemblyai.com/v3/ws?sample_rate=${this.sampleRate}&formatted_finals=true&token=${apiKey}`;

        if (languageCode !== 'en_us') {
            // Auto/Arabic Mode: Use Multilingual Model + Detection
            // Note: 'language_code' input is NOT supported in V3, detection is the only valid way for non-English.
            // Valid model: 'universal-streaming-multilingual' (Supports: en, es, fr, de, it, pt. Arabic support checks in progress).
            url += `&speech_model=universal-streaming-multilingual&language_detection=true`;
        }
        // If Default 'en_us', use CLEAN URL (defaults to universal-streaming-english)

        console.log(`[AssemblyAI] Connecting: ${url.replace(apiKey, "HIDDEN")}`);

        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                console.log('[AssemblyAI] WebSocket Connected');
                this.emit('status', 'connected');
                resolve();
            };

            this.socket.onmessage = (message) => {
                console.log('[AssemblyAI] Raw Message:', message.data);
                const data = JSON.parse(message.data);

                // Handle V3 "Begin" (Session Started)
                if (data.type === 'Begin') {
                    console.log('[AssemblyAI] Session Started:', data.id);

                    // Handle V3 "Turn" (Transcripts)
                } else if (data.type === 'Turn') {
                    // Preference: Use formatted final text if available
                    if (data.turn_is_formatted && data.transcript) {
                        console.log('[AssemblyAI] Final:', data.transcript);
                        this.emit('transcript_final', data.transcript);
                    }
                    // Otherwise, use 'utterance' for interim results (rolling translation)
                    else if (data.utterance) {
                        // console.log('[AssemblyAI] Interim:', data.utterance);
                        this.emit('transcript_interim', data.utterance);
                    }
                }

                // Keep error handling just in case
                else if (data.type === 'Error' || data.error) {
                    console.error('[AssemblyAI] Error:', data.error);
                    this.emit('error', data.error);
                }
            };

            this.socket.onclose = (event) => {
                console.log(`[AssemblyAI] WebSocket Closed. Code: ${event.code}, Reason: ${event.reason}`);
                this.socket = null;
                this.emit('status', 'disconnected');
            };

            this.socket.onerror = (error) => {
                console.error('[AssemblyAI] WebSocket Error:', error);
                this.emit('error', error);
                // Only reject if we haven't resolved yet (not perfect check but sufficient for initial connect)
                if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
                    reject(error);
                }
            };
        });
    }

    sendAudio(chunk) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // Send raw binary chunks (Int16Array or ArrayBuffer)
            this.socket.send(chunk);
        }
    }

    async disconnect() {
        if (this.socket) {
            console.log('[AssemblyAI] Closing connection...');
            // Optional: Send terminate message
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ terminate_session: true }));
            }
            this.socket.close();
            this.socket = null;
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = new Set();
        this.listeners[event].add(callback);
        return () => this.listeners[event].delete(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

export const assemblyAIService = new AssemblyAIService();
