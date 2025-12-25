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
  const [assemblyAIKey, setAssemblyAIKey] = useState(localStorage.getItem('assemblyai_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_key') || 'AIzaSyAOMc0cSZ7r-RdtsTDZisz-a7YG6KuAMiI');
  const [geminiModel, setGeminiModel] = useState(localStorage.getItem('gemini_model') || 'gemini-2.0-flash-exp');
  const [showSettings, setShowSettings] = useState(!geminiKey || !assemblyAIKey);

  useEffect(() => {
    // Rolling Translation Loop
    const checkTranslation = async () => {
      if (currentTranscript && currentTranscript !== lastTranslatedTextRef.current && !isTranslatingRef.current && geminiKey) {
        isTranslatingRef.current = true;
        try {
          const textToTranslate = currentTranscript;
          const result = await translateText(textToTranslate, geminiKey, geminiModel);
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
  }, [currentTranscript, geminiKey, geminiModel]);

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
        const translation = await translateText(text, geminiKey, geminiModel);
        setMessages(prev => prev.map(msg =>
          msg === newMessage ? { ...msg, translation: translation } : msg
        ));
      }
    });

    return () => {
      unsubInterim();
      unsubFinal();
    };
  }, [geminiKey, geminiModel, currentTranslation]);

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (!geminiKey || !assemblyAIKey) setShowSettings(true);
      else startRecording();
    }
  };

  const saveKeys = (assemblyKey, geminiApiKey, model) => {
    setAssemblyAIKey(assemblyKey);
    setGeminiKey(geminiApiKey);
    setGeminiModel(model);
    localStorage.setItem('assemblyai_api_key', assemblyKey);
    localStorage.setItem('gemini_key', geminiApiKey);
    localStorage.setItem('gemini_model', model);
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
                    const translation = await translateText(text, geminiKey, geminiModel);
                    setMessages(prev => prev.map(msg =>
                      msg === newMessage ? { ...msg, translation: translation } : msg
                    ));
                  }
                }}
              />
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
              <Sparkles className="text-primary" /> API Settings
            </h2>
            <p className="text-text-muted mb-4 text-sm">
              To enable speech recognition and AI translation, please enter your API keys for both services.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                AssemblyAI API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="Enter AssemblyAI API Key"
                className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                value={assemblyAIKey}
                onChange={(e) => setAssemblyAIKey(e.target.value)}
              />
              <p className="text-xs text-text-muted mt-1">
                Get your key from <a href="https://www.assemblyai.com/app/account" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" aria-label="AssemblyAI Dashboard (opens in new tab)">AssemblyAI Dashboard</a>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Google Gemini API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="Enter Gemini API Key"
                className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
              <p className="text-xs text-text-muted mt-1">
                Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" aria-label="Google AI Studio (opens in new tab)">Google AI Studio</a>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Gemini Model
              </label>
              <input
                type="text"
                placeholder="e.g., gemini-2.0-flash-exp"
                className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-text-muted hover:text-white">Cancel</button>
              <button 
                onClick={() => saveKeys(assemblyAIKey, geminiKey, geminiModel)} 
                disabled={!geminiKey || !assemblyAIKey}
                className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save & Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
