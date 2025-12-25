// AssemblyAI Real-Time Transcription Service
// Based on AssemblyAI's official realtime-react-example
// https://github.com/AssemblyAI-Community/realtime-react-example

// Detect environment and use appropriate endpoint
const isNetlify = typeof window !== 'undefined' && (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('.netlify.live'));

// Default to Netlify function if on Netlify, otherwise use direct API (which will fail with CORS on GitHub Pages)
let defaultTokenUrl = '/token'; // Relative URL for local backend or serverless function
if (isNetlify) {
    defaultTokenUrl = '/.netlify/functions/assemblyai-token';
}

const TOKEN_URL = typeof localStorage !== 'undefined' ? 
    (localStorage.getItem('assemblyai_token_url') || defaultTokenUrl) : 
    defaultTokenUrl;

export class AssemblyAIService {
    constructor() {
        this.socket = null;
        this.audioContext = null;
        this.mediaStream = null;
        this.scriptProcessor = null;
        this.listeners = {};
        this.turns = {};
    }

    async getToken() {
        try {
            const response = await fetch(TOKEN_URL);
            const data = await response.json();

            if (!data || !data.token) {
                throw new Error('No token received from server');
            }

            return data.token;
        } catch (error) {
            console.error('Failed to get token:', error);
            // Provide user-friendly error message for common issues
            if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
                const helpfulError = new Error(
                    'Cannot connect to token server. ' +
                    'If running locally, make sure the backend server is running on port 8000. ' +
                    'If deployed, ensure the serverless function is configured. ' +
                    'See CORS_PROXY_SETUP.md for details.'
                );
                helpfulError.originalError = error;
                throw helpfulError;
            }
            throw error;
        }
    }

    async connect() {
        if (this.socket) {
            console.log('Already connected');
            return;
        }

        try {
            // Get temporary token from backend
            const token = await this.getToken();

            // Connect to AssemblyAI v3 WebSocket
            const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&formatted_finals=true&token=${token}`;
            this.socket = new WebSocket(wsUrl);

            // Return a promise that resolves when connection is established
            return new Promise((resolve, reject) => {
                this.socket.onopen = async () => {
                    console.log('AssemblyAI WebSocket connected');
                    console.log('Connected to:', wsUrl);
                    this.emit('status', 'connected');

                    try {
                        // Set up audio capture
                        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        this.audioContext = new AudioContext({ sampleRate: 16000 });

                        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
                        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

                        source.connect(this.scriptProcessor);
                        this.scriptProcessor.connect(this.audioContext.destination);

                        // Process audio and send to AssemblyAI
                        this.scriptProcessor.onaudioprocess = (event) => {
                            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

                            const input = event.inputBuffer.getChannelData(0);
                            const buffer = new Int16Array(input.length);
                            for (let i = 0; i < input.length; i++) {
                                buffer[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
                            }
                            this.socket.send(buffer.buffer);
                        };

                        resolve();
                    } catch (audioError) {
                        console.error('Audio setup error:', audioError);
                        this.disconnect();
                        reject(audioError);
                    }
                };

                this.socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        
                        if (message.type === 'Turn') {
                            const { turn_order, transcript } = message;
                            this.turns[turn_order] = transcript;
                            
                            // Emit interim transcript (current turn)
                            if (transcript) {
                                this.emit('transcript_interim', transcript);
                            }
                            
                            // When a turn is complete, emit it as final
                            // In v3, final transcripts come with formatted_finals=true
                            this.emit('transcript_final', transcript);
                        }
                    } catch (err) {
                        console.error('Error parsing message:', err);
                    }
                };

                this.socket.onerror = (error) => {
                    console.error('AssemblyAI WebSocket Error:', error);
                    this.emit('error', error);
                    reject(error);
                };

                this.socket.onclose = (event) => {
                    console.log(`AssemblyAI Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
                    this.cleanup();
                    this.emit('status', 'disconnected');
                };
            });
        } catch (error) {
            console.error('Failed to connect to AssemblyAI:', error);
            this.emit('error', error);
            throw error;
        }
    }

    cleanup() {
        // Clean up audio resources
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        this.socket = null;
        this.turns = {};
    }

    disconnect() {
        if (this.socket) {
            // Send terminate message
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'Terminate' }));
            }
            this.socket.close();
        }
        this.cleanup();
    }

    // Legacy method - no longer needed with v3 API
    // eslint-disable-next-line no-unused-vars
    sendAudio(audioData) {
        // Audio is now sent automatically via scriptProcessor
        console.warn('sendAudio is deprecated - audio is sent automatically');
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
