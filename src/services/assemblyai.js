// Detect environment and use appropriate endpoint
// For GitHub Pages deployment, we need a CORS proxy
// Users can set their own proxy: localStorage.setItem('assemblyai_proxy_url', 'YOUR_URL')
const isNetlify = typeof window !== 'undefined' && (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('.netlify.live'));
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Default to Netlify function if on Netlify, otherwise use direct API (which may fail with CORS on GitHub Pages)
let defaultTokenUrl = 'https://api.assemblyai.com/v2/realtime/token';
if (isNetlify) {
    defaultTokenUrl = '/.netlify/functions/assemblyai-token';
}

const TOKEN_PROXY_URL = typeof localStorage !== 'undefined' ? 
    (localStorage.getItem('assemblyai_proxy_url') || defaultTokenUrl) : 
    defaultTokenUrl;
    
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
            // Get a temporary token from AssemblyAI (or proxy)
            // If you're getting "Failed to fetch" errors due to CORS:
            // 1. Set up a proxy (see CORS_PROXY_SETUP.md)
            // 2. Configure the proxy URL: localStorage.setItem('assemblyai_proxy_url', 'YOUR_PROXY_URL')
            // 3. Or deploy to a platform with serverless functions (Netlify, Vercel)
            const response = await fetch(TOKEN_PROXY_URL, {
                method: 'POST',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ expires_in: 3600 })
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`Failed to get AssemblyAI token: ${response.status} ${response.statusText}${errorText ? ' - ' + errorText : ''}`);
            }

            const data = await response.json();
            
            if (!data.token) {
                throw new Error('No token received from AssemblyAI');
            }
            
            const token = data.token;

            // Connect to AssemblyAI WebSocket with language detection and Arabic support
            // sample_rate=16000 is the default for browser audio
            // Return a promise that resolves when connection is established or rejects on error
            return new Promise((resolve, reject) => {
                this.socket = new WebSocket(
                    `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
                );

                this.socket.onopen = () => {
                    console.log('AssemblyAI Connected');
                    this.emit('status', 'connected');
                    resolve();
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
                    reject(error);
                };
            });
        } catch (error) {
            console.error('Failed to connect to AssemblyAI:', error);
            // Provide user-friendly error message for common CORS issues
            if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
                const corsError = new Error(
                    'Cannot connect to AssemblyAI: CORS policy blocked the request. ' +
                    'This happens because AssemblyAI\'s token endpoint cannot be called directly from browsers. ' +
                    'Solutions:\n' +
                    '1. Deploy a CORS proxy (see CORS_PROXY_SETUP.md)\n' +
                    '2. Deploy this app to Netlify, Vercel, or Cloudflare Pages with a serverless function\n' +
                    '3. Run your own backend server to proxy token requests'
                );
                corsError.originalError = error;
                this.emit('error', corsError);
                throw corsError;
            }
            this.emit('error', error);
            throw error; // Re-throw to propagate the error
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
