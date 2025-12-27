import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Settings, Send, Globe, Sparkles, StopCircle, RefreshCw, X, Play, Languages } from 'lucide-react';
import clsx from 'clsx';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { sonioxService } from './services/soniox';
import { initGemini, translateText, getAvailableModels } from './services/gemini';
import { LiveTranscript } from './components/LiveTranscript';

function App() {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [messages, setMessages] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentTranslation, setCurrentTranslation] = useState(null);
  const lastTranslatedTextRef = useRef('');
  const isTranslatingRef = useRef(false);

  // Settings
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [modelList, setModelList] = useState([]);
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('gemini_model') || 'gemini-3-flash-preview');

  // Language Configuration (Bi-directional Pair)
  const [primaryLanguage, setPrimaryLanguage] = useState(localStorage.getItem('primary_lang') || 'en');
  const [secondaryLanguage, setSecondaryLanguage] = useState(localStorage.getItem('secondary_lang') || 'ar');
  const [geminiEnabled, setGeminiEnabled] = useState(localStorage.getItem('gemini_enabled') !== 'false'); // Default true
  const [transliterationStyle, setTransliterationStyle] = useState(localStorage.getItem('gemini_style') || 'clean');
  const [useContextualTranslation, setUseContextualTranslation] = useState(localStorage.getItem('use_contextual') === 'true');

  const [showSettings, setShowSettings] = useState(!geminiKey && geminiEnabled);

  useEffect(() => {
    if (geminiKey && geminiEnabled) {
      initGemini(geminiKey);
      getAvailableModels(geminiKey).then(models => {
        if (models && models.length > 0) setModelList(models);
      });
    }
  }, [geminiKey, geminiEnabled]);

  useEffect(() => {
    // Listen to Soniox events (Two-Way Native)
    const unsubFinal = sonioxService.on('transcript_final', async (data) => {
      // data: { textA, textB, detectedLanguage }

      console.log('[App] Final:', data);

      let sourceText = '';
      let targetText = '';
      let detectedLanguage = 'auto'; // Default to auto or safe value

      // Support legacy string emit just in case, though soniox.js is updated
      if (typeof data === 'string') {
        sourceText = data;
        targetText = '';
        detectedLanguage = 'auto';
      } else {
        const { textA, textB } = data;
        // Assign to outer let
        detectedLanguage = data.detectedLanguage;

        // Determine Source vs Target based on Detection
        // If Detected == Primary, Primary=Source
        if (detectedLanguage === primaryLanguage) {
          sourceText = textA;
          targetText = textB;
        } else {
          sourceText = textB;
          targetText = textA;
        }
      }

      // Create Message immediately with Native Translation
      const newMessage = {
        role: 'user',
        text: sourceText,
        translation: { arabic: targetText, phonetic: '' }
      };

      setMessages(prev => [...prev, newMessage]);

      setCurrentTranscript('');
      setCurrentTranslation(null);
      lastTranslatedTextRef.current = '';

      // Async: Call Gemini for Phonetics OR Contextual Translation (if enabled)
      if (geminiKey && geminiEnabled) {
        try {
          if (useContextualTranslation) {
            // MODE: Contextual Translation (Override Soniox Translation)
            // We want to translate from Source -> Target using Gemini
            const targetLang = (primaryLanguage === detectedLanguage) ? secondaryLanguage : primaryLanguage;

            const result = await translateText(
              sourceText,
              geminiKey,
              selectedModel,
              detectedLanguage,
              targetLang,
              transliterationStyle,
              true // useContextual
            );

            setMessages(prev => prev.map(msg =>
              msg === newMessage ? {
                ...msg,
                translation: {
                  arabic: result.arabic, // Contextual Translation
                  phonetic: result.phonetic // Phonetic of (Source or Target depending on prompt logic)
                }
              } : msg
            ));

          } else {
            // MODE: Standard (Phonetics Only - Keep Soniox Translation)
            // We want phonetics for the ARABIC portion.
            let textToPhonetize = '';
            if (primaryLanguage === 'ar') textToPhonetize = (detectedLanguage === 'ar') ? sourceText : targetText;
            else if (secondaryLanguage === 'ar') textToPhonetize = (detectedLanguage === 'ar') ? sourceText : targetText;

            // Fallback if neither is explicit 'ar' but one key is 'ar'
            if (!textToPhonetize) {
              // Check simple cases
              if (detectedLanguage === 'ar') textToPhonetize = sourceText;
              else textToPhonetize = targetText; // Assume target is Ar if source is En
            }

            if (textToPhonetize) {
              // We misuse translateText to get phonetics.
              // We pass source='ar', target='en'. 
              const result = await translateText(textToPhonetize, geminiKey, selectedModel, 'ar', 'en', transliterationStyle, false);

              setMessages(prev => prev.map(msg =>
                msg === newMessage ? {
                  ...msg,
                  translation: {
                    arabic: targetText, // Keep Soniox Native
                    phonetic: result.phonetic
                  }
                } : msg
              ));
            }
          }
        } catch (err) {
          console.error("Gemini Error:", err);
        }
      }
    });

    const unsubInterim = sonioxService.on('transcript_interim', (data) => {
      // Support object or string
      if (typeof data === 'string') {
        setCurrentTranscript(data);
      } else {
        // data: { primary, secondary, detected }
        // Show Source
        const showText = (data.detected === primaryLanguage) ? data.primary : data.secondary;
        setCurrentTranscript(showText || data.primary || data.secondary);
      }
    });

    const unsubStatus = sonioxService.on('status', (status) => {
      console.log('[App] Soniox Status:', status);
    });

    const unsubError = sonioxService.on('error', (err) => {
      console.error('[App] Soniox Error:', err);
    });

    return () => {
      unsubFinal();
      unsubInterim();
      unsubStatus();
      unsubError();
    };
  }, [geminiKey, selectedModel, primaryLanguage, secondaryLanguage, geminiEnabled, transliterationStyle]);

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Start Soniox with configured pair
      startRecording(primaryLanguage, secondaryLanguage);
    }
  };

  const saveSettings = (key, prim, sec, enabled, model, style, contextual) => {
    setGeminiKey(key);
    localStorage.setItem('gemini_key', key);

    setPrimaryLanguage(prim);
    localStorage.setItem('primary_lang', prim);

    setSecondaryLanguage(sec);
    localStorage.setItem('secondary_lang', sec);

    setGeminiEnabled(enabled);
    localStorage.setItem('gemini_enabled', enabled);

    setSelectedModel(model);
    localStorage.setItem('gemini_model', model);

    setTransliterationStyle(style);
    localStorage.setItem('gemini_style', style);

    setUseContextualTranslation(contextual);
    localStorage.setItem('use_contextual', contextual);

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
        {/* Floating Language Toggles REMOVED as requested */}

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
                    // Translate (Text still uses Gemini)
                    const translation = await translateText(text, geminiKey, selectedModel, 'auto', secondaryLanguage, transliterationStyle, useContextualTranslation);
                    setMessages(prev => prev.map(msg =>
                      msg === newMessage ? { ...msg, translation: translation } : msg
                    ));
                  }
                }}
              />

              {/* File Upload Placeholder */}
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
                <Sparkles className="text-primary" /> App Settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-sm font-medium">Enable Gemini (Phonetics)</span>
                  <button
                    onClick={() => setGeminiEnabled(!geminiEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${geminiEnabled ? 'bg-primary' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${geminiEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {geminiEnabled && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Gemini API Key</label>
                      <input
                        type="password"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                        placeholder="Required for Phonetics..."
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Gemini Model ID</label>
                      <input
                        type="text"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                        placeholder="e.g. gemini-1.5-flash"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Transliteration Style</label>
                      <select
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                        value={transliterationStyle}
                        onChange={(e) => setTransliterationStyle(e.target.value)}
                      >
                        <option value="clean">Standard (Clean)</option>
                        <option value="precise">Precise (Symbols)</option>
                        <option value="franco">Franco (Arabizi)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">Contextual Translation</span>
                        <span className="text-xs text-gray-400">Slower, but uses Egyptian dialect/tone.</span>
                      </div>
                      <button
                        onClick={() => setUseContextualTranslation(!useContextualTranslation)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${useContextualTranslation ? 'bg-primary' : 'bg-gray-600'}`}
                      >
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${useContextualTranslation ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Primary Language</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                      value={primaryLanguage}
                      onChange={(e) => setPrimaryLanguage(e.target.value)}
                    >
                      <option value="en">🇺🇸 English</option>
                      <option value="ar">🇪🇬 Arabic</option>
                      <option value="fr">🇫🇷 French</option>
                      <option value="es">🇪🇸 Spanish</option>
                      <option value="de">🇩🇪 German</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Secondary Language</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                      value={secondaryLanguage}
                      onChange={(e) => setSecondaryLanguage(e.target.value)}
                    >
                      <option value="ar">🇪🇬 Arabic</option>
                      <option value="en">🇺🇸 English</option>
                      <option value="fr">🇫🇷 French</option>
                      <option value="es">🇪🇸 Spanish</option>
                      <option value="de">🇩🇪 German</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-text-muted hover:text-white">Cancel</button>
                  <button onClick={() => saveSettings(geminiKey, primaryLanguage, secondaryLanguage, geminiEnabled, selectedModel, transliterationStyle, useContextualTranslation)} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover">Save & Start</button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default App;
