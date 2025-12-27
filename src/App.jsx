import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Settings, Send, Globe, Sparkles, StopCircle, RefreshCw, X, Play, Languages } from 'lucide-react';
import clsx from 'clsx';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { sonioxService } from './services/soniox';
import { initGemini, translateText, getAvailableModels } from './services/gemini';
import { LiveTranscript } from './components/LiveTranscript';
import { Sidebar } from './components/Sidebar';
import { Menu } from 'lucide-react';

function App() {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [messages, setMessages] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentDetectedLang, setCurrentDetectedLang] = useState('en'); // Default to 'en'
  const [currentTranslation, setCurrentTranslation] = useState(null);
  const lastTranslatedTextRef = useRef('');
  const currentTranslationRef = useRef(null); // Track latest interim for handoff
  const isTranslatingRef = useRef(false);

  // Sync Ref
  useEffect(() => {
    currentTranslationRef.current = currentTranslation;
  }, [currentTranslation]);

  // Settings
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [modelList, setModelList] = useState([]);
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('gemini_model') || 'gemini-2.5-flash-lite');

  // Language Configuration (Bi-directional Pair)
  const [primaryLanguage, setPrimaryLanguage] = useState(localStorage.getItem('primary_lang') || 'en');
  const [secondaryLanguage, setSecondaryLanguage] = useState(localStorage.getItem('secondary_lang') || 'ar');
  const [geminiEnabled, setGeminiEnabled] = useState(localStorage.getItem('gemini_enabled') !== 'false'); // Default true
  const [transliterationStyle, setTransliterationStyle] = useState(localStorage.getItem('gemini_style') || 'clean');
  const [useContextualTranslation, setUseContextualTranslation] = useState(localStorage.getItem('use_contextual') === 'true');
  const [interimTranslationEnabled, setInterimTranslationEnabled] = useState(localStorage.getItem('interim_translation_enabled') === 'true');
  const [interimThrottle, setInterimThrottle] = useState(parseInt(localStorage.getItem('interim_throttle') || '250'));
  const [diarizationEnabled, setDiarizationEnabled] = useState(localStorage.getItem('diarization_enabled') === 'true');
  const [speakerNames, setSpeakerNames] = useState(JSON.parse(localStorage.getItem('speaker_names') || '{}'));

  // Refs for Event Listeners (Prevent Stale Closures)
  const useContextualRef = useRef(useContextualTranslation);
  const interimEnabledRef = useRef(interimTranslationEnabled);

  useEffect(() => {
    useContextualRef.current = useContextualTranslation;
    interimEnabledRef.current = interimTranslationEnabled;
  }, [useContextualTranslation, interimTranslationEnabled]);

  // Conversation History
  const [conversations, setConversations] = useState(JSON.parse(localStorage.getItem('conversations') || '{}'));
  const [currentId, setCurrentId] = useState(localStorage.getItem('current_conversation_id') || Date.now().toString());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [showSettings, setShowSettings] = useState(!geminiKey && geminiEnabled);

  // Auto-Save Effect
  useEffect(() => {
    if (messages.length > 0) {
      setConversations(prev => {
        const updated = {
          ...prev,
          [currentId]: {
            id: currentId,
            updatedAt: Date.now(),
            preview: messages[0]?.text?.substring(0, 30) + '...' || 'New Chat',
            messages: messages,
            // speakerNames could be specific per chat, but keeping global for now as user pref
          }
        };
        localStorage.setItem('conversations', JSON.stringify(updated));
        return updated;
      });
    }
  }, [messages, currentId]);

  // Persist Current ID
  useEffect(() => {
    localStorage.setItem('current_conversation_id', currentId);
  }, [currentId]);

  // Load Conversation on Mount or ID Change
  useEffect(() => {
    const savedConv = conversations[currentId];
    if (savedConv && savedConv.messages) {
      // Only set if different to avoid loop, but simple set is fine as messages usage triggers save
      // Actually, we must be careful not to overwrite valid state with empty if switching
      // Logic: When switching ID, we load.
    }
  }, [currentId]); // This logic is tricky with the Auto-Save. 
  // Better approach: Handle loading in the Select handler, and only use Effect for saving.

  const handleNewChat = () => {
    const newId = Date.now().toString();
    setCurrentId(newId);
    setMessages([]);
    setCurrentTranscript('');
    setCurrentTranslation(null);
  };

  const handleSelectChat = (id) => {
    if (conversations[id]) {
      setCurrentId(id);
      setMessages(conversations[id].messages || []);
      setCurrentTranscript('');
      setCurrentTranslation(null);
    }
    setIsSidebarOpen(false);
  };

  const handleDeleteChat = (id) => {
    const updated = { ...conversations };
    delete updated[id];
    setConversations(updated);
    localStorage.setItem('conversations', JSON.stringify(updated));

    if (id === currentId) {
      handleNewChat();
    }
  };

  const handleExportChat = (id) => {
    const chat = conversations[id];
    if (!chat) return;

    const text = chat.messages.map(m =>
      `[${m.role}] ${m.speaker ? `(Speaker ${m.speaker})` : ''}: ${m.text}\nTranslation: ${m.translation?.arabic || ''} (${m.translation?.phonetic || ''})`
    ).join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masri-chat-${id}.txt`;
    a.click();
  };

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

      // Create Message immediately
      // If Contextual (Gemini) is enabled, DO NOT use Soniox's native translation (targetText)
      // because we want to wait for Gemini's higher quality output.
      // If UseContextual is false, use targetText (Native).
      // Use recent interim result as placeholder to prevent UI flashing empty
      const initialArabic = useContextualTranslation
        ? (currentTranslationRef.current?.arabic || '')
        : targetText;

      const newMessage = {
        role: 'user',
        text: sourceText,
        translation: { arabic: initialArabic, phonetic: '' },
        speaker: data.speaker // Store Speaker ID if present
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
        // Update Detected Language State for Gemini
        if (data.detected) {
          setCurrentDetectedLang(data.detected);
        }

        // Show Source
        const showText = (data.detected === primaryLanguage) ? data.primary : data.secondary;
        setCurrentTranscript(showText || data.primary || data.secondary);

        // Soniox Native Interim: If enabled AND NOT using Contextual (Gemini)
        // Check REFS for strictly live state
        if (interimEnabledRef.current && !useContextualRef.current) {
          const tText = (data.detected === primaryLanguage) ? data.secondary : data.primary;

          if (tText) {
            setCurrentTranslation({
              arabic: tText, // Native translation
              phonetic: '...' // No phonetics for live interim
            });
          }
        }
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
  }, [geminiKey, selectedModel, primaryLanguage, secondaryLanguage, geminiEnabled, transliterationStyle, useContextualTranslation, interimTranslationEnabled]);


  // Gemini Interim Logic (Debounced)
  // Ref for throttling
  const lastCallTimeRef = useRef(0);

  // Gemini Interim Logic (Event-Driven Smart Throttle)
  useEffect(() => {
    if (!interimTranslationEnabled || !useContextualTranslation || !geminiKey) return;

    // 1. Cleanup Leak: If transcript cleared, clear translation
    if (!currentTranscript) {
      // Only clear if we have a residual value (and not during handoff which is handled by cleanup elsewhere, 
      // but here we ensure consistency if Soniox restarts)
      if (currentTranslationRef.current) setCurrentTranslation(null);
      return;
    }

    // Validation
    if (currentTranscript.length < 2) return;
    if (currentTranscript === lastTranslatedTextRef.current) return;

    const performTranslation = async () => {
      if (isTranslatingRef.current) return;
      isTranslatingRef.current = true;

      try {
        const isSecondary = currentDetectedLang === secondaryLanguage;
        const sourceLang = isSecondary ? secondaryLanguage : primaryLanguage;
        const targetLang = isSecondary ? primaryLanguage : secondaryLanguage;

        const result = await translateText(
          currentTranscript,
          geminiKey,
          selectedModel,
          sourceLang,
          targetLang,
          transliterationStyle,
          true
        );

        if (result) {
          setCurrentTranslation({
            arabic: result.arabic,
            phonetic: result.phonetic
          });
          lastTranslatedTextRef.current = currentTranscript;
          lastCallTimeRef.current = Date.now();
        }
      } catch (e) {
        console.warn("Interim Error:", e);
      } finally {
        isTranslatingRef.current = false;
      }
    };

    // Smart Throttle Logic
    // If > 200ms has passed since last translation, fire immediately (High Responsiveness)
    // This feels like "every word" without killing the API.
    const now = Date.now();
    const timeSinceLast = now - lastCallTimeRef.current; // undefined safe? ref init 0.

    if (timeSinceLast > interimThrottle) {
      performTranslation();
    }

    // Trailing Debounce for safety (catches end of pauses < throttle)
    const timer = setTimeout(() => {
      if (currentTranscript !== lastTranslatedTextRef.current) performTranslation();
    }, 600);

    return () => clearTimeout(timer);

  }, [currentTranscript, currentDetectedLang, interimTranslationEnabled, useContextualTranslation, geminiKey, selectedModel, primaryLanguage, secondaryLanguage, transliterationStyle, interimThrottle]);

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Start Soniox with configured pair and Diarization
      // DISABLE Soniox Translation if Contextual (Gemini) is enabled to save tokens/latency
      const enableSonioxTranslation = !useContextualTranslation;
      startRecording(primaryLanguage, secondaryLanguage, diarizationEnabled, null, enableSonioxTranslation);
    }
  };

  const saveSettings = (key, prim, sec, enabled, model, style, contextual, diarization, interim, throttle) => {
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

    setDiarizationEnabled(diarization);
    localStorage.setItem('diarization_enabled', diarization);

    setInterimTranslationEnabled(interim);
    localStorage.setItem('interim_translation_enabled', interim);

    setInterimThrottle(throttle);
    localStorage.setItem('interim_throttle', throttle);

    setShowSettings(false);
  };

  const handleRenameSpeaker = (id, newName) => {
    const updated = { ...speakerNames, [id]: newName };
    setSpeakerNames(updated);
    localStorage.setItem('speaker_names', JSON.stringify(updated));
  };

  return (
    <div className="h-[100dvh] w-screen bg-background text-text-main flex flex-col font-sans overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Menu />
          </button>
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

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          conversations={conversations}
          currentId={currentId}
          onSelect={handleSelectChat}
          onNew={handleNewChat}
          onDelete={handleDeleteChat}
          onExport={handleExportChat}
        />

        {/* Chat Content */}
        <main className="flex-1 relative flex flex-col min-h-0 w-full">
          <LiveTranscript
            messages={messages}
            currentTranscript={currentTranscript}
            currentTranslation={currentTranslation}
            speakerNames={speakerNames}
            onRenameSpeaker={handleRenameSpeaker}
          />
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

                {/* File Upload for Testing */}
                <label className="p-3 bg-surface border border-border rounded-xl cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-center text-primary group relative">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        // Stop any existing recording
                        if (isRecording) stopRecording();

                        // Start with file
                        // Correctly apply Contextual logic to file uploads too
                        const enableSonioxTranslation = !useContextualTranslation;
                        startRecording(primaryLanguage, secondaryLanguage, diarizationEnabled, file, enableSonioxTranslation);

                        // Reset input so same file can be selected again
                        e.target.value = '';
                      }
                    }}
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                  {/* Tooltip */}
                  <span className="absolute bottom-full mb-2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Test with Audio File
                  </span>
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
        </main >
      </div>

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
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-400">Gemini Model ID</label>
                        <button
                          onClick={() => {
                            if (geminiKey) {
                              getAvailableModels(geminiKey).then(models => {
                                if (models && models.length > 0) setModelList(models);
                                else alert('No models found. Check API Key.');
                              });
                            }
                          }}
                          className="text-gray-400 hover:text-white transition-colors p-1"
                          title="Refresh Model List"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          list="gemini-models-list"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                          placeholder="e.g. gemini-2.5-flash-lite"
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                        />
                        <datalist id="gemini-models-list">
                          {modelList.map((m) => (
                            <option key={m.name} value={m.name}>{m.displayName}</option>
                          ))}
                        </datalist>
                      </div>
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

                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">Speaker Diarization</span>
                        <span className="text-xs text-gray-400">Identify different speakers (Speaker 0, 1...)</span>
                      </div>
                      <button
                        onClick={() => setDiarizationEnabled(!diarizationEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${diarizationEnabled ? 'bg-primary' : 'bg-gray-600'}`}
                      >
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${diarizationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">Interim Real-time (Experimental)</span>
                        <span className="text-xs text-gray-400">Translate words as they are spoken</span>
                      </div>
                      <button
                        onClick={() => setInterimTranslationEnabled(!interimTranslationEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${interimTranslationEnabled ? 'bg-primary' : 'bg-gray-600'}`}
                      >
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${interimTranslationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {interimTranslationEnabled && (
                      <div className="space-y-2 pl-2 border-l-2 border-primary/20 bg-white/5 p-3 rounded-r-lg">
                        <label className="text-sm text-gray-400">Interim Throttle (Latency)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="50"
                            max="5000"
                            step="10"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary/50"
                            value={interimThrottle}
                            onChange={(e) => setInterimThrottle(parseInt(e.target.value) || 0)}
                          />
                          <span className="text-sm font-medium text-gray-400">ms</span>
                        </div>
                      </div>
                    )}
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
                  <button onClick={() => saveSettings(geminiKey, primaryLanguage, secondaryLanguage, geminiEnabled, selectedModel, transliterationStyle, useContextualTranslation, diarizationEnabled, interimTranslationEnabled, interimThrottle)} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover">Save & Start</button>
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
