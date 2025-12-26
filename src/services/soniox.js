import { SonioxClient } from '@soniox/speech-to-text-web';

const SONIOX_API_KEY = '46b4466fb637b002e0276f1d93b8ff937baa12529297ee8ecd8836fa794b9ad7';

export class SonioxService {
    constructor() {
        this.client = null;
        this.listeners = {};
        this.finalBuffer = '';
    }

    /**
     * Connects and starts the transcription session.
     */
    async start(language = 'en', targetLanguage = null) {
        if (this.client) {
            await this.stop();
        }

        console.log(`[Soniox] Starting session. Language: ${language}, Target: ${targetLanguage}`);

        // Reset buffer
        this.finalBuffer = '';

        this.client = new SonioxClient({
            apiKey: SONIOX_API_KEY,
        });

        // Use Universal Model 'stt-rt-v3' as per reference implementation
        const model = 'stt-rt-v3';

        // Translation Config
        let translationConfig = undefined;
        if (targetLanguage) {
            translationConfig = {
                type: 'one_way',
                target_language: targetLanguage
            };
        }

        this.targetLanguage = targetLanguage;

        try {
            await this.client.start({
                model: model,
                enableLanguageIdentification: true,
                enableSpeakerDiarization: true,
                enableEndpointDetection: true,
                translation: translationConfig,

                onStarted: () => {
                    console.log('[Soniox] Recording started.');
                    this.emit('status', 'connected');
                },

                onError: (status, message, errorCode) => {
                    // Ignore innocuous errors if necessary, but log them
                    console.error('[Soniox] Error:', status, message, errorCode);
                    this.emit('error', { status, message, errorCode });
                },

                onStateChange: ({ newState }) => {
                    console.log('[Soniox] State:', newState);
                },

                onPartialResult: (result) => {
                    let interimStr = '';
                    let sentenceCompleted = false;

                    result.tokens.forEach(token => {
                        // Debug log to understand what we are receiving
                        // console.log(`Token: "${token.text}" lang: ${token.language} final: ${token.is_final}`);

                        // Filter by Target Language if translation is active
                        // If targetLanguage is set, Soniox adds source AND target tokens to the stream.
                        // We only want the target tokens.
                        if (this.targetLanguage && token.language && token.language !== this.targetLanguage) {
                            return;
                        }

                        if (token.is_final) {
                            if (token.text === '<end>') {
                                sentenceCompleted = true;
                            } else {
                                // Assuming token.text has proper spacing or we rely on UI to handle it.
                                // Soniox demo uses token.text directly.
                                this.finalBuffer += token.text;
                            }
                        } else {
                            interimStr += token.text;
                        }
                    });

                    // Emit live update for UI (Shows accumulation so far + unstable words)
                    const liveFull = (this.finalBuffer + interimStr).trim();
                    if (liveFull) {
                        this.emit('transcript_interim', liveFull);
                    }

                    // If we hit an endpoint, commit the buffer
                    if (sentenceCompleted) {
                        const finalText = this.finalBuffer.trim();
                        if (finalText) {
                            console.log('[Soniox] Buffer Commited:', finalText);
                            this.emit('transcript_final', finalText);
                        }
                        this.finalBuffer = ''; // Reset for next sentence
                    }
                }
            });

        } catch (err) {
            console.error('[Soniox] Failed to start (catch):', err);
            this.emit('error', err);
            throw err;
        }
    }

    async stop() {
        if (this.client) {
            console.log('[Soniox] Stopping session...');
            await this.client.stop();
            this.client = null;
            this.finalBuffer = '';
            this.emit('status', 'disconnected');
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

export const sonioxService = new SonioxService();
