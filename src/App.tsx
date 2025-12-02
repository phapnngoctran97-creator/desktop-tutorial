
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HistoryItem, GeneratedStory, WordDefinition, TranslationResponse, WordSuggestion, QuizQuestion } from './types';
import { translateText, generateStoryFromWords, lookupWord, generateSpeech, getWordSuggestions, generateQuizFromWords } from './services/geminiService';
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
  AcademicCapIcon,
  ArrowsRightLeftIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon
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

const QUICK_SUGGESTIONS = {
  vi_en: [
    "Xin chào, bạn khỏe không?",
    "Cảm ơn rất nhiều",
    "Thời tiết hôm nay thế nào?",
    "Tôi đang học tiếng Anh",
    "Món ăn này rất ngon",
    "Cho tôi một ly cà phê",
    "Rất vui được gặp bạn"
  ],
  en_vi: [
    "Hello, how are you?",
    "Thank you so much",
    "What is the weather like?",
    "I am learning Vietnamese",
    "This food is delicious",
    "Can I have a coffee?",
    "Nice to meet you"
  ]
};

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
  const [direction, setDirection] = useState<'vi_en' | 'en_vi'>('en_vi');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [lastGenTime, setLastGenTime] = useState<number>(0);
  const [isLoadingTranslate, setIsLoadingTranslate] = useState(false);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [storyTheme, setStoryTheme] = useState('');
  const [storyType, setStoryType] = useState<'story' | 'dialogue'>('story');
  
  // Suggestion State
  const [suggestions, setSuggestions] = useState<WordSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null); // Ref for click outside
  const ignoreFetchRef = useRef<boolean>(false); // Ref to skip fetch on selection

  // New State for Bilingual & Lookup Features
  const [showVietnamese, setShowVietnamese] = useState<Record<string, boolean>>({});
  const [showGrammar, setShowGrammar] = useState<Record<string, boolean>>({});
  const [selectedWord, setSelectedWord] = useState<WordDefinition | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupCache, setLookupCache] = useState<Record<string, WordDefinition>>({});
  
  // Audio State
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);
  
  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  const audioDurationRef = useRef<number>(0);
  const lastAudioVoiceRef = useRef<string>('');

  // Quiz State
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Derived State
  const timeSinceLastGen = Date.now() - lastGenTime;
  const isReadyForStory = timeSinceLastGen >= TEN_HOURS_MS || lastGenTime === 0;
  const progressPercent = Math.min((timeSinceLastGen / TEN_HOURS_MS) * 100, 100);

  const groupedHistory = useMemo(() => {
    const groupList: { dateLabel: string; items: HistoryItem[] }[] = [];
    const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

    sortedHistory.forEach(item => {
        const date = new Date(item.timestamp);
        const dateLabel = date.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });
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

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    const savedStories = localStorage.getItem(STORAGE_KEY_STORY);
    const savedTime = localStorage.getItem(STORAGE_KEY_LAST_GEN);

    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedStories) setStories(JSON.parse(savedStories));
    if (savedTime) setLastGenTime(parseInt(savedTime, 10));

    return () => {
      stopAllAudio();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STORY, JSON.stringify(stories));
  }, [stories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LAST_GEN, lastGenTime.toString());
  }, [lastGenTime]);

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Autocomplete
  useEffect(() => {
    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    
    // If we just selected a suggestion, ignore the next fetch
    if (ignoreFetchRef.current) {
        ignoreFetchRef.current = false;
        return;
    }

    if (!inputText.trim() || inputText.length > 30) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
    }

    // Use window.setTimeout to ensure it returns a number in browser environment
    suggestionTimeoutRef.current = window.setTimeout(async () => {
        if (inputText.length > 1) {
            const results = await getWordSuggestions(inputText, direction);
            if (results.length > 0) {
                setSuggestions(results);
                setShowSuggestions(true);
            }
        }
    }, 400); // Slightly faster debounce

    return () => {
         if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    };
  }, [inputText, direction]);

  const handleToggleDirection = () => {
    setDirection(prev => prev === 'vi_en' ? 'en_vi' : 'vi_en');
    setTranslatedResult(null);
    setInputText('');
    setSuggestions([]);
  };

  const handleSuggestionClick = (text: string) => {
    ignoreFetchRef.current = true; // Prevent re-fetch
    setInputText(text);
    setSuggestions([]);
    setShowSuggestions(false);
    triggerTranslate(text); 
  };
  
  const handleDropdownSelect = (suggestion: WordSuggestion) => {
      ignoreFetchRef.current = true; // Prevent re-fetch
      setInputText(suggestion.word);
      setSuggestions([]);
      setShowSuggestions(false);
      triggerTranslate(suggestion.word);
  };

  const performTranslation = async (text: string) => {
    if (!text.trim()) return;
    setIsLoadingTranslate(true);
    setSuggestions([]);
    setShowSuggestions(false);
    
    try {
      const result = await translateText(text, direction);
      setTranslatedResult(result);

      let englishText = "";
      let vietnameseText = "";

      if (direction === 'vi_en') {
        englishText = result.english.trim();
        vietnameseText = text.trim();
      } else {
        englishText = text.trim();
        vietnameseText = result.english.trim();
      }

      if (englishText && englishText !== "Error translating") {
          const newItem: HistoryItem = {
            id: Date.now().toString(),
            vietnamese: vietnameseText,
            english: englishText,
            partOfSpeech: result.partOfSpeech,
            usageHint: result.usageHint,
            timestamp: Date.now(),
            usedInStory: false,
          };
          setHistory(prev => [newItem, ...prev]);
      }
    } catch (error) {
      alert("Lỗi dịch thuật. Vui lòng kiểm tra mạng.");
    } finally {
      setIsLoadingTranslate(false);
    }
  };

  const triggerTranslate = (text: string) => performTranslation(text);
  const handleTranslate = useCallback(() => performTranslation(inputText), [inputText, direction]);

  const handleGenerateStory = useCallback(async (force: boolean = false) => {
    const recentWords = history.filter(item => item.timestamp > lastGenTime);
    let targetWords = recentWords;
    if (targetWords.length < 5) targetWords = history.slice(0, 15);

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
      alert("Không thể tạo câu chuyện. Hệ thống đang bận, vui lòng thử lại sau.");
    } finally {
      setIsLoadingStory(false);
    }
  }, [history, isReadyForStory, lastGenTime, storyTheme, timeSinceLastGen, storyType]);

  const handleClearHistory = () => {
    if (window.confirm("Xóa toàn bộ lịch sử?")) {
      setHistory([]);
      setStories([]);
      setLastGenTime(0);
      setTranslatedResult(null);
      setLookupCache({});
    }
  };

  const handleDeleteWord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteStory = (id: string) => {
    setStories(prev => prev.filter(story => story.id !== id));
    if (activeAudioId === id) stopAllAudio();
  };

  const handleWordClick = async (word: string, context: string, event: React.MouseEvent) => {
    const cleanWord = word.replace(/[.,!?;:()"]/g, '').trim();
    if (!cleanWord) return;

    if (lookupCache[cleanWord.toLowerCase()]) {
      setSelectedWord(lookupCache[cleanWord.toLowerCase()]);
      return;
    }

    setIsLookingUp(true);
    setSelectedWord({ word: cleanWord, phonetic: '...', type: '...', meaning: 'Đang tải...', example: '' });

    try {
      const definition = await lookupWord(cleanWord, context);
      const enrichedDefinition = { ...definition, word: cleanWord };
      setSelectedWord(enrichedDefinition);
      setLookupCache(prev => ({ ...prev, [cleanWord.toLowerCase()]: enrichedDefinition }));
    } catch (e) {
      setSelectedWord(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const toggleVietnamese = (storyId: string) => setShowVietnamese(prev => ({ ...prev, [storyId]: !prev[storyId] }));
  const toggleGrammar = (storyId: string) => setShowGrammar(prev => ({ ...prev, [storyId]: !prev[storyId] }));

  const decodePCMData = (audioData: Uint8Array, audioContext: AudioContext) => {
    const pcm16 = new Int16Array(audioData.buffer);
    const frameCount = pcm16.length;
    const audioBuffer = audioContext.createBuffer(1, frameCount, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = pcm16[i] / 32768.0;
    }
    return audioBuffer;
  };

  const stopAllAudio = () => {
    window.speechSynthesis.cancel();
    if (audioSourceRef.current) {
        try { 
            audioSourceRef.current.stop();
            audioSourceRef.current.disconnect();
        } catch(e) {}
        audioSourceRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setActiveAudioId(null);
    setIsPaused(false);
    setIsLoadingAudio(false);
    setAudioProgress(0);
    setHighlightedWordIndex(-1);
  };

  const handleAudioToggle = async (id: string, text: string, forceGemini: boolean = false, isDialogue: boolean = false) => {
    if (activeAudioId === id) {
        if (forceGemini && lastAudioVoiceRef.current !== selectedVoice) {
             stopAllAudio();
        } else {
            if (isPaused) {
                if (audioContextRef.current?.state === 'suspended' && audioSourceRef.current) {
                    await audioContextRef.current.resume();
                } else {
                    window.speechSynthesis.resume();
                }
                setIsPaused(false);
            } else {
                if (audioContextRef.current?.state === 'running' && audioSourceRef.current) {
                    await audioContextRef.current.suspend();
                } else {
                    window.speechSynthesis.pause();
                }
                setIsPaused(true);
            }
            return;
        }
    } else {
        stopAllAudio();
    }

    setActiveAudioId(id);
    setIsLoadingAudio(true);
    setAudioProgress(0);
    setHighlightedWordIndex(-1);
    lastAudioVoiceRef.current = selectedVoice;

    const playNativeTTS = (textToSpeak: string) => {
        try {
            const cleanText = textToSpeak.replace(/<\/?[^>]+(>|$)/g, " ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'en-US';
            utterance.rate = Math.max(0.7, Math.min(playbackSpeed, 1.3));
            
            const voices = window.speechSynthesis.getVoices();
            const isMale = ['Fenrir', 'Puck', 'Charon'].includes(selectedVoice);
            const preferredVoice = voices.find(v => {
              const name = v.name.toLowerCase();
              if (!v.lang.startsWith('en')) return false;
              if (isMale) return name.includes('male') || name.includes('david');
              return name.includes('female') || name.includes('zira') || name.includes('google us english');
            });
            if (preferredVoice) utterance.voice = preferredVoice;
            
            utterance.onend = () => { 
                setActiveAudioId(null); 
                setIsLoadingAudio(false); 
                setAudioProgress(0);
                setHighlightedWordIndex(-1);
            };
            utterance.onerror = (e) => { 
                console.warn("Native TTS Error", e);
                setActiveAudioId(null); 
                setIsLoadingAudio(false); 
            };
            
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    const textBefore = cleanText.substring(0, event.charIndex);
                    const wordCount = textBefore.trim().split(/\s+/).length;
                    setHighlightedWordIndex(wordCount);
                    setAudioProgress(event.charIndex / cleanText.length);
                }
            };
            
            setIsLoadingAudio(false); 
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            stopAllAudio();
            // Silent fail to avoid alert spam
        }
    };

    if (!forceGemini && text.length < 150) {
        playNativeTTS(text);
        return;
    }

    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContextClass();
        }
        
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        const base64Audio = await generateSpeech(text, selectedVoice, isDialogue);
        
        if (!base64Audio) throw new Error("Gemini Audio returned empty");

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

        const trackProgress = () => {
          if (!audioContextRef.current) return;
          if (!isPaused && audioContextRef.current.state === 'running') {
            const currentTime = audioContextRef.current.currentTime;
            const elapsedTime = currentTime - audioStartTimeRef.current;
            const progress = Math.min(Math.max(elapsedTime / audioDurationRef.current, 0), 1);
            setAudioProgress(progress);
            if (progress < 1 && activeAudioId === id) {
              rafRef.current = requestAnimationFrame(trackProgress);
            }
          } else if (isPaused && activeAudioId === id) {
             rafRef.current = requestAnimationFrame(trackProgress);
          }
        };

        source.onended = () => {
             if (activeAudioId === id) {
                setActiveAudioId(null);
                setIsPaused(false);
                setAudioProgress(0);
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
             }
        };
        
        source.start();
        rafRef.current = requestAnimationFrame(trackProgress);
        setIsLoadingAudio(false);

    } catch (error) {
        console.warn("Switching to Native TTS due to API error");
        playNativeTTS(text);
    }
  };

  // QUIZ LOGIC
  const handleStartQuiz = async () => {
    const wordList = history.map(h => h.english);
    if (wordList.length < 5) {
      alert("Bạn cần ít nhất 5 từ vựng trong kho để tạo bài kiểm tra!");
      return;
    }
    
    setIsLoadingQuiz(true);
    try {
      // Pick random 15 words or fewer
      const shuffled = wordList.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 15);
      
      const questions = await generateQuizFromWords(selected);
      setQuizQuestions(questions);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setQuizSubmitted(false);
      setQuizScore(0);
      setIsQuizMode(true);
    } catch (error) {
      alert("Lỗi khi tạo bài kiểm tra. Vui lòng thử lại.");
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const handleQuizAnswer = (option: string) => {
    if (quizSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: option }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };
  
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitQuiz = () => {
    let correctCount = 0;
    quizQuestions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        correctCount++;
      }
    });
    const score = (correctCount / quizQuestions.length) * 10;
    setQuizScore(score);
    setQuizSubmitted(true);
  };

  const handleExitQuiz = () => {
    if (window.confirm("Thoát bài kiểm tra?")) {
      setIsQuizMode(false);
      setQuizQuestions([]);
    }
  };

  // --- UI COMPONENTS ---

  const InteractiveStoryText = ({ content, storyId }: { content: string, storyId: string }) => {
    const isActive = activeAudioId === storyId;
    const plainText = content.replace(/<\/?[^>]+(>|$)/g, " ");
    const allWords = plainText.trim().split(/\s+/).filter(w => w.length > 0);
    const totalWords = allWords.length;
    
    let currentWordIndex = -1;
    if (isActive) {
        if (highlightedWordIndex > -1) {
            currentWordIndex = highlightedWordIndex;
        } else {
            currentWordIndex = Math.floor(audioProgress * totalWords);
        }
    }

    let globalWordCounter = 0;
    const parts = content.split(/(<b>.*?<\/b>)/g);

    return (
      <div className="leading-loose whitespace-pre-wrap font-medium">
        {parts.map((part, index) => {
          if (part.startsWith('<b>') && part.endsWith('</b>')) {
            const innerText = part.replace(/<\/?b>/g, '');
            const isHighlighted = isActive && globalWordCounter === currentWordIndex;
            globalWordCounter++;

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
                {part.split(/(\s+)/).map((token, wIndex) => {
                  if (token.trim().length === 0) return token;
                  const isHighlighted = isActive && globalWordCounter === currentWordIndex;
                  globalWordCounter++;
                  return (
                    <span 
                      key={`${index}-${wIndex}`}
                      onClick={(e) => handleWordClick(token, content, e)}
                      className={`cursor-pointer transition-colors px-0.5 rounded
                        ${isHighlighted 
                            ? 'bg-yellow-400/80 text-black font-bold' 
                            : 'hover:underline hover:text-indigo-200'}`}
                    >
                      {token}
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
  
  // MAIN RENDER FOR QUIZ MODE
  if (isQuizMode) {
      return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
                      <div>
                          <h2 className="text-2xl font-bold flex items-center gap-2"><ClipboardDocumentCheckIcon className="w-6 h-6" /> Bài Kiểm Tra Từ Vựng</h2>
                          <p className="text-indigo-200 text-sm mt-1">Câu {currentQuestionIndex + 1} / {quizQuestions.length}</p>
                      </div>
                      {!quizSubmitted && (
                          <button onClick={handleExitQuiz} className="bg-white/20 hover:bg-white/30 p-2 rounded-full"><XMarkIcon className="w-5 h-5" /></button>
                      )}
                  </div>
                  
                  <div className="p-8 flex-grow overflow-y-auto">
                      {!quizSubmitted ? (
                          <>
                              <h3 className="text-xl font-semibold text-gray-800 mb-6 leading-relaxed">{quizQuestions[currentQuestionIndex]?.question}</h3>
                              <div className="space-y-3">
                                  {quizQuestions[currentQuestionIndex]?.options.map((option, idx) => (
                                      <button
                                          key={idx}
                                          onClick={() => handleQuizAnswer(option)}
                                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3
                                              ${userAnswers[currentQuestionIndex] === option 
                                                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold shadow-md' 
                                                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700'}`}
                                      >
                                          <span className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-sm font-bold shadow-sm">
                                              {String.fromCharCode(65 + idx)}
                                          </span>
                                          {option}
                                      </button>
                                  ))}
                              </div>
                          </>
                      ) : (
                          <div className="text-center animate-fade-in">
                              <div className="inline-block p-6 rounded-full bg-indigo-50 mb-4">
                                  <span className="text-4xl font-black text-indigo-600">{quizScore.toFixed(1)}</span>
                                  <span className="text-gray-400 text-lg">/10</span>
                              </div>
                              <h3 className="text-2xl font-bold text-gray-900 mb-2">Kết Quả Bài Thi</h3>
                              <p className="text-gray-500 mb-8">Bạn đã trả lời đúng {Object.keys(userAnswers).filter(k => userAnswers[parseInt(k)] === quizQuestions[parseInt(k)].correctAnswer).length} / {quizQuestions.length} câu.</p>
                              
                              <div className="space-y-6 text-left">
                                  {quizQuestions.map((q, idx) => {
                                      const isCorrect = userAnswers[idx] === q.correctAnswer;
                                      return (
                                          <div key={idx} className={`p-4 rounded-xl border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                              <p className="font-semibold text-gray-800 mb-2">Câu {idx + 1}: {q.question}</p>
                                              <div className="flex flex-col gap-1 text-sm">
                                                  <div className="flex items-center gap-2">
                                                      {isCorrect ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <XCircleIcon className="w-4 h-4 text-red-600" />}
                                                      <span className={isCorrect ? "text-green-700" : "text-red-700"}>Bạn chọn: {userAnswers[idx] || "Không trả lời"}</span>
                                                  </div>
                                                  {!isCorrect && (
                                                      <div className="flex items-center gap-2 text-green-700 font-medium">
                                                          <CheckCircleIcon className="w-4 h-4" />
                                                          <span>Đáp án đúng: {q.correctAnswer}</span>
                                                      </div>
                                                  )}
                                                  <p className="text-gray-500 text-xs mt-1 italic">{q.explanation}</p>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      )}
                  </div>
                  
                  <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-between items-center">
                      {!quizSubmitted ? (
                          <>
                            <button 
                                onClick={handlePrevQuestion}
                                disabled={currentQuestionIndex === 0}
                                className="px-6 py-2 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-50 font-medium transition-colors"
                            >
                                Quay lại
                            </button>
                            {currentQuestionIndex < quizQuestions.length - 1 ? (
                                <button 
                                    onClick={handleNextQuestion}
                                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
                                >
                                    Câu tiếp theo
                                </button>
                            ) : (
                                <button 
                                    onClick={handleSubmitQuiz}
                                    className="px-8 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-95"
                                >
                                    Nộp Bài
                                </button>
                            )}
                          </>
                      ) : (
                          <button 
                              onClick={() => { setIsQuizMode(false); setQuizQuestions([]); }}
                              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all"
                          >
                              Quay Về Trang Chủ
                          </button>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-12 relative">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BookOpenIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">VocaStory AI</h1>
          </div>
          <button onClick={handleClearHistory} className="text-gray-400 hover:text-red-500 transition-colors">
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:block">
            <button 
              onClick={handleToggleDirection}
              className="bg-white p-2 rounded-full shadow-lg border border-gray-100 text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <ArrowsRightLeftIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full relative" ref={searchContainerRef}>
            <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                    <LanguageIcon className="w-4 h-4" />
                    {direction === 'vi_en' ? 'Tiếng Việt' : 'Tiếng Anh'}
                </label>
                <button onClick={handleToggleDirection} className="md:hidden bg-gray-100 p-1.5 rounded-full text-indigo-600">
                    <ArrowsRightLeftIcon className="w-4 h-4" />
                </button>
            </div>
            <div className="relative flex-grow">
                <textarea
                  className="w-full h-full p-4 bg-gray-50 rounded-xl border-transparent focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all resize-none text-lg outline-none"
                  placeholder={direction === 'vi_en' ? "Nhập tiếng Việt..." : "Enter English text..."}
                  rows={5}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) handleTranslate();
                  }}
                />
                
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto animate-fade-in">
                      {suggestions.map((suggestion, idx) => (
                          <div 
                             key={idx}
                             onClick={() => handleDropdownSelect(suggestion)}
                             className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-none flex justify-between items-center"
                          >
                             <div className="flex flex-col">
                                <span className="font-bold text-gray-800">{suggestion.word}</span>
                                <span className="text-xs text-gray-500">{suggestion.meaning}</span>
                             </div>
                             <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase">
                                {suggestion.type}
                             </span>
                          </div>
                      ))}
                  </div>
                )}
            </div>
            
            <div className="mt-3 overflow-x-auto pb-1 scrollbar-hide">
               <div className="flex gap-2">
                 {QUICK_SUGGESTIONS[direction].map((suggestion, idx) => (
                   <button
                     key={idx}
                     onClick={() => handleSuggestionClick(suggestion)}
                     className="whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 rounded-full text-xs font-medium transition-colors border border-gray-200"
                   >
                     {suggestion}
                   </button>
                 ))}
               </div>
            </div>

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
                  <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Đang dịch...</>
                ) : (
                  direction === 'vi_en' ? 'Dịch sang Anh' : 'Dịch sang Việt'
                )}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full relative overflow-hidden">
            <label className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-indigo-500" />
              {direction === 'vi_en' ? 'Tiếng Anh' : 'Tiếng Việt'}
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
                        onClick={() => {
                            const textToRead = direction === 'vi_en' ? translatedResult.english : inputText;
                            handleAudioToggle('translate_res', textToRead);
                        }}
                        disabled={isLoadingAudio && activeAudioId === 'translate_res'}
                        className={`p-2 rounded-full transition-all shadow-sm ${activeAudioId === 'translate_res' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-100'}`}
                      >
                         {activeAudioId === 'translate_res' && !isPaused ? <PauseIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
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

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Kho Từ Vựng Của Bạn</h2>
            <div className="flex gap-3 items-center">
                <button 
                    onClick={handleStartQuiz}
                    disabled={isLoadingQuiz || history.length < 5}
                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoadingQuiz ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />}
                    Tạo Bài Kiểm Tra
                </button>
                <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded-md">{history.length} từ</span>
            </div>
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
                      >
                        <button 
                          onClick={(e) => handleDeleteWord(item.id, e)}
                          className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-red-200 hover:bg-red-200 z-10"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-indigo-700 truncate mr-2 flex items-center gap-1">
                            {item.english}
                            {activeAudioId === item.id && !isPaused ? <PauseIcon className="w-3 h-3 text-indigo-500" /> : <SpeakerWaveIcon className="w-3 h-3 text-indigo-300 opacity-0 group-hover:opacity-100" />}
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

        <section className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5"></div>
          <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 rounded-full bg-white opacity-5"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <BookOpenIcon className="w-6 h-6" />
                  Ôn Tập Qua Truyện
                </h2>
                <p className="text-indigo-200 text-sm">Hệ thống tạo truyện/hội thoại song ngữ mỗi 10 tiếng.</p>
              </div>

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
                  <div className={`h-2 rounded-full transition-all duration-1000 ${isReadyForStory ? 'bg-green-400' : 'bg-indigo-400'}`} style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>

              <div className="flex gap-2 p-1 bg-white/10 rounded-xl">
                 <button onClick={() => setStoryType('story')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${storyType === 'story' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'}`}>📖 Truyện Ngắn</button>
                 <button onClick={() => setStoryType('dialogue')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${storyType === 'dialogue' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 hover:text-white'}`}>💬 Hội Thoại</button>
              </div>

              <div className="space-y-3">
                <input 
                  type="text" 
                  value={storyTheme}
                  onChange={(e) => setStoryTheme(e.target.value)}
                  placeholder="Chủ đề (VD: Adventure)..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
                
                <div className="flex flex-wrap gap-2">
                   {SUGGESTED_THEMES.map(theme => (
                     <button key={theme} onClick={() => setStoryTheme(theme)} className="text-[10px] sm:text-xs bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-400/30 text-indigo-100 px-2 py-1 rounded-full transition-colors">{theme}</button>
                   ))}
                </div>

                <button
                  onClick={() => handleGenerateStory(true)} 
                  disabled={isLoadingStory || history.length < 2}
                  className="w-full py-3 bg-white text-indigo-900 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-4"
                >
                  {isLoadingStory ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                  {isReadyForStory ? 'Tạo Nội Dung Ngay' : 'Tạo Ngay (Bỏ qua chờ)'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-white/10 p-6 max-h-[700px] overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {stories.length > 0 ? (
                <div className="space-y-8">
                  {stories.map((story, index) => (
                    <div key={story.id} className="animate-fade-in group">
                      <div className="flex flex-wrap items-center justify-between mb-4 border-b border-white/10 pb-2 gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-indigo-300 bg-indigo-900/50 px-2 py-1 rounded">{story.theme}</span>
                            <span className="text-xs text-indigo-300">{new Date(story.timestamp).toLocaleDateString()}</span>
                            {story.generationTimeMs && (
                              <span className="text-xs text-indigo-300 flex items-center gap-1 border-l border-white/20 pl-2">⚡ {(story.generationTimeMs / 1000).toFixed(1)}s</span>
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
                            >
                              {activeAudioId === story.id ? (isLoadingAudio ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : (isPaused ? <SpeakerWaveIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />)) : <SpeakerWaveIcon className="w-4 h-4" />}
                            </button>
                          </div>
                          <button onClick={() => toggleVietnamese(story.id)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1.5 rounded text-indigo-100 transition-colors flex items-center gap-1 h-[34px]"><LanguageIcon className="w-3.5 h-3.5" /> {showVietnamese[story.id] ? 'Ẩn' : 'Dịch'}</button>
                          <button onClick={() => handleDeleteStory(story.id)} className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-200 px-2 py-1.5 rounded transition-colors h-[34px]"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      
                      <div className="prose prose-invert prose-lg max-w-none text-indigo-50 mb-6">
                         <InteractiveStoryText content={story.content} storyId={story.id} />
                      </div>

                      {showVietnamese[story.id] && (
                        <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-500/20 animate-fade-in mb-6">
                          <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2">Bản dịch tiếng việt</h4>
                          <p className="text-indigo-200 text-sm leading-relaxed whitespace-pre-line">{story.vietnameseContent}</p>
                        </div>
                      )}
                      
                      {story.grammarPoints && story.grammarPoints.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                           {!showGrammar[story.id] ? (
                             <button onClick={() => toggleGrammar(story.id)} className="w-full flex items-center justify-center gap-2 py-3 bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 rounded-xl border border-teal-500/20 transition-all font-semibold text-sm"><AcademicCapIcon className="w-5 h-5" /> 🔍 Xem Phân Tích Ngữ Pháp</button>
                           ) : (
                             <div className="animate-fade-in bg-teal-950/30 rounded-xl p-1 border border-teal-500/20">
                                <button onClick={() => toggleGrammar(story.id)} className="w-full text-center py-2 text-xs text-teal-500/70 hover:text-teal-400 mb-2 uppercase tracking-wide font-bold">Ẩn phân tích</button>
                                <div className="px-4 pb-4 grid grid-cols-1 gap-4">
                                  {story.grammarPoints.map((point, gIndex) => (
                                    <div key={gIndex} className="bg-teal-900/40 rounded-xl p-4 border border-teal-500/20 hover:bg-teal-900/60 transition-colors">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1">
                                        <h5 className="font-bold text-teal-200 text-sm">{point.structure}</h5>
                                        <span className="text-[10px] bg-teal-500/10 text-teal-300 px-2 py-0.5 rounded border border-teal-500/10">Cấu trúc</span>
                                      </div>
                                      <p className="text-xs text-gray-300 mb-3 leading-relaxed">{point.explanation}</p>
                                      <div className="space-y-2">
                                          <div className="bg-black/20 rounded-lg px-3 py-2 border-l-2 border-teal-500/50"><p className="text-xs italic text-teal-100">"{point.exampleInStory}"</p></div>
                                          <div className="flex items-start gap-1.5 text-xs text-green-300/90"><span className="mt-0.5">💡</span><span>{point.memoryTip}</span></div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                             </div>
                           )}
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
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {selectedWord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-100 p-6 pointer-events-auto mb-4 sm:mb-0 animate-fade-in">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {selectedWord.word}
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-mono">{selectedWord.phonetic}</span>
                </h3>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mt-1">{selectedWord.type}</p>
              </div>
              <button onClick={() => setSelectedWord(null)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <p className="text-gray-700 text-base">{selectedWord.meaning}</p>
              {selectedWord.example && <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-600 italic">"{selectedWord.example}"</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
