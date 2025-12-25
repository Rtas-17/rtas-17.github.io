import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, Send, Globe, Sparkles } from 'lucide-react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { assemblyAIService } from './services/assemblyai';
import { translateText } from './services/gemini';
import { LiveTranscript } from './components/LiveTranscript';

function App() {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [messages, setMessages] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentTranslation, setCurrentTranslation] = useState(null);
  const lastTranslatedTextRef = useRef('');
  const isTranslatingRef = useRef(false);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_key') || 'AIzaSyAOMc0cSZ7r-RdtsTDZisz-a7YG6KuAMiI');
  const [showSettings, setShowSettings] = useState(!geminiKey);

  useEffect(() => {
    // Rolling Translation Loop
    const checkTranslation = async () => {
      if (currentTranscript && currentTranscript !== lastTranslatedTextRef.current && !isTranslatingRef.current && geminiKey) {
        isTranslatingRef.current = true;
        try {
          const textToTranslate = currentTranscript;
          const result = await translateText(textToTranslate, geminiKey);
          if (result) {
            setCurrentTranslation(result);
            lastTranslatedTextRef.current = textToTranslate;
          }
        } catch (e) {
          console.error(e);
        } finally {
          isTranslatingRef.current = false;
        }
      }
    };

    const interval = setInterval(checkTranslation, 500); // Check every 500ms to avoid flooding API
    return () => clearInterval(interval);
  }, [currentTranscript, geminiKey]);

  useEffect(() => {
    // Listen to AssemblyAI events
    const unsubInterim = assemblyAIService.on('transcript_interim', (text) => {
      setCurrentTranscript(text);
    });

    const unsubFinal = assemblyAIService.on('transcript_final', async (text) => {
      // Final Commit
      // We might have a currentTranslation that matches this text, or close to it.
      // Ideally we do one last authoritative translation.

      const newMessage = { role: 'user', text: text, translation: currentTranslation }; // Optimistically use current
      setMessages(prev => [...prev, newMessage]);

      setCurrentTranscript('');
      setCurrentTranslation(null);
      lastTranslatedTextRef.current = '';

      if (geminiKey) {
        // Re-verify final translation to be sure
        const translation = await translateText(text, geminiKey);
        setMessages(prev => prev.map(msg =>
          msg === newMessage ? { ...msg, translation: translation } : msg
        ));
      }
    });

    return () => {
      unsubInterim();
      unsubFinal();
    };
  }, [geminiKey, currentTranslation]);

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (!geminiKey) setShowSettings(true);
      else startRecording();
    }
  };

  const saveKey = (key) => {
    setGeminiKey(key);
    localStorage.setItem('gemini_key', key);
    setShowSettings(false);
  };

  return (
    <div className="h-screen w-screen bg-background text-text-main flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <span className="font-bold text-white text-xl">M</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MasriConnect</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
                {isRecording ? 'Listening...' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-white">
          <Settings size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col min-h-0">
        <LiveTranscript messages={messages} currentTranscript={currentTranscript} currentTranslation={currentTranslation} />

        {/* Input Area / Controls */}
        {/* Input Area / Controls */}
        <div className="p-6 pb-8 bg-gradient-to-t from-background via-background to-transparent relative z-20">

          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {/* Text Input for Testing */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type english text to test translation..."
                className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim() && geminiKey) {
                    const text = e.currentTarget.value.trim();
                    // Add user message
                    const newMessage = { role: 'user', text: text, translation: null };
                    setMessages(prev => [...prev, newMessage]);
                    e.currentTarget.value = '';
                    // Translate
                    const translation = await translateText(text, geminiKey);
                    setMessages(prev => prev.map(msg =>
                      msg === newMessage ? { ...msg, translation: translation } : msg
                    ));
                  }
                }}
              />

              {/* File Upload for Testing */}
              <label className="p-3 bg-surface border border-border rounded-xl cursor-pointer hover:bg-white/5 transition-colors text-text-muted hover:text-white flex items-center justify-center">
                <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  try {
                    // Connect to AssemblyAI - the connect() method now waits for connection
                    await assemblyAIService.connect();

                    // Stream file in chunks
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const buffer = event.target.result;
                      const chunkSize = 4096; // 4KB chunks
                      for (let i = 0; i < buffer.byteLength; i += chunkSize) {
                        const chunk = buffer.slice(i, i + chunkSize);
                        assemblyAIService.sendAudio(chunk);
                        await new Promise(r => setTimeout(r, 50)); // Simulate stream timing
                      }
                    };
                    reader.readAsArrayBuffer(file);
                  } catch (error) {
                    console.error('Failed to process audio file:', error);
                    alert('Failed to process audio file: ' + error.message);
                  }
                }} />
                <span className="sr-only">Upload Audio</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              </label>
            </div>

            <button
              onClick={handleToggleRecord}
              className={`w-full h-16 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold transition-all shadow-lg hover:brightness-110 active:scale-[0.98] ${isRecording
                ? 'bg-red-500/10 text-red-500 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                : 'bg-primary text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                }`}
            >
              {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              {isRecording ? 'Stop Recording' : 'Tap to Speak'}
            </button>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="text-primary" /> Setup Translation
            </h2>
            <p className="text-text-muted mb-4 text-sm">
              To enable AI translation, please enter your Google Gemini API Key.
              <br />(AssemblyAI is pre-configured).
            </p>
            <input
              type="password"
              placeholder="Gemini API Key"
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors mb-4"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-text-muted hover:text-white">Cancel</button>
              <button onClick={() => saveKey(geminiKey)} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover">Save & Start</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
