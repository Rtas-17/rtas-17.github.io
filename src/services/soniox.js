import { SonioxClient } from '@soniox/speech-to-text-web';

const SONIOX_API_KEY = '46b4466fb637b002e0276f1d93b8ff937baa12529297ee8ecd8836fa794b9ad7';

export class SonioxService {
    constructor() {
        this.client = null;
        this.listeners = {};
        this.bufferA = ''; // Primary Language Buffer
        this.bufferB = ''; // Secondary Language Buffer
        this.primary = 'en';
        this.secondary = 'ar';
    }

    /**
     * Connects and starts the transcription session with Two-Way Translation.
     */
    async start(primLang = 'en', secLang = 'ar', enableDiarization = false, audioStream = null, enableTranslation = true) {
        if (this.client) {
            await this.stop();
        }

        console.log(`[Soniox] Starting Session: ${primLang} <-> ${secLang}, Diarization: ${enableDiarization}, Stream: ${!!audioStream}, Translation: ${enableTranslation}`);

        this.primary = primLang;
        this.secondary = secLang;
        this.bufferA = '';
        this.bufferB = '';
        this.currentSentenceLang = null;
        this.currentSentenceSpeaker = null;

        this.client = new SonioxClient({
            apiKey: SONIOX_API_KEY,
        });

        // 'stt-rt-v3' is used for the audio model, translation handles the rest
        const model = 'stt-rt-v3';

        const translationConfig = enableTranslation ? {
            type: 'two_way',
            language_a: primLang,
            language_b: secLang
        } : undefined;

        console.log('[Soniox] Config:', { model, translationConfig, enableDiarization });

        try {
            await this.client.start({
                model: model,
                stream: audioStream, // Use provided stream or default to mic
                enableLanguageIdentification: true,
                enableSpeakerDiarization: enableDiarization,
                enableEndpointDetection: true,
                translation: translationConfig,

                onStarted: () => {
                    console.log('[Soniox] Recording started.');
                    this.emit('status', 'connected');
                },

                onFinished: () => {
                    console.log('[Soniox] Session Finished.');
                    this.emit('status', 'disconnected');
                },

                onError: (status, message, errorCode) => {
                    console.error('[Soniox] Error:', status, message, errorCode);
                    this.emit('error', { status, message, errorCode });
                },

                onStateChange: ({ newState }) => {
                    console.log('[Soniox] State:', newState);
                },

                onPartialResult: (result) => {
                    let interimA = '';
                    let interimB = '';
                    let sentenceCompleted = false;

                    // Sticky Detection: Only set if we haven't locked onto a source language for this sentence yet.
                    if (!this.currentSentenceLang && result.tokens.length > 0) {
                        // Find first token with a language
                        const firstLangToken = result.tokens.find(t => t.language);
                        if (firstLangToken) {
                            this.currentSentenceLang = firstLangToken.language;
                        }
                    }

                    // Sticky Speaker: Detect who started the sentence
                    if (enableDiarization && !this.currentSentenceSpeaker && result.tokens.length > 0) {
                        const firstSpeakerToken = result.tokens.find(t => t.speaker);
                        if (firstSpeakerToken) {
                            this.currentSentenceSpeaker = firstSpeakerToken.speaker;
                        }
                    }

                    result.tokens.forEach(token => {
                        // Default to Primary language if not specified (Standard STT mode)
                        const tokenLang = token.language || this.primary;

                        if (token.is_final) {
                            if (token.text === '<end>') {
                                sentenceCompleted = true;
                            } else {
                                if (tokenLang === this.primary) {
                                    this.bufferA += token.text;
                                } else if (tokenLang === this.secondary) {
                                    this.bufferB += token.text;
                                }
                            }
                        } else {
                            // Interim tokens
                            if (tokenLang === this.primary) {
                                interimA += token.text;
                            } else if (tokenLang === this.secondary) {
                                interimB += token.text;
                            }
                        }
                    });

                    // Emit live update
                    const liveA = (this.bufferA + interimA).trim();
                    const liveB = (this.bufferB + interimB).trim();

                    if (liveA || liveB) {
                        this.emit('transcript_interim', {
                            primary: liveA,
                            secondary: liveB,
                            detected: this.currentSentenceLang // Use sticky
                        });
                    }

                    // On Endpoint, commit
                    if (sentenceCompleted) {
                        const finalA = this.bufferA.trim();
                        const finalB = this.bufferB.trim();
                        const finalDetected = this.currentSentenceLang || this.primary;
                        const finalSpeaker = this.currentSentenceSpeaker;

                        if (finalA || finalB) {
                            console.log('[Soniox] Final:', { finalA, finalB, detected: finalDetected, speaker: finalSpeaker });

                            this.emit('transcript_final', {
                                textA: finalA,
                                textB: finalB,
                                detectedLanguage: finalDetected,
                                speaker: finalSpeaker
                            });
                        }

                        this.bufferA = '';
                        this.bufferB = '';
                        this.currentSentenceLang = null; // Reset for next sentence
                        this.currentSentenceSpeaker = null;
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
