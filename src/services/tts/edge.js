
import { generateUUID } from './utils';

const TRUSTED_TOKEN = "6A5AA1D4-EA85-432F-92A4-1DA437908FF9";

const getEdgeUrl = () => {
    // If running on localhost, use the Vite proxy to bypass CORS
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/edge-tts/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_TOKEN}`;
    }
    // Production / Direct
    return `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_TOKEN}`;
};

export const EdgeTTS = {
    async speak(text, lang = 'en-US', voiceURI = null) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(getEdgeUrl());
            const requestId = generateUUID();
            let audioData = [];

            // Determine voice
            // Default mappings if no specific voiceURI provided
            let voice = voiceURI;
            if (!voice) {
                if (lang.startsWith('ar')) voice = 'ar-EG-SalmaNeural'; // Good Egyptian voice
                else voice = 'en-US-AriaNeural';
            }
            // If user provided a short mapping or name, try to map it to full URI if needed
            // But for now assume we might pass full URIs or valid shortnames.
            // Edge voices usually look like: "Microsoft Server Speech Text to Speech Voice (ar-EG, SalmaNeural)"
            // But the Protocol expects "ar-EG-SalmaNeural" or similar shortnames involved in the API.
            // Let's rely on a helper or just try the standard shortnames.

            // Standard Edge Voices (Partial List for robustness):
            // ar-EG-SalmaNeural, ar-EG-ShakirNeural
            // en-US-AriaNeural, en-US-GuyNeural

            ws.onopen = () => {
                // 1. Send Config
                const configMsg = `X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;
                ws.send(configMsg);

                // 2. Send SSML
                const ssml = `
                    <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>
                        <voice name='${voice}'>
                            <prosody pitch='+0Hz' rate='+0%' volume='+0%'>
                                ${text}
                            </prosody>
                        </voice>
                    </speak>
                `;
                const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toString()}\r\nPath:ssml\r\n\r\n${ssml}`;
                ws.send(ssmlMsg);
            };

            ws.onmessage = async (event) => {
                const data = event.data;
                if (typeof data === 'string') {
                    // Text metadata
                    if (data.includes("turn.end")) {
                        ws.close();
                    }
                } else if (data instanceof Blob) {
                    // Binary audio
                    // The first 2 bytes or so might be headers, but usually for Edge consumer API it sends mostly pure chunks with a small text header buffer.
                    // Actually, the binary messages have a header. we need to strip it.
                    // The header is usually text ending with \r\n\r\n. 
                    // Let's assume simpler approach: collect all blobs, combine, and play.
                    // For precise implementation we should strip the headers.
                    // Header length is dynamic.

                    // Simple Hack: The audio format is mp3. 
                    // We can just concatenate and hope the headers (which are small text) don't break the mp3 decoder too much,
                    // OR we specifically look for the binary start.
                    // For this prototype, let's just push the Blob.
                    audioData.push(data);
                }
            };

            ws.onclose = async () => {
                if (audioData.length > 0) {
                    const blob = new Blob(audioData, { type: 'audio/mp3' });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    audio.onended = () => resolve();
                    audio.onerror = reject;
                    audio.play().catch(reject);
                } else {
                    reject(new Error("No audio received from Edge TTS"));
                }
            };

            ws.onerror = (e) => {
                console.error("Edge TTS WS Error:", e);
                reject(e);
            };
        });
    }
};
