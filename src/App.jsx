import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Settings, Send, Globe, Sparkles, StopCircle, RefreshCw, X, Play, Languages } from 'lucide-react';
import clsx from 'clsx';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { assemblyAIService } from './services/assemblyAI';
import { initGemini, translateText, getAvailableModels } from './services/gemini';
import { LiveTranscript } from './components/LiveTranscript';

function App() {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [messages, setMessages] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentTranslation, setCurrentTranslation] = useState(null);
  const lastTranslatedTextRef = useRef('');
  const isTranslatingRef = useRef(false);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [modelList, setModelList] = useState([]);
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('gemini_model') || 'gemini-3-flash-preview');
  const [inputLanguage, setInputLanguage] = useState('en');
  const [showSettings, setShowSettings] = useState(!geminiKey);

  useEffect(() => {
    if (geminiKey) {
      initGemini(geminiKey);
      getAvailableModels(geminiKey).then(models => {
        if (models && models.length > 0) setModelList(models);
      });
    }
  }, [geminiKey]);

  useEffect(() => {
    // Debounce Interim Translation
    // Only translate if user pauses for 1000ms
    const timer = setTimeout(async () => {
      if (currentTranscript && currentTranscript !== lastTranslatedTextRef.current && !isTranslatingRef.current && geminiKey) {
        isTranslatingRef.current = true;
        try {
          const textToTranslate = currentTranscript;
          const result = await translateText(textToTranslate, geminiKey, selectedModel);
          if (result) {
            setCurrentTranslation(result);
            lastTranslatedTextRef.current = textToTranslate;
          }
        } catch (e) {
          console.error("Translation error (debounce):", e);
        } finally {
          isTranslatingRef.current = false;
        }
      }
    }, 1000); // 1s Debounce

    return () => clearTimeout(timer);
  }, [currentTranscript, geminiKey, selectedModel]);

  useEffect(() => {
    // Listen to AssemblyAI events
    const unsubInterim = assemblyAIService.on('transcript_interim', (text) => {
      setCurrentTranscript(text);
    });

    const unsubFinal = assemblyAIService.on('transcript_final', async (text) => {
      const newMessage = { role: 'user', text: text, translation: currentTranslation };
      setMessages(prev => [...prev, newMessage]);

      setCurrentTranscript('');
      setCurrentTranslation(null);
      lastTranslatedTextRef.current = '';

      if (geminiKey) {
        const translation = await translateText(text, geminiKey, selectedModel);
        setMessages(prev => prev.map(msg =>
          msg === newMessage ? { ...msg, translation: translation } : msg
        ));
      }
    });

    return () => {
      unsubInterim();
      unsubFinal();
    };
  }, [geminiKey, currentTranslation, selectedModel]);

  const handleToggleRecord = () => {
    console.log('[UI] Toggle Record Clicked', { isRecording, inputLanguage });
    if (isRecording) {
      stopRecording();
    } else {
      if (!geminiKey) setShowSettings(true);
      else startRecording(inputLanguage);
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
        {/* Language Toggle */}
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md rounded-full p-1 flex border border-white/10 shadow-2xl">
          <button
            onClick={() => setInputLanguage('en')}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2",
              inputLanguage === 'en' ? "bg-primary text-white shadow-lg" : "text-gray-400 hover:text-white"
            )}
          >
            🇺🇸 English
          </button>
          <button
            onClick={() => setInputLanguage('auto')}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2",
              inputLanguage === 'auto' ? "bg-primary text-white shadow-lg" : "text-gray-400 hover:text-white"
            )}
          >
            🤖 Auto
          </button>
          <button
            onClick={() => setInputLanguage('ar')}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2",
              inputLanguage === 'ar' ? "bg-primary text-white shadow-lg" : "text-gray-400 hover:text-white"
            )}
          >
            🇪🇬 Arabic
          </button>
        </div>

        <LiveTranscript messages={messages} currentTranscript={currentTranscript} currentTranslation={currentTranslation} />

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
                    const translation = await translateText(text, geminiKey, selectedModel);
                    setMessages(prev => prev.map(msg =>
                      msg === newMessage ? { ...msg, translation: translation } : msg
                    ));
                  }
                }}
              />

              {/* File Upload Placeholder - Simulating file transcription is disabled as we use streaming only */}
              <div className="p-3 bg-surface/30 border border-border/50 rounded-xl cursor-not-allowed text-text-muted flex items-center justify-center grayscale">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              </div>
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
      </main >

      {/* Settings Modal */}
      {
        showSettings && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="text-primary" /> Setup Translation
              </h2>
              <p className="text-text-muted mb-4 text-sm">
                To enable AI translation, please enter your Google Gemini API Key.
                <br />(AssemblyAI is pre-configured).
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Gemini API Key</label>
                  <input
                    type="password"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                    placeholder="Paste your Gemini API Key..."
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      localStorage.setItem('gemini_key', e.target.value);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Translation Model</label>
                  <input
                    type="text"
                    list="model-suggestions"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                    placeholder="e.g. gemini-3-flash-preview"
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      localStorage.setItem('gemini_model', e.target.value);
                    }}
                  />
                  <datalist id="model-suggestions">
                    <option value="gemini-3-flash-preview" />
                    <option value="gemini-2.0-flash-exp" />
                    <option value="gemini-1.5-flash" />
                    {modelList.map(m => (
                      <option key={m.name} value={m.name}>{m.displayName}</option>
                    ))}
                  </datalist>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Tip: Enter any valid Gemini model ID.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-text-muted hover:text-white">Cancel</button>
                <button onClick={() => saveKey(geminiKey)} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover">Save & Start</button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default App;
