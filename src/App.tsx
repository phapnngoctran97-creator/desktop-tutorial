
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
  XCircleIcon,
  ChevronDownIcon,
  PencilSquareIcon
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
  
  // Cloze Test State (Fill in the blank)
  const [clozeStoryId, setClozeStoryId] = useState<string | null>(null);
  const [clozeHiddenIndices, setClozeHiddenIndices] = useState<number[]>([]);
  const [userClozeInputs, setUserClozeInputs] = useState<Record<number, string>>({});
  const [clozeSubmitted, setClozeSubmitted] = useState<boolean>(false);

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
  
  // Text Selection State
  const [selectionPopup, setSelectionPopup] = useState<{ x: number, y: number, text: string } | null>(null);

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

  const groupedStories = useMemo(() => {
    const groupList: { dateLabel: string; items: GeneratedStory[] }[] = [];
    const sortedStories = [...stories].sort((a, b) => b.timestamp - a.timestamp);

    sortedStories.forEach(item => {
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
  }, [stories]);

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
      
      // Hide selection popup if clicking elsewhere
      if (selectionPopup && !(event.target as HTMLElement).closest('.selection-popup')) {
          setSelectionPopup(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectionPopup]);

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
      
      let englishText = "";
      let vietnameseText = "";

      if (direction === 'vi_en') {
        englishText = result.english.trim();
        vietnameseText = text.trim();
      } else {
        englishText = text.trim();
        vietnameseText = result.english.trim();
      }
      
      setTranslatedResult({ ...result, sourceEnglish: englishText });

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
    if (clozeStoryId === id) handleExitClozeTest();
  };

  const handleWordClick = async (word: string, context: string, event: React.MouseEvent | null) => {
    if (event) event.stopPropagation();
    
    // Normalize text
    const cleanWord = word.trim();
    if (!cleanWord) return;

    if (lookupCache[cleanWord.toLowerCase()]) {
      setSelectedWord(lookupCache[cleanWord.toLowerCase()]);
      setSelectionPopup(null);
      return;
    }

    setIsLookingUp(true);
    setSelectionPopup(null);
    // Provide an immediate UI feedback
    setSelectedWord({ word: cleanWord, phonetic: '...', type: '...', meaning: 'Đang tra cứu...', example: '' });

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

  const handleSelectionLookup = (e: React.MouseEvent | React.TouchEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
        const text = selection.toString().trim();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setSelectionPopup({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
            text: text
        });
    } else {
        setSelectionPopup(null);
    }
  };

  const toggleVietnamese = (storyId: string) => setShowVietnamese(prev => ({ ...prev, [storyId]: !prev[storyId] }));
  const toggleGrammar = (storyId: string) => setShowGrammar(prev => ({ ...prev, [storyId]: !prev[storyId] }));

  // --- CLOZE TEST FUNCTIONS ---
  const handleStartClozeTest = (storyId: string, content: string) => {
      // Basic text parsing to find words
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const plainText = tempDiv.textContent || "";
      const words = plainText.split(/(\s+)/);
      
      const wordIndices: number[] = [];
      words.forEach((w, i) => {
          // Filter only actual words (longer than 2 chars, not just punctuation)
          if (w.trim().length > 2 && /^[a-zA-Z]+$/.test(w.replace(/[.,!?;:]/g, ''))) {
              wordIndices.push(i);
          }
      });

      // Randomly select 20% of words to hide
      const numToHide = Math.max(1, Math.floor(wordIndices.length * 0.2));
      const shuffled = wordIndices.sort(() => 0.5 - Math.random());
      const selectedIndices = shuffled.slice(0, numToHide);

      setClozeHiddenIndices(selectedIndices);
      setClozeStoryId(storyId);
      setUserClozeInputs({});
      setClozeSubmitted(false);
      
      // Stop audio if playing
      stopAllAudio();
  };

  const handleClozeInputChange = (index: number, value: string) => {
      setUserClozeInputs(prev => ({ ...prev, [index]: value }));
  };

  const handleSubmitCloze = () => {
      setClozeSubmitted(true);
  };

  const handleExitClozeTest = () => {
      setClozeStoryId(null);
      setClozeHiddenIndices([]);
      setUserClozeInputs({});
      setClozeSubmitted(false);
  };

  const base64ToBytes = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

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

            // Simple visual feedback for Native TTS
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                     // Estimate word index based on char index - rough approximation for Native TTS
                     const charIndex = event.charIndex;
                     const textBefore = cleanText.substring(0, charIndex);
                     const wordIdx = textBefore.trim().split(/\s+/).length;
                     setHighlightedWordIndex(wordIdx);
                }
            };
            utterance.onstart = () => setIsPaused(false);
            utterance.onend = () => {
                setIsPaused(false);
                setActiveAudioId(null);
                setHighlightedWordIndex(-1);
            };
            
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error("Native TTS failed", e);
            stopAllAudio();
        } finally {
            setIsLoadingAudio(false);
        }
    };

    if (!forceGemini) {
        playNativeTTS(text);
        return;
    }

    try {
        if (!audioContextRef.current) {
             audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
             await audioContextRef.current.resume();
        }

        const audioData = await generateSpeech(text, selectedVoice, isDialogue);
        
        if (!audioData) {
            console.warn("Gemini Audio failed, falling back to Native TTS");
            playNativeTTS(text);
            return;
        }

        const audioBuffer = decodePCMData(base64ToBytes(audioData), audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        
        // Handle playback speed
        source.playbackRate.value = playbackSpeed;

        source.onended = () => {
            if (!isPaused) {
                setActiveAudioId(null);
                setHighlightedWordIndex(-1);
            }
        };

        audioSourceRef.current = source;
        source.start(0);
        
        audioStartTimeRef.current = audioContextRef.current.currentTime;
        audioDurationRef.current = audioBuffer.duration / playbackSpeed;

        // Visual Karaoke loop
        const animate = () => {
            if (activeAudioId === id && audioContextRef.current && !isPaused) {
                const elapsed = (audioContextRef.current.currentTime - audioStartTimeRef.current) * playbackSpeed;
                const progress = Math.min(elapsed / audioDurationRef.current, 1);
                setAudioProgress(progress);

                // Word highlighting estimation
                const plainText = text.replace(/<\/?[^>]+(>|$)/g, " ").replace(/\s+/g, " ").trim();
                const words = plainText.split(" ");
                const estimatedIndex = Math.floor(progress * words.length);
                setHighlightedWordIndex(estimatedIndex);

                rafRef.current = requestAnimationFrame(animate);
            }
        };
        rafRef.current = requestAnimationFrame(animate);

    } catch (error) {
        console.error("Audio Playback Error:", error);
        playNativeTTS(text); // Ultimate fallback
    } finally {
        setIsLoadingAudio(false);
    }
  };

  // --- Quiz Logic ---
  const handleStartQuiz = async () => {
    if (history.length < 5) {
        alert("Bạn cần ít nhất 5 từ vựng trong lịch sử để tạo bài kiểm tra!");
        return;
    }
    setIsQuizMode(true);
    setIsLoadingQuiz(true);
    setQuizSubmitted(false);
    setUserAnswers({});
    setQuizScore(0);
    
    // Pick random words
    const shuffled = [...history].sort(() => 0.5 - Math.random());
    const selectedWords = shuffled.slice(0, 15).map(i => i.english);

    try {
        const questions = await generateQuizFromWords(selectedWords);
        setQuizQuestions(questions);
    } catch (error) {
        alert("Không thể tạo bài kiểm tra. Vui lòng thử lại.");
        setIsQuizMode(false);
    } finally {
        setIsLoadingQuiz(false);
    }
  };

  const handleQuizAnswer = (questionId: number, answer: string) => {
      if (quizSubmitted) return;
      setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitQuiz = () => {
      let correctCount = 0;
      quizQuestions.forEach(q => {
          if (userAnswers[q.id] === q.correctAnswer) correctCount++;
      });
      const score = Math.round((correctCount / quizQuestions.length) * 10);
      setQuizScore(score);
      setQuizSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExitQuiz = () => {
      setIsQuizMode(false);
      setQuizQuestions([]);
      setUserAnswers({});
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-7 h-7 text-blue-600" />
            <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 truncate">VocaStory AI</h1>
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-200">
            <ClockIcon className="w-4 h-4" />
            <span>{Math.round(progressPercent)}% năng lượng</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        
        {/* Quiz Mode View */}
        {isQuizMode ? (
            <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in border border-gray-100">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <ClipboardDocumentCheckIcon className="w-6 h-6 text-blue-500" />
                        Kiểm Tra Từ Vựng
                    </h2>
                    <button onClick={handleExitQuiz} className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {isLoadingQuiz ? (
                    <div className="py-20 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">AI đang soạn đề thi từ vựng cho bạn...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {quizSubmitted && (
                            <div className={`p-4 rounded-xl text-center border ${quizScore >= 8 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                                <p className="text-2xl font-bold mb-1">{quizScore}/10</p>
                                <p className="text-sm">{quizScore >= 8 ? "Xuất sắc! Bạn nắm rất chắc bài." : "Cần ôn tập thêm một chút nhé!"}</p>
                            </div>
                        )}

                        {quizQuestions.map((q, index) => (
                            <div key={q.id} className="bg-gray-50 p-4 md:p-6 rounded-xl border border-gray-100">
                                <p className="font-semibold text-gray-800 mb-4 text-base md:text-lg">
                                    <span className="text-blue-600 font-bold mr-2">Câu {index + 1}:</span> 
                                    {q.question}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {q.options.map((opt) => {
                                        let btnClass = "p-3 md:p-4 rounded-lg border text-left transition-all text-sm md:text-base ";
                                        if (quizSubmitted) {
                                            if (opt === q.correctAnswer) btnClass += "bg-green-100 border-green-500 text-green-700 font-medium ";
                                            else if (userAnswers[q.id] === opt) btnClass += "bg-red-100 border-red-500 text-red-700 ";
                                            else btnClass += "border-gray-200 opacity-50 bg-white ";
                                        } else {
                                            btnClass += userAnswers[q.id] === opt ? "bg-blue-100 border-blue-500 text-blue-700 font-medium shadow-sm" : "bg-white border-gray-200 hover:bg-gray-100 hover:border-blue-300";
                                        }

                                        return (
                                            <button 
                                                key={opt}
                                                disabled={quizSubmitted}
                                                onClick={() => handleQuizAnswer(q.id, opt)}
                                                className={btnClass}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                                {quizSubmitted && (
                                    <div className={`mt-4 p-4 rounded-xl border text-sm ${userAnswers[q.id] === q.correctAnswer ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-gray-800'}`}>
                                        {/* Show correct answer if wrong */}
                                        {userAnswers[q.id] !== q.correctAnswer && (
                                            <div className="mb-2 font-bold text-red-600 flex flex-wrap items-center gap-2 pb-2 border-b border-red-200/50">
                                                <XCircleIcon className="w-5 h-5 shrink-0" />
                                                <span>Bạn chọn: {userAnswers[q.id] || "Chưa chọn"}</span>
                                                <span className="text-gray-400 mx-1">➜</span> 
                                                <span className="text-green-600 flex items-center gap-1">
                                                    <CheckCircleIcon className="w-5 h-5" /> 
                                                    Đáp án đúng: {q.correctAnswer}
                                                </span>
                                            </div>
                                        )}
                                        
                                        <div className="mt-2">
                                            <span className="font-bold mr-1">💡 Giải thích:</span> {q.explanation}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {!quizSubmitted && (
                            <div className="pt-4">
                                <button 
                                    onClick={handleSubmitQuiz}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all active:scale-[0.99]"
                                >
                                    Nộp Bài
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        ) : (
        <>
            {/* Translation Section */}
            <section className="bg-white rounded-2xl shadow-lg p-5 md:p-8 border border-gray-100 relative z-20" ref={searchContainerRef}>
                {/* Language Toggle Header */}
                <div className="flex items-center justify-between mb-4 bg-gray-50 rounded-xl p-2 border border-gray-100">
                    <div className={`flex-1 text-center py-2 rounded-lg text-sm font-semibold transition-colors ${direction === 'en_vi' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-400'}`}>
                        🇺🇸 Tiếng Anh
                    </div>
                    
                    <button 
                        onClick={handleToggleDirection}
                        className="mx-2 p-2 rounded-full bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 shadow-sm active:rotate-180 transition-all duration-300"
                        title="Đổi chiều dịch"
                    >
                        <ArrowsRightLeftIcon className="w-5 h-5" />
                    </button>

                    <div className={`flex-1 text-center py-2 rounded-lg text-sm font-semibold transition-colors ${direction === 'vi_en' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-400'}`}>
                        🇻🇳 Tiếng Việt
                    </div>
                </div>
            
                <div className="relative">
                    <div className="flex flex-col gap-4">
                        {/* Input Area */}
                        <div className="relative group">
                            <textarea
                                className="w-full p-4 md:p-5 pr-12 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all text-lg md:text-xl resize-none min-h-[120px] shadow-sm placeholder:text-gray-300"
                                placeholder={direction === 'vi_en' ? "Nhập văn bản tiếng Việt..." : "Type English text here..."}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleTranslate();
                                    }
                                }}
                            />
                            {inputText && (
                                <button 
                                    onClick={() => { setInputText(''); setSuggestions([]); }}
                                    className="absolute right-3 top-3 text-gray-300 hover:text-gray-500 p-1 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            )}
                            
                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black/5">
                                    {suggestions.map((item, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => handleDropdownSelect(item)}
                                            className="p-3 md:p-4 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center group transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="font-medium text-gray-800 text-base md:text-lg">{item.word}</span>
                                                <span className="text-[10px] md:text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 uppercase">{item.type}</span>
                                            </div>
                                            <span className="text-sm text-gray-500 group-hover:text-indigo-600 font-medium">{item.meaning}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Quick Suggestions */}
                            <div className="flex flex-wrap gap-2 order-2 md:order-1">
                                {QUICK_SUGGESTIONS[direction].slice(0, 3).map((text, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => handleSuggestionClick(text)}
                                        className="text-xs bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 px-3 py-1.5 rounded-full transition-colors border border-gray-200 hover:border-indigo-200 truncate max-w-[200px]"
                                    >
                                        {text}
                                    </button>
                                ))}
                            </div>

                            {/* Translate Button */}
                            <button
                                className="order-1 md:order-2 bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-base hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] w-full md:w-auto min-w-[140px]"
                                onClick={handleTranslate}
                                disabled={isLoadingTranslate || !inputText.trim()}
                            >
                                {isLoadingTranslate ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Đang dịch...</span>
                                    </>
                                ) : (
                                    <>
                                        <LanguageIcon className="w-5 h-5" />
                                        <span>Dịch ngay</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Translation Result Card */}
                {translatedResult && (
                    <div className="mt-8 p-6 md:p-8 bg-indigo-50 rounded-2xl border border-indigo-100 animate-fade-in relative group transition-all">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                            <div className="flex-1">
                                <div className="flex items-baseline flex-wrap gap-3">
                                    <h3 className="text-3xl md:text-4xl font-bold text-gray-800 tracking-tight">{translatedResult.english}</h3>
                                    <span className="text-base font-mono text-gray-500 bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-sm">
                                        /{translatedResult.phonetic}/
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="text-xs font-bold text-indigo-600 bg-white px-2 py-1 rounded border border-indigo-100 uppercase tracking-wider">
                                        {translatedResult.partOfSpeech}
                                    </span>
                                </div>
                                {/* Verb Tenses Display */}
                                {translatedResult.tenses && (translatedResult.tenses.past || translatedResult.tenses.present || translatedResult.tenses.future) && (
                                    <div className="mt-4 bg-white/60 p-3 rounded-xl border border-indigo-100/50">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Các thì cơ bản</p>
                                        <div className="flex flex-wrap gap-2 text-sm">
                                            {translatedResult.tenses.past && (
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                                    <span className="text-[10px] font-bold text-gray-400">PAST</span>
                                                    <span className="font-medium">{translatedResult.tenses.past}</span>
                                                </div>
                                            )}
                                            {translatedResult.tenses.present && (
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                                    <span className="text-[10px] font-bold text-gray-400">PRESENT</span>
                                                    <span className="font-medium">{translatedResult.tenses.present}</span>
                                                </div>
                                            )}
                                            {translatedResult.tenses.future && (
                                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                                    <span className="text-[10px] font-bold text-gray-400">FUTURE</span>
                                                    <span className="font-medium">{translatedResult.tenses.future}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Audio Controls */}
                            <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 px-2">
                                     <input 
                                        type="range" 
                                        min="0.7" 
                                        max="1.3" 
                                        step="0.1"
                                        value={playbackSpeed}
                                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                                        className="w-16 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        title={`Tốc độ: ${playbackSpeed}x`}
                                     />
                                     <span className="text-[10px] w-6 text-center font-mono text-gray-500">{playbackSpeed}x</span>
                                </div>
                                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                                <button 
                                    onClick={() => handleAudioToggle('translate', translatedResult.sourceEnglish || translatedResult.english)}
                                    className={`p-2.5 rounded-full transition-colors ${
                                        activeAudioId === 'translate' 
                                        ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' 
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {activeAudioId === 'translate' && !isPaused ? <PauseIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        
                        <div className="text-gray-700 italic mt-6 border-t border-indigo-200/50 pt-4 flex items-start gap-3 bg-white/50 p-4 rounded-xl">
                            <SparklesIcon className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span className="flex-1 text-base leading-relaxed">{translatedResult.usageHint}</span>
                            <button
                                 onClick={() => handleAudioToggle('hint', translatedResult.usageHint)}
                                 className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                                     activeAudioId === 'hint' 
                                     ? 'bg-amber-100 text-amber-600' 
                                     : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                                 }`}
                                 title="Nghe ví dụ"
                             >
                                 {activeAudioId === 'hint' && !isPaused ? <PauseIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}
                             </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Vocabulary List */}
            <section className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
                <div className="flex items-center gap-2">
                    <div className="bg-orange-100 p-2 rounded-lg">
                        <ClockIcon className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-800 text-lg">Kho từ vựng</h2>
                        <p className="text-xs text-gray-500">{history.length} từ đã lưu</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                     <button 
                        onClick={handleStartQuiz}
                        className="flex-1 sm:flex-none text-sm flex items-center justify-center gap-2 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-xl transition-all font-medium"
                     >
                        <ClipboardDocumentCheckIcon className="w-4 h-4" />
                        Kiểm Tra
                    </button>
                    <button 
                        onClick={handleClearHistory}
                        className="flex-1 sm:flex-none text-sm flex items-center justify-center gap-2 text-red-600 bg-white hover:bg-red-50 border border-red-200 px-4 py-2 rounded-xl transition-all font-medium"
                    >
                        <TrashIcon className="w-4 h-4" />
                        Xóa tất cả
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {groupedHistory.map((group, groupIdx) => (
                    <DateAccordion 
                        key={group.dateLabel} 
                        title={group.dateLabel} 
                        count={group.items.length} 
                        defaultOpen={groupIdx === 0}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {group.items.map((item) => (
                                <div 
                                    key={item.id} 
                                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group relative active:scale-[0.98]"
                                    onClick={() => handleAudioToggle(item.id, item.english, false)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="pr-6">
                                            <p className="font-bold text-gray-800 text-lg">{item.english}</p>
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{item.vietnamese}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {item.partOfSpeech && (
                                                <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                    {item.partOfSpeech}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => handleDeleteWord(item.id, e)}
                                        className="absolute -top-2 -right-2 bg-white text-gray-400 border border-gray-200 hover:text-red-500 hover:border-red-200 p-1.5 rounded-full shadow-sm opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <XMarkIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </DateAccordion>
                ))}
                {history.length === 0 && (
                    <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                        <BookOpenIcon className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <p className="text-lg">Chưa có từ vựng nào.</p>
                        <p className="text-sm mt-1">Hãy tra cứu từ mới để bắt đầu xây dựng kho từ vựng!</p>
                    </div>
                )}
            </div>
            </section>

            {/* Stories Section */}
            <section className="mt-8">
            <div className="flex flex-col gap-6 mb-6">
                <div className="flex items-center gap-2">
                    <div className="bg-purple-100 p-2 rounded-lg">
                        <SparklesIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="font-bold text-gray-800 text-lg">Ôn tập qua truyện</h2>
                </div>
                
                {/* Story Controls Card */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                     <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex bg-gray-100 rounded-xl p-1 shrink-0">
                            <button
                                onClick={() => setStoryType('story')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    storyType === 'story' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Truyện ngắn
                            </button>
                            <button
                                onClick={() => setStoryType('dialogue')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    storyType === 'dialogue' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Hội thoại
                            </button>
                        </div>
                        <div className="flex-1 flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Nhập chủ đề tùy chọn..."
                                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300 transition-all"
                                value={storyTheme}
                                onChange={(e) => setStoryTheme(e.target.value)}
                            />
                             <button
                                className="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                                onClick={() => handleGenerateStory(true)}
                                disabled={isLoadingStory || history.length < 5}
                            >
                                {isLoadingStory ? "Đang viết..." : "Tạo mới"}
                            </button>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                         <span className="text-xs font-bold text-gray-400 uppercase tracking-wide mr-1">Gợi ý:</span>
                         {SUGGESTED_THEMES.map(theme => (
                             <button
                                key={theme}
                                onClick={() => setStoryTheme(theme)}
                                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    storyTheme === theme 
                                    ? 'bg-purple-50 border-purple-200 text-purple-700' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-purple-200 hover:text-purple-600'
                                }`}
                             >
                                 {theme}
                             </button>
                         ))}
                     </div>
                </div>
            </div>

            <div className="space-y-4">
                {groupedStories.map((group, groupIdx) => (
                    <DateAccordion
                        key={group.dateLabel}
                        title={group.dateLabel}
                        count={group.items.length}
                        defaultOpen={groupIdx === 0}
                    >
                        <div className="space-y-8">
                            {group.items.map((story) => (
                                <article key={story.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden group">
                                    <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                                <BookOpenIcon className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 text-base">{story.theme}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                    <span>{new Date(story.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {story.generationTimeMs && (
                                                        <span className="flex items-center gap-0.5 bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100">
                                                            ⚡ {(story.generationTimeMs / 1000).toFixed(1)}s
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                            {/* Cloze Test Button */}
                                            {clozeStoryId !== story.id && (
                                                <button
                                                    onClick={() => handleStartClozeTest(story.id, story.content)}
                                                    className="p-2 bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm"
                                                    title="Luyện nghe điền từ"
                                                >
                                                    <PencilSquareIcon className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Kiểm tra</span>
                                                </button>
                                            )}

                                            {/* Voice Selector */}
                                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                                <select 
                                                    value={selectedVoice}
                                                    onChange={(e) => setSelectedVoice(e.target.value)}
                                                    className="text-xs font-medium bg-transparent border-none focus:ring-0 text-gray-600 cursor-pointer outline-none"
                                                >
                                                    {VOICE_OPTIONS.map(v => (
                                                        <option key={v.id} value={v.id}>{v.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {/* Audio Controls */}
                                            <button 
                                                onClick={() => handleAudioToggle(story.id, story.content, true, story.theme.includes('Hội thoại'))}
                                                className={`p-2 rounded-full transition-all flex items-center justify-center gap-2 ${
                                                    activeAudioId === story.id 
                                                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-200' 
                                                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-purple-600'
                                                }`}
                                            >
                                                {activeAudioId === story.id && !isPaused ? <PauseIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                                            </button>
                                            
                                            <button onClick={() => handleDeleteStory(story.id)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="p-5 md:p-8">
                                        {/* Cloze Test Controls (Visible only when active) */}
                                        {clozeStoryId === story.id && (
                                            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-4 animate-fade-in">
                                                <div className="text-sm text-indigo-800 font-medium flex items-center gap-2">
                                                    <PencilSquareIcon className="w-5 h-5" />
                                                    Chế độ luyện nghe điền từ
                                                </div>
                                                <div className="flex gap-2">
                                                    {!clozeSubmitted ? (
                                                        <button 
                                                            onClick={handleSubmitCloze}
                                                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm"
                                                        >
                                                            Nộp bài
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleStartClozeTest(story.id, story.content)}
                                                            className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 text-sm font-bold rounded-lg hover:bg-indigo-50"
                                                        >
                                                            Làm lại
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={handleExitClozeTest}
                                                        className="px-4 py-2 bg-white text-gray-600 border border-gray-200 text-sm font-bold rounded-lg hover:bg-gray-50"
                                                    >
                                                        Thoát
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Interactive Story Content */}
                                        <div 
                                            className="prose prose-lg max-w-none mb-8 relative"
                                            onMouseUp={handleSelectionLookup}
                                            onTouchEnd={handleSelectionLookup}
                                        >
                                            <div className="text-gray-800 leading-relaxed font-serif text-lg tracking-wide whitespace-pre-line selection:bg-purple-100 selection:text-purple-900">
                                                <InteractiveStoryText 
                                                    htmlContent={story.content} 
                                                    onWordClick={(word) => handleWordClick(word, story.content, null)}
                                                    highlightIndex={activeAudioId === story.id ? highlightedWordIndex : -1}
                                                    isClozeMode={clozeStoryId === story.id}
                                                    hiddenIndices={clozeHiddenIndices}
                                                    userInputs={userClozeInputs}
                                                    onInputChange={handleClozeInputChange}
                                                    isSubmitted={clozeSubmitted}
                                                />
                                            </div>
                                            
                                            {/* Floating Lookup Button */}
                                            {selectionPopup && (
                                                <div 
                                                    className="selection-popup fixed z-50 transform -translate-x-1/2 -translate-y-full mb-3"
                                                    style={{ left: selectionPopup.x, top: selectionPopup.y }}
                                                >
                                                    <button
                                                        onClick={() => handleWordClick(selectionPopup.text, story.content, null)}
                                                        className="bg-gray-900/90 backdrop-blur text-white text-xs px-4 py-2 rounded-full shadow-xl flex items-center gap-2 hover:bg-black transition-all animate-bounce-in"
                                                    >
                                                        <BookOpenIcon className="w-3 h-3" />
                                                        Tra cứu nhanh
                                                    </button>
                                                    <div className="w-2 h-2 bg-gray-900/90 rotate-45 absolute left-1/2 -bottom-1 -translate-x-1/2"></div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Controls Bar */}
                                        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-6">
                                            <button 
                                                onClick={() => toggleVietnamese(story.id)}
                                                className={`text-sm px-4 py-2.5 rounded-xl font-medium transition-colors ${
                                                    showVietnamese[story.id] 
                                                    ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                                                }`}
                                            >
                                                {showVietnamese[story.id] ? "Ẩn dịch nghĩa" : "Xem dịch nghĩa"}
                                            </button>

                                            <button 
                                                onClick={() => toggleGrammar(story.id)}
                                                className={`text-sm px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                                                    showGrammar[story.id] 
                                                    ? 'bg-teal-50 text-teal-700 border border-teal-100' 
                                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                                                }`}
                                            >
                                                <AcademicCapIcon className="w-4 h-4" />
                                                {showGrammar[story.id] ? "Ẩn ngữ pháp" : "Phân tích ngữ pháp"}
                                            </button>
                                        </div>

                                        {/* Vietnamese Translation */}
                                        {showVietnamese[story.id] && (
                                            <div className="mt-6 p-6 bg-blue-50/50 rounded-2xl text-gray-700 text-base leading-relaxed border border-blue-100 animate-fade-in">
                                                <h4 className="text-xs font-bold text-blue-500 uppercase mb-3 flex items-center gap-2">
                                                    <LanguageIcon className="w-4 h-4" />
                                                    Bản dịch tiếng Việt
                                                </h4>
                                                {story.vietnameseContent}
                                            </div>
                                        )}
                                        
                                        {/* Grammar Analysis */}
                                        {showGrammar[story.id] && (
                                            <div className="mt-6 p-6 bg-teal-50/50 rounded-2xl border border-teal-100 animate-fade-in">
                                                <h4 className="text-sm font-bold text-teal-800 uppercase mb-4 flex items-center gap-2">
                                                    <SparklesIcon className="w-4 h-4 text-teal-600" />
                                                    Góc Ngữ Pháp
                                                </h4>
                                                {story.grammarPoints && story.grammarPoints.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {story.grammarPoints.map((point, idx) => (
                                                            <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-teal-100/50 hover:shadow-md transition-shadow">
                                                                <p className="font-bold text-teal-700 text-sm mb-2 border-b border-gray-100 pb-2">{point.structure}</p>
                                                                <p className="text-gray-600 text-sm mb-3">{point.explanation}</p>
                                                                <div className="bg-gray-50 p-2.5 rounded-lg text-xs text-gray-500 italic border-l-4 border-teal-300 mb-2">
                                                                    "{point.exampleInStory}"
                                                                </div>
                                                                <p className="text-xs text-teal-600 font-medium flex items-center gap-1">
                                                                    💡 <span className="text-gray-500 font-normal">{point.memoryTip}</span>
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 italic text-center py-4">Dữ liệu ngữ pháp chưa có cho câu chuyện này.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </DateAccordion>
                ))}
            </div>
            </section>
        </>
        )}

      </main>

      {/* Word Definition Modal */}
      {selectedWord && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedWord(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-indigo-600 to-blue-600 px-6 py-5 flex justify-between items-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 opacity-50 pattern-grid"></div>
              <h3 className="text-2xl font-bold text-white capitalize relative z-10">{selectedWord.word}</h3>
              <button onClick={() => setSelectedWord(null)} className="text-white/80 hover:text-white bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition-colors relative z-10">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 md:p-8">
               {isLookingUp && selectedWord.meaning === 'Đang tra cứu...' ? (
                   <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                       <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                       <p className="font-medium">AI đang tra cứu...</p>
                   </div>
               ) : (
                   <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg text-sm border border-gray-200">/{selectedWord.phonetic}/</span>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg uppercase tracking-wide border border-indigo-100">{selectedWord.type}</span>
                        </div>
                        
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase mb-1.5">Định nghĩa</p>
                            <p className="text-gray-800 font-medium text-xl leading-relaxed">{selectedWord.meaning}</p>
                        </div>

                        {selectedWord.example && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <p className="text-amber-600 text-xs font-bold uppercase mb-1.5 flex items-center gap-1">
                                    <SparklesIcon className="w-3 h-3" /> Ví dụ
                                </p>
                                <p className="text-gray-700 italic text-base leading-relaxed">"{selectedWord.example}"</p>
                            </div>
                        )}
                        
                        <div className="pt-6 border-t border-gray-100 flex justify-end">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAudioToggle('lookup', selectedWord.word);
                                }}
                                className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-6 py-3 rounded-xl transition-colors shadow-sm"
                            >
                                <SpeakerWaveIcon className="w-5 h-5" />
                                Nghe phát âm
                            </button>
                        </div>
                   </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- New Component: Date Accordion ---
const DateAccordion: React.FC<{ title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, count, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white mb-4 shadow-sm hover:shadow-md transition-all">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-5 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left group"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-400 border border-gray-200'}`}>
                        <ClockIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">{title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5 font-medium">{count} mục</p>
                    </div>
                </div>
                <div className={`p-2 rounded-full hover:bg-white transition-all duration-300 ${isOpen ? 'rotate-180 text-indigo-600 bg-white shadow-sm' : 'text-gray-400'}`}>
                    <ChevronDownIcon className="w-5 h-5" />
                </div>
            </button>
            
            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 md:p-6 bg-white border-t border-gray-100">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Helper component for interactive text highlighting
const InteractiveStoryText: React.FC<{ 
    htmlContent: string; 
    onWordClick: (word: string) => void;
    highlightIndex: number;
    isClozeMode?: boolean;
    hiddenIndices?: number[];
    userInputs?: Record<number, string>;
    onInputChange?: (index: number, value: string) => void;
    isSubmitted?: boolean;
}> = React.memo(({ 
    htmlContent, 
    onWordClick, 
    highlightIndex, 
    isClozeMode = false, 
    hiddenIndices = [], 
    userInputs = {}, 
    onInputChange, 
    isSubmitted = false 
}) => {
    const createMarkup = () => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        let wordCounter = 0;

        const processNode = (node: Node): React.ReactNode => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || "";
                const parts = text.split(/(\s+)/);
                
                return parts.map((part, i) => {
                    if (part.trim().length === 0) return part; // Return spaces
                    
                    const currentIndex = wordCounter++;
                    const isHighlighted = currentIndex === highlightIndex;
                    
                    // Cloze Test Logic
                    if (isClozeMode && hiddenIndices.includes(currentIndex)) {
                        const cleanWord = part.replace(/[.,!?;:()"]/g, "");
                        const userInput = userInputs[currentIndex] || "";
                        const isCorrect = userInput.toLowerCase().trim() === cleanWord.toLowerCase().trim();

                        return (
                            <span key={`cloze-${i}`} className="inline-flex flex-col align-middle mx-1">
                                <input 
                                    type="text" 
                                    className={`w-20 sm:w-24 px-1 py-0.5 text-sm md:text-base border-b-2 bg-gray-50 focus:outline-none transition-colors text-center font-semibold rounded-t-sm ${
                                        isSubmitted 
                                            ? (isCorrect 
                                                ? "border-green-500 bg-green-50 text-green-700" 
                                                : "border-red-500 bg-red-50 text-red-700")
                                            : "border-indigo-300 focus:border-indigo-600 text-indigo-900"
                                    }`}
                                    value={userInput}
                                    onChange={(e) => onInputChange && onInputChange(currentIndex, e.target.value)}
                                    disabled={isSubmitted}
                                    autoComplete="off"
                                />
                                {isSubmitted && !isCorrect && (
                                    <span className="text-[10px] text-green-600 font-bold text-center animate-fade-in block mt-0.5">
                                        {cleanWord}
                                    </span>
                                )}
                            </span>
                        );
                    }

                    return (
                        <span 
                            key={i}
                            className={`cursor-pointer transition-all duration-300 rounded-sm px-0.5 mx-[-1px] border-b-2 border-transparent
                                ${isHighlighted 
                                    ? 'bg-yellow-300 text-yellow-900 shadow-sm scale-105 inline-block font-medium border-yellow-400 transform -translate-y-0.5' 
                                    : 'hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'}
                            `}
                            onClick={(e) => {
                                e.stopPropagation();
                                onWordClick(part.replace(/[.,!?;:()"]/g, ""));
                            }}
                        >
                            {part}
                        </span>
                    );
                });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                const tagName = element.tagName.toLowerCase();
                const children = Array.from(element.childNodes).map((child, i) => <React.Fragment key={i}>{processNode(child)}</React.Fragment>);
                
                if (tagName === 'b' || tagName === 'strong') {
                    return <strong className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 bg-indigo-50/50 rounded px-1 box-decoration-clone">{children}</strong>;
                }
                if (tagName === 'br') return <br />;
                if (tagName === 'p') return <p className="mb-6">{children}</p>;
                
                return <span>{children}</span>;
            }
            return null;
        };

        return Array.from(tempDiv.childNodes).map((node, i) => <React.Fragment key={i}>{processNode(node)}</React.Fragment>);
    };

    return <>{createMarkup()}</>;
});

export default App;
