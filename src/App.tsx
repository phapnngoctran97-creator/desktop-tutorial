
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HistoryItem, GeneratedStory, WordDefinition, TranslationResponse } from './types';
import { translateText, generateStoryFromWords, lookupWord, generateSpeech } from './services/geminiService';
import { 
  BookOpenIcon, 
  LanguageIcon, 
  ClockIcon, 
  SparklesIcon, 
  TrashIcon, 
  ArrowPathIcon,
  SpeakerWaveIcon,
  PauseIcon,
  XMarkIcon,
  AcademicCapIcon
} from './components/Icons';

// Constants
const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
const STORAGE_KEY_HISTORY = 'vocastory_history';
const STORAGE_KEY_STORY = 'vocastory_stories';
const STORAGE_KEY_LAST_GEN = 'vocastory_last_gen_time';

const SUGGESTED_THEMES = [
  "Cuộc sống hàng ngày",
  "Du lịch & Khám phá",
  "Công việc & Kinh doanh",
  "Tình bạn & Gia đình",
  "Khoa học & Công nghệ",
  "Phiêu lưu giả tưởng",
  "Đồ ăn & Ẩm thực"
];

const VOICE_OPTIONS = [
  { id: 'Kore', label: '👩 Nữ (Kore)', type: 'female' },
  { id: 'Fenrir', label: '👨 Nam (Fenrir)', type: 'male' },
  { id: 'Puck', label: '😐 Nam (Puck)', type: 'male' },
  { id: 'Charon', label: '👹 Nam trầm (Charon)', type: 'male' }
];

const App: React.FC = () => {
  // State
  const [inputText, setInputText] = useState('');
  const [translatedResult, setTranslatedResult] = useState<TranslationResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [lastGenTime, setLastGenTime] = useState<number>(0);
  const [isLoadingTranslate, setIsLoadingTranslate] = useState(false);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [storyTheme, setStoryTheme] = useState('');
  const [storyType, setStoryType] = useState<'story' | 'dialogue'>('story');
  
  // New State for Bilingual & Lookup Features
  const [showVietnamese, setShowVietnamese] = useState<Record<string, boolean>>({});
  const [showGrammar, setShowGrammar] = useState<Record<string, boolean>>({}); // State for hiding/showing grammar
  const [selectedWord, setSelectedWord] = useState<WordDefinition | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  
  // Audio State
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null); // Track ID of currently playing/paused item
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [audioProgress, setAudioProgress] = useState<number>(0); // 0.0 to 1.0 representing playback progress
  
  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null); // Request Animation Frame ref
  const audioStartTimeRef = useRef<number>(0);
  const audioDurationRef = useRef<number>(0);

  // Derived State
  const timeSinceLastGen = Date.now() - lastGenTime;
  const isReadyForStory = timeSinceLastGen >= TEN_HOURS_MS || lastGenTime === 0;
  const progressPercent = Math.min((timeSinceLastGen / TEN_HOURS_MS) * 100, 100);

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groupList: { dateLabel: string; items: HistoryItem[] }[] = [];
    
    // Sort history by timestamp descending first
    const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

    sortedHistory.forEach(item => {
        const date = new Date(item.timestamp);
        const dateLabel = date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });
        // Capitalize first letter
        const formattedDateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

        let group = groupList.find(g => g.dateLabel === formattedDateLabel);
        if (!group) {
            group = { dateLabel: formattedDateLabel, items: [] };
            groupList.push(group);
        }
        group.items.push(item);
    });
    
    return groupList;
  }, [history]);

  // Load data on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    const savedStories = localStorage.getItem(STORAGE_KEY_STORY);
    const savedTime = localStorage.getItem(STORAGE_KEY_LAST_GEN);

    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedStories) setStories(JSON.parse(savedStories));
    if (savedTime) setLastGenTime(parseInt(savedTime, 10));

    // Cleanup audio on unmount
    return () => {
      stopAllAudio();
    };
  }, []);

  // Persist data when changed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STORY, JSON.stringify(stories));
  }, [stories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LAST_GEN, lastGenTime.toString());
  }, [lastGenTime]);

  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) return;

    setIsLoadingTranslate(true);
    try {
      const result = await translateText(inputText);
      setTranslatedResult(result);

      // Add to history if unique (based on source text)
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        vietnamese: inputText.trim(),
        english: result.english.trim(),
        partOfSpeech: result.partOfSpeech,
        usageHint: result.usageHint,
        timestamp: Date.now(),
        usedInStory: false,
      };

      setHistory(prev => [newItem, ...prev]);
    } catch (error) {
      console.error("Translation failed", error);
      alert("Có lỗi xảy ra khi dịch. Vui lòng thử lại.");
    } finally {
      setIsLoadingTranslate(false);
    }
  }, [inputText]);

  const handleGenerateStory = useCallback(async (force: boolean = false) => {
    const recentWords = history.filter(item => item.timestamp > lastGenTime);
    let targetWords = recentWords;
    if (targetWords.length < 5) {
        targetWords = history.slice(0, 15);
    }

    if (targetWords.length === 0) {
      alert("Bạn cần tra cứu thêm từ vựng để tạo câu chuyện!");
      return;
    }

    if (!isReadyForStory && !force) {
      alert(`Vui lòng đợi thêm ${Math.ceil((TEN_HOURS_MS - timeSinceLastGen) / (1000 * 60 * 60))} tiếng nữa.`);
      return;
    }

    setIsLoadingStory(true);
    const startTime = Date.now();
    try {
      const wordList = targetWords.map(w => w.english);
      // Pass the storyType to the service
      const result = await generateStoryFromWords(wordList, storyTheme, storyType);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      const newStory: GeneratedStory = {
        id: Date.now().toString(),
        content: result.english,
        vietnameseContent: result.vietnamese,
        grammarPoints: result.grammarPoints,
        timestamp: Date.now(),
        vocabularyUsed: wordList,
        theme: (storyType === 'dialogue' ? '💬 Hội thoại - ' : '📖 Truyện ngắn - ') + (storyTheme || 'General'),
        generationTimeMs: duration
      };

      setStories(prev => [newStory, ...prev]);
      setLastGenTime(Date.now());
      
    } catch (error) {
      console.error("Story generation failed", error);
      alert("Không thể tạo câu chuyện lúc này.");
    } finally {
      setIsLoadingStory(false);
    }
  }, [history, isReadyForStory, lastGenTime, storyTheme, timeSinceLastGen, storyType]);

  const handleClearHistory = () => {
    if (window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử?")) {
      setHistory([]);
      setStories([]);
      setLastGenTime(0);
      setTranslatedResult(null);
    }
  };

  const handleDeleteWord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteStory = (id: string) => {
    setStories(prev => prev.filter(story => story.id !== id));
    if (activeAudioId === id) stopAllAudio();
  };

  const handleWordClick = async (word: string, context: string, event: React.MouseEvent) => {
    // Clean the word (remove punctuation)
    const cleanWord = word.replace(/[.,!?;:()"]/g, '');
    if (!cleanWord) return;

    setIsLookingUp(true);
    // Temporary placeholder while loading
    setSelectedWord({ word: cleanWord, phonetic: '...', type: '...', meaning: 'Đang tải...', example: '' });

    try {
      const definition = await lookupWord(cleanWord, context);
      setSelectedWord({ ...definition, word: cleanWord });
    } catch (e) {
      setSelectedWord(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const toggleVietnamese = (storyId: string) => {
    setShowVietnamese(prev => ({ ...prev, [storyId]: !prev[storyId] }));
  };

  const toggleGrammar = (storyId: string) => {
    setShowGrammar(prev => ({ ...prev, [storyId]: !prev[storyId] }));
  };

  // Helper to decode Raw PCM Data from Gemini
  const decodePCMData = (audioData: Uint8Array, audioContext: AudioContext) => {
    // Convert Uint8Array to Int16Array (PCM 16-bit)
    const pcm16 = new Int16Array(audioData.buffer);
    const frameCount = pcm16.length;
    // Create an audio buffer with 24kHz sample rate (Gemini Standard)
    const audioBuffer = audioContext.createBuffer(1, frameCount, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      // Normalize to float [-1.0, 1.0]
      channelData[i] = pcm16[i] / 32768.0;
    }
    return audioBuffer;
  };

  // AUDIO CONTROLLER
  const stopAllAudio = () => {
    // Stop Native TTS
    window.speechSynthesis.cancel();
    
    // Stop Gemini Audio
    if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
        audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.suspend();
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setActiveAudioId(null);
    setIsPaused(false);
    setIsLoadingAudio(false);
    setAudioProgress(0);
  };

  /**
   * Universal Audio Toggle Handler
   * @param id Unique identifier for the audio source
   * @param text The text content to read
   * @param forceGemini If true, prioritize Gemini API over Native TTS
   * @param isDialogue If true, use multi-speaker mode
   */
  const handleAudioToggle = async (id: string, text: string, forceGemini: boolean = false, isDialogue: boolean = false) => {
    // 1. If clicking the SAME active item
    if (activeAudioId === id) {
        if (isPaused) {
            // RESUME
            if (forceGemini || text.length >= 150) {
                audioContextRef.current?.resume();
            } else {
                window.speechSynthesis.resume();
            }
            setIsPaused(false);
        } else {
            // PAUSE
            if (forceGemini || text.length >= 150) {
                audioContextRef.current?.suspend();
            } else {
                window.speechSynthesis.pause();
            }
            setIsPaused(true);
        }
        return;
    }

    // 2. If clicking a NEW item
    stopAllAudio(); // Clear previous
    setActiveAudioId(id);
    setIsLoadingAudio(true);
    setAudioProgress(0);

    // Initialize/Resume Audio Context (Required for mobile)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }

    // Determine strategy
    const isMale = ['Fenrir', 'Puck', 'Charon'].includes(selectedVoice);

    // Helper for Native TTS (Ultimate Fallback)
    const playNativeTTS = (textToSpeak: string) => {
        try {
            // Clean text for native TTS
            const cleanText = textToSpeak.replace(/<\/?[^>]+(>|$)/g, "").replace(/\*\*/g, "");
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'en-US';
            utterance.rate = Math.max(0.8, Math.min(playbackSpeed, 1.2)); 
            utterance.volume = 1;
            
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => {
              const name = v.name.toLowerCase();
              const lang = v.lang;
              if (!lang.startsWith('en')) return false;
              
              if (isMale) return name.includes('male') || name.includes('david');
              return name.includes('female') || name.includes('zira');
            });

            if (preferredVoice) utterance.voice = preferredVoice;
            
            utterance.onend = () => { setActiveAudioId(null); setIsLoadingAudio(false); setAudioProgress(0); };
            utterance.onerror = () => { setActiveAudioId(null); setIsLoadingAudio(false); setAudioProgress(0); };
            
            setIsLoadingAudio(false); 
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error("Native TTS also failed", e);
            alert("Thiết bị của bạn không hỗ trợ phát âm thanh.");
            stopAllAudio();
        }
    };

    // STRATEGY 1: NATIVE TTS for short text (Fastest)
    if (!forceGemini && text.length < 150) {
        playNativeTTS(text);
        return;
    }

    // STRATEGY 2: GEMINI AI
    try {
        // Pass isDialogue flag to service
        const base64Audio = await generateSpeech(text, selectedVoice, isDialogue);
        
        // If Gemini fails (returns undefined), throw error to trigger catch block
        if (!base64Audio) throw new Error("Gemini Audio generation returned empty");

        // Convert Base64 to Uint8Array
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const ctx = audioContextRef.current!;
        const audioBuffer = decodePCMData(bytes, ctx);
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackSpeed;
        source.connect(ctx.destination);
        
        audioSourceRef.current = source;
        audioStartTimeRef.current = ctx.currentTime;
        audioDurationRef.current = audioBuffer.duration / playbackSpeed;

        // Progress Tracking Loop for Visual Karaoke
        const trackProgress = () => {
          if (!isPaused && audioContextRef.current?.state === 'running') {
            const elapsedTime = audioContextRef.current.currentTime - audioStartTimeRef.current;
            const progress = Math.min(Math.max(elapsedTime / audioDurationRef.current, 0), 1);
            setAudioProgress(progress);
            
            if (progress < 1) {
              rafRef.current = requestAnimationFrame(trackProgress);
            }
          } else if (isPaused) {
             // If paused, keep loop alive
             rafRef.current = requestAnimationFrame(trackProgress);
          }
        };

        source.onended = () => {
            setActiveAudioId(null);
            setIsPaused(false);
            setAudioProgress(0);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        
        source.start();
        rafRef.current = requestAnimationFrame(trackProgress);
        setIsLoadingAudio(false);

    } catch (error) {
        console.warn("Gemini Audio failed, switching to Native TTS fallback", error);
        // ULTIMATE FALLBACK: Use Browser Native TTS if Gemini fails
        playNativeTTS(text);
    }
  };

  // Helper component to render clickable text with KARAOKE highlight
  const InteractiveStoryText = ({ content, storyId }: { content: string, storyId: string }) => {
    // Determine active state for this story
    const isActive = activeAudioId === storyId;
    
    // We need to split text into words but preserve structure.
    // For simplicity of highlighting estimation:
    // 1. Calculate total estimated word count
    // 2. Based on audioProgress (0-1), find which word index we are at.
    
    // Split by spaces to count words for progress estimation
    const rawWords = content.replace(/<\/?[^>]+(>|$)/g, "").split(/\s+/).filter(w => w.length > 0);
    const totalWords = rawWords.length;
    const currentWordIndex = isActive ? Math.floor(audioProgress * totalWords) : -1;

    let globalWordCounter = 0;

    const parts = content.split(/(<b>.*?<\/b>)/g);

    return (
      <div className="leading-loose whitespace-pre-wrap font-medium">
        {parts.map((part, index) => {
          if (part.startsWith('<b>') && part.endsWith('</b>')) {
            const innerText = part.replace(/<\/?b>/g, '');
            // Highlight check
            const isHighlighted = isActive && globalWordCounter === currentWordIndex;
            globalWordCounter++; // Increment count

            return (
              <span 
                key={index} 
                onClick={(e) => handleWordClick(innerText, content, e)}
                className={`font-extrabold cursor-pointer px-1.5 py-0.5 rounded transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)] border mx-0.5
                    ${isHighlighted 
                        ? 'bg-yellow-400 text-black scale-110 border-yellow-500 z-10' 
                        : 'text-amber-300 bg-amber-500/20 hover:bg-amber-500/40 border-amber-500/30'}`}
              >
                {innerText}
              </span>
            );
          } else {
            return (
              <span key={index}>
                {part.split(/(\s+)/).map((word, wIndex) => {
                  if (word.trim().length === 0) return word;
                  
                  const isHighlighted = isActive && globalWordCounter === currentWordIndex;
                  globalWordCounter++;

                  return (
                    <span 
                      key={`${index}-${wIndex}`}
                      onClick={(e) => handleWordClick(word, content, e)}
                      className={`cursor-pointer transition-colors px-0.5 rounded
                        ${isHighlighted 
                            ? 'bg-yellow-400/80 text-black font-bold' 
                            : 'hover:underline hover:text-indigo-200'}`}
                    >
                      {word}
                    </span>
                  );
                })}
              </span>
            );
          }
        })}
      </div>
    );
  };

  const SpeedSelector = ({ theme = 'light' }: { theme?: 'light' | 'dark' }) => {
    const bgClass = theme === 'dark' ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-100';
    const accentClass = theme === 'dark' ? 'accent-green-400' : 'accent-indigo-500';

    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bgClass} transition-colors`} onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] font-bold uppercase tracking-wider min-w-[30px] text-center">
          {playbackSpeed.toFixed(1)}x
        </span>
        <input 
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          className={`w-20 h-1.5 bg-gray-300/50 rounded-lg appearance-none cursor-pointer ${accentClass}`}
          title="Điều chỉnh tốc độ đọc"
        />
      </div>
    );
  };

  const VoiceSelector = ({ theme = 'light' }: { theme?: 'light' | 'dark' }) => {
    const bgClass = theme === 'dark' ? 'bg-white/10 text-white border-white/20' : 'bg-indigo-50 text-indigo-700 border-indigo-100';

    return (
      <div className="relative inline-block" onClick={e => e.stopPropagation()}>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className={`appearance-none cursor-pointer pl-3 pr-8 py-1.5 text-xs font-bold rounded-full border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${bgClass}`}
        >
          {VOICE_OPTIONS.map(voice => (
            <option key={voice.id} value={voice.id} className="text-gray-900 bg-white">
              {voice.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-current opacity-70">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-12 relative">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BookOpenIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">VocaStory AI</h1>
          </div>
          <button 
            onClick={handleClearHistory}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Xóa dữ liệu"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Translation Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <label className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
              <LanguageIcon className="w-4 h-4" />
              Tiếng Việt
            </label>
            <textarea
              className="w-full flex-grow p-4 bg-gray-50 rounded-xl border-transparent focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all resize-none text-lg outline-none"
              placeholder="Nhập từ hoặc câu cần dịch..."
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTranslate();
                }
              }}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleTranslate}
                disabled={isLoadingTranslate || !inputText.trim()}
                className={`px-6 py-2.5 rounded-xl font-medium text-white shadow-lg shadow-indigo-200 transition-all transform active:scale-95 flex items-center gap-2
                  ${isLoadingTranslate || !inputText.trim() 
                    ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-300'}`}
              >
                {isLoadingTranslate ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Đang dịch...
                  </>
                ) : (
                  'Dịch sang Tiếng Anh'
                )}
              </button>
            </div>
          </div>

          {/* Output */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full relative overflow-hidden">
            <label className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-indigo-500" />
              Tiếng Anh
            </label>
            <div className="flex-grow flex items-center justify-center p-4 bg-indigo-50 rounded-xl border border-indigo-100 min-h-[140px]">
              {translatedResult ? (
                <div className="w-full text-center animate-fade-in flex flex-col items-center">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <p className="text-xl md:text-3xl font-bold text-indigo-900 break-words">
                        {translatedResult.english}
                      </p>
                      <button 
                        onClick={() => handleAudioToggle('translate_res', translatedResult.english)}
                        disabled={isLoadingAudio && activeAudioId === 'translate_res'}
                        className={`p-2 rounded-full transition-all shadow-sm ${activeAudioId === 'translate_res' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-100'}`}
                        title={activeAudioId === 'translate_res' && !isPaused ? "Tạm dừng" : "Nghe phát âm"}
                      >
                         {activeAudioId === 'translate_res' && !isPaused ? (
                           <PauseIcon className="w-5 h-5" />
                         ) : (
                           <SpeakerWaveIcon className="w-5 h-5" />
                         )}
                      </button>
                    </div>

                    {translatedResult.phonetic && (
                      <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {translatedResult.phonetic}
                      </span>
                    )}
                    {translatedResult.partOfSpeech && (
                      <span className="text-xs font-semibold uppercase tracking-wide bg-indigo-200 text-indigo-800 px-2 py-1 rounded-md">
                        {translatedResult.partOfSpeech}
                      </span>
                    )}
                  </div>
                  
                  <div className="mb-4 flex items-center gap-2 justify-center flex-wrap">
                     <VoiceSelector theme="light" />
                     <SpeedSelector theme="light" />
                  </div>

                  {translatedResult.usageHint && (
                    <div className="mt-2 text-sm text-indigo-600 bg-white/50 px-4 py-2 rounded-lg italic inline-block max-w-[90%] border border-indigo-100/50">
                      💡 {translatedResult.usageHint}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-center text-sm">Kết quả dịch sẽ hiện ở đây</p>
              )}
            </div>
          </div>
        </section>

        {/* Vocabulary Bank */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Kho Từ Vựng Của Bạn</h2>
            <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded-md">{history.length} từ</span>
          </div>
          
          {groupedHistory.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
              Chưa có từ vựng nào. Hãy bắt đầu tra cứu!
            </div>
          ) : (
            <div className="space-y-6">
              {groupedHistory.map(group => (
                <div key={group.dateLabel} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                    <ClockIcon className="w-4 h-4 text-indigo-400" />
                    {group.dateLabel}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {group.items.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleAudioToggle(item.id, item.english)}
                        className={`group relative flex flex-col bg-gray-50 hover:bg-indigo-50 border px-4 py-2 rounded-xl transition-all min-w-[140px] max-w-[240px] cursor-pointer active:scale-95 ${activeAudioId === item.id ? 'border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}
                        title="Nhấn để nghe phát âm"
                      >
                        <button 
                          onClick={(e) => handleDeleteWord(item.id, e)}
                          className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-red-200 hover:bg-red-200 z-10"
                          title="Xóa từ này"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-indigo-700 truncate mr-2 flex items-center gap-1">
                            {item.english}
                            {activeAudioId === item.id && !isPaused ? (
                               <PauseIcon className="w-3 h-3 text-indigo-500" />
                            ) : (
                               <SpeakerWaveIcon className="w-3 h-3 text-indigo-300 opacity-0 group-hover:opacity-100" />
                            )}
                          </span>
                          {item.partOfSpeech && (
                            <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded">
                              {item.partOfSpeech.substring(0, 4)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 truncate" title={item.vietnamese}>{item.vietnamese}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Story Generator Section */}
        <section className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5"></div>
          <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 rounded-full bg-white opacity-5"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Controls */}
            <div className="lg:col-span-1 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <BookOpenIcon className="w-6 h-6" />
                  Ôn Tập Qua Truyện
                </h2>
                <p className="text-indigo-200 text-sm">
                  Hệ thống tạo truyện/hội thoại song ngữ mỗi 10 tiếng.
                </p>
              </div>

              {/* Timer / Progress */}
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-indigo-100 flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    Thời gian hồi
                  </span>
                  <span className="text-xs text-indigo-200">
                    {isReadyForStory ? 'Sẵn sàng!' : `${Math.floor((TEN_HOURS_MS - timeSinceLastGen) / (1000 * 60 * 60))}h nữa`}
                  </span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-1000 ${isReadyForStory ? 'bg-green-400' : 'bg-indigo-400'}`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Story Type Selector */}
              <div className="flex gap-2 p-1 bg-white/10 rounded-xl">
                 <button
                    onClick={() => setStoryType('story')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${storyType === 'story' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'}`}
                 >
                    📖 Truyện Ngắn
                 </button>
                 <button
                    onClick={() => setStoryType('dialogue')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${storyType === 'dialogue' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'}`}
                 >
                    💬 Hội Thoại
                 </button>
              </div>

              <div className="space-y-3">
                <input 
                  type="text" 
                  value={storyTheme}
                  onChange={(e) => setStoryTheme(e.target.value)}
                  placeholder="Chủ đề (VD: Adventure)..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
                
                {/* Suggested Themes */}
                <div className="flex flex-wrap gap-2">
                   {SUGGESTED_THEMES.map(theme => (
                     <button
                        key={theme}
                        onClick={() => setStoryTheme(theme)}
                        className="text-[10px] sm:text-xs bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/30 text-indigo-100 px-2 py-1 rounded-full transition-colors"
                     >
                        {theme}
                     </button>
                   ))}
                </div>

                <button
                  onClick={() => handleGenerateStory(true)} 
                  disabled={isLoadingStory || history.length < 2}
                  className="w-full py-3 bg-white text-indigo-900 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-4"
                >
                  {isLoadingStory ? (
                     <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-5 h-5" />
                  )}
                  {isReadyForStory ? 'Tạo Nội Dung Ngay' : 'Tạo Ngay (Bỏ qua chờ)'}
                </button>
              </div>
            </div>

            {/* Story Display */}
            <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-white/10 p-6 max-h-[700px] overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {stories.length > 0 ? (
                <div className="space-y-8">
                  {stories.map((story, index) => (
                    <div key={story.id} className="animate-fade-in group">
                      <div className="flex flex-wrap items-center justify-between mb-4 border-b border-white/10 pb-2 gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-indigo-300 bg-indigo-900/50 px-2 py-1 rounded">
                              {story.theme}
                            </span>
                            <span className="text-xs text-indigo-300">
                                {new Date(story.timestamp).toLocaleDateString()}
                            </span>
                            {story.generationTimeMs && (
                              <span className="text-xs text-indigo-300 flex items-center gap-1 border-l border-white/20 pl-2" title="Thời gian tạo">
                                ⚡ {(story.generationTimeMs / 1000).toFixed(1)}s
                              </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1">
                            <VoiceSelector theme="dark" />
                            <div className="h-4 w-[1px] bg-white/20"></div>
                            <SpeedSelector theme="dark" />
                            <div className="h-4 w-[1px] bg-white/20"></div>
                            
                            <button 
                              onClick={() => handleAudioToggle(story.id, story.content, true, story.theme.includes('Hội thoại'))}
                              disabled={isLoadingAudio && activeAudioId === story.id}
                              className={`text-xs p-1.5 rounded transition-colors flex items-center gap-1 ${activeAudioId === story.id ? 'bg-white text-indigo-900 font-bold' : 'hover:bg-white/20 text-white'}`}
                              title={activeAudioId === story.id && !isPaused ? "Tạm dừng đọc" : "Nghe câu chuyện (Gemini Voice)"}
                            >
                              {activeAudioId === story.id ? (
                                <>
                                  {isLoadingAudio ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : 
                                    (isPaused ? <SpeakerWaveIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />)
                                  }
                                </>
                              ) : (
                                <SpeakerWaveIcon className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          <button 
                            onClick={() => toggleVietnamese(story.id)}
                            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1.5 rounded text-indigo-100 transition-colors flex items-center gap-1 h-[34px]"
                          >
                            <LanguageIcon className="w-3.5 h-3.5" />
                            {showVietnamese[story.id] ? 'Ẩn' : 'Dịch'}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteStory(story.id)}
                            className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-200 px-2 py-1.5 rounded transition-colors h-[34px]"
                            title="Xóa câu chuyện"
                          >
                             <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      {/* English Content */}
                      <div className="prose prose-invert prose-lg max-w-none text-indigo-50 mb-6">
                         <InteractiveStoryText content={story.content} storyId={story.id} />
                      </div>

                      {/* Vocabulary list used */}
                      <div className="flex flex-wrap gap-2 mb-6">
                          {story.vocabularyUsed.map((word, i) => (
                            <span key={i} className="text-xs bg-white/10 px-2 py-1 rounded text-indigo-200 font-medium border border-white/5">
                              {word}
                            </span>
                          ))}
                      </div>

                      {/* Vietnamese Content (Collapsible) */}
                      {showVietnamese[story.id] && (
                        <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-500/20 animate-fade-in mb-6">
                          <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2">Bản dịch tiếng việt</h4>
                          <p className="text-indigo-200 text-sm leading-relaxed whitespace-pre-line">
                            {story.vietnameseContent || "Chưa có bản dịch cho câu chuyện này."}
                          </p>
                        </div>
                      )}
                      
                      {/* Grammar Analysis Section (Collapsible Button) */}
                      {story.grammarPoints && story.grammarPoints.length > 0 ? (
                        <div className="mt-4 pt-4 border-t border-white/10">
                           {!showGrammar[story.id] ? (
                             <button 
                                onClick={() => toggleGrammar(story.id)}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 rounded-xl border border-teal-500/20 transition-all font-semibold text-sm"
                             >
                                <AcademicCapIcon className="w-5 h-5" />
                                🔍 Xem Phân Tích Ngữ Pháp
                             </button>
                           ) : (
                             <div className="animate-fade-in bg-teal-950/30 rounded-xl p-1 border border-teal-500/20">
                                <button 
                                   onClick={() => toggleGrammar(story.id)}
                                   className="w-full text-center py-2 text-xs text-teal-500/70 hover:text-teal-400 mb-2 uppercase tracking-wide font-bold"
                                >
                                   Ẩn phân tích
                                </button>
                                <div className="px-4 pb-4 grid grid-cols-1 gap-4">
                                  {story.grammarPoints.map((point, gIndex) => (
                                    <div key={gIndex} className="bg-teal-900/40 rounded-xl p-4 border border-teal-500/20 hover:bg-teal-900/60 transition-colors">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1">
                                        <h5 className="font-bold text-teal-200 text-sm">{point.structure}</h5>
                                        <span className="text-[10px] bg-teal-500/10 text-teal-300 px-2 py-0.5 rounded border border-teal-500/10">Cấu trúc</span>
                                      </div>
                                      <p className="text-xs text-gray-300 mb-3 leading-relaxed">{point.explanation}</p>
                                      
                                      <div className="space-y-2">
                                          <div className="bg-black/20 rounded-lg px-3 py-2 border-l-2 border-teal-500/50">
                                            <p className="text-xs italic text-teal-100">"{point.exampleInStory}"</p>
                                          </div>
                                          <div className="flex items-start gap-1.5 text-xs text-green-300/90">
                                            <span className="mt-0.5">💡</span>
                                            <span>{point.memoryTip}</span>
                                          </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                             </div>
                           )}
                        </div>
                      ) : (
                         <div className="mt-6 pt-4 border-t border-white/5 text-center">
                            <p className="text-xs text-indigo-400 italic">
                               * Tạo câu chuyện mới để xem phân tích ngữ pháp chi tiết.
                            </p>
                         </div>
                      )}

                      {index < stories.length - 1 && <div className="my-8 border-b border-white/5"></div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-indigo-300 opacity-60 min-h-[300px]">
                  <BookOpenIcon className="w-12 h-12 mb-4" />
                  <p>Chưa có câu chuyện nào được tạo.</p>
                  <p className="text-sm">Tra cứu từ vựng và quay lại sau!</p>
                </div>
              )}
            </div>

          </div>
        </section>
      </main>

      {/* Word Definition Modal */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none p-4">
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-100 p-6 pointer-events-auto mb-4 sm:mb-0"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {selectedWord.word}
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-mono">
                    {selectedWord.phonetic}
                  </span>
                </h3>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mt-1">{selectedWord.type}</p>
              </div>
              <button 
                onClick={() => setSelectedWord(null)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <p className="text-gray-700 text-base">{selectedWord.meaning}</p>
              {selectedWord.example && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-600 italic">
                  "{selectedWord.example}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
