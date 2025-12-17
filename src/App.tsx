
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HistoryItem, GeneratedStory, WordDefinition, TranslationResponse, WordSuggestion, QuizQuestion, GrammarPoint } from './types';
import { translateText, generateStoryFromWords, lookupWord, generateSpeech, getWordSuggestions, generateQuizFromWords } from './services/geminiService';
import { Mascot } from './components/Mascot';
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
  PencilSquareIcon,
  TrophyIcon,
  BoltIcon,
  MicrophoneIcon,
  Cog6ToothIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockClosedIcon,
  LightBulbIcon
} from './components/Icons';

// Constants
const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
const STORAGE_KEY_HISTORY = 'vocastory_history';
const STORAGE_KEY_STORY = 'vocastory_stories';
const STORAGE_KEY_LAST_GEN = 'vocastory_last_gen_time';
const STORAGE_KEY_API = 'VOCA_CUSTOM_API_KEY';

const SUGGESTED_THEMES = [
  "Cuộc sống hàng ngày",
  "Du lịch & Khám phá",
  "Công việc & Kinh doanh",
  "Tình bạn & Gia đình",
  "Khoa học & Công nghệ",
  "Phiêu lưu giả tưởng",
  "Đồ ăn & Ẩm thực",
  "Thể thao & Sức khỏe",
  "Nghệ thuật & Giải trí",
  "Thiên nhiên & Môi trường",
  "Lịch sử & Văn hóa"
];

const QUICK_SUGGESTIONS = {
  vi_en: [
    "Xin chào, bạn khỏe không?",
    "Cảm ơn rất nhiều",
    "Thời tiết hôm nay thế nào?",
    "Tôi đang học tiếng Anh",
    "Món ăn này rất ngon",
    "Cho tôi một ly cà phê",
    "Rất vui được gặp bạn",
    "Bạn có thể giúp tôi không?",
    "Hẹn gặp lại sau"
  ],
  en_vi: [
    "Hello, how are you?",
    "Thank you so much",
    "What is the weather like?",
    "I am learning Vietnamese",
    "This food is delicious",
    "Can I have a coffee?",
    "Nice to meet you",
    "Can you help me?",
    "See you later"
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
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Session Timer State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [onlineSeconds, setOnlineSeconds] = useState(0);
  const [showCongratulation, setShowCongratulation] = useState(false);
  
  // Energy System State
  const [energy, setEnergy] = useState(100);

  // Suggestion State
  const [suggestions, setSuggestions] = useState<WordSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null); // Ref for click outside
  const ignoreFetchRef = useRef<boolean>(false); // Ref to skip fetch on selection

  // New State for Bilingual & Lookup Features
  const [showVietnamese, setShowVietnamese] = useState<Record<string, boolean>>({});
  const [showGrammar, setShowGrammar] = useState<Record<string, boolean>>({});
  const [showLearningTips, setShowLearningTips] = useState<Record<string, boolean>>({});
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
  const [isListening, setIsListening] = useState(false);
  
  // Audio Cache
  const audioCacheRef = useRef<Record<string, string>>({}); // Key: id-voiceId, Value: base64 string

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

  // Session Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
        setCurrentTime(new Date());
        setOnlineSeconds(prev => {
            const newValue = prev + 1;
            if (newValue === 600) { // 10 minutes
                setShowCongratulation(true);
            }
            return newValue;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    const savedStories = localStorage.getItem(STORAGE_KEY_STORY);
    const savedTime = localStorage.getItem(STORAGE_KEY_LAST_GEN);
    const savedKey = localStorage.getItem(STORAGE_KEY_API);

    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedStories) setStories(JSON.parse(savedStories));
    if (savedTime) setLastGenTime(parseInt(savedTime, 10));
    if (savedKey) {
        setCustomApiKey(savedKey);
        setTempApiKey(savedKey);
    }

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
  
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
        return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = direction === 'vi_en' ? 'vi-VN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        setIsListening(true);
    };

    recognition.onend = () => {
        setIsListening(false);
    };

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        ignoreFetchRef.current = true; // avoid autocomplete trigger immediately
        setTimeout(() => triggerTranslate(transcript), 500);
    };

    recognition.onerror = (event: any) => {
        console.error("Voice input error", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
             alert("Vui lòng cấp quyền Microphone cho trang web để sử dụng tính năng này.");
        }
    };

    recognition.start();
  };

  const handleSaveApiKey = () => {
      const cleanedKey = tempApiKey.trim();
      if (!cleanedKey) {
          alert("Vui lòng nhập API Key hợp lệ.");
          return;
      }
      
      localStorage.setItem(STORAGE_KEY_API, cleanedKey);
      setCustomApiKey(cleanedKey);
      setTempApiKey(cleanedKey);
      setShowSettings(false);
      alert("Đã lưu API Key thành công! Ứng dụng sẽ ưu tiên sử dụng Key của bạn cho mọi tính năng.");
  };

  const performTranslation = async (text: string) => {
    if (!text.trim()) return;
    setIsLoadingTranslate(true);
    setSuggestions([]);
    setShowSuggestions(false);
    
    try {
      const result = await translateText(text, direction);
      setEnergy(prev => Math.max(0, prev - 2)); // Consume energy
      
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

      if (englishText && !result.english.startsWith("Error")) {
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
      // alert("Lỗi dịch thuật..."); // Removed generic alert in favor of inline error
      console.error(error);
    } finally {
      setIsLoadingTranslate(false);
    }
  };

  const triggerTranslate = (text: string) => performTranslation(text);
  const handleTranslate = useCallback(() => performTranslation(inputText), [inputText, direction]);

  const handleGenerateStory = useCallback(async (force: boolean = false) => {
    // API KEY CHECK
    if (!customApiKey) {
        alert("Để sử dụng tính năng Tạo Truyện, vui lòng nhập API Key của riêng bạn trong phần Cài đặt.");
        setShowSettings(true);
        return;
    }

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

    if (energy < 15) {
        alert("Bạn không đủ năng lượng để tạo truyện mới. Hãy nghỉ ngơi một chút!");
        return;
    }

    setIsLoadingStory(true);
    const startTime = Date.now();
    try {
      const wordList = targetWords.map(w => w.english);
      const result = await generateStoryFromWords(wordList, storyTheme, storyType);
      
      setEnergy(prev => Math.max(0, prev - 15)); // Consume energy

      const endTime = Date.now();
      const duration = endTime - startTime;

      const newStory: GeneratedStory = {
        id: Date.now().toString(),
        content: result.english,
        vietnameseContent: result.vietnamese,
        grammarPoints: result.grammarPoints,
        learningMethods: result.learningMethods,
        timestamp: Date.now(),
        vocabularyUsed: wordList,
        theme: (storyType === 'dialogue' ? '💬 Hội thoại - ' : '📖 Truyện ngắn - ') + (storyTheme || 'General'),
        generationTimeMs: duration
      };

      setStories(prev => [newStory, ...prev]);
      setLastGenTime(Date.now());
      
      // Auto expand learning tips for the new story to encourage usage
      if (result.learningMethods) {
          setShowLearningTips(prev => ({ ...prev, [newStory.id]: true }));
      }

    } catch (error) {
      alert("Không thể tạo câu chuyện. Hệ thống đang bận, vui lòng thử lại sau.");
    } finally {
      setIsLoadingStory(false);
    }
  }, [history, isReadyForStory, lastGenTime, storyTheme, timeSinceLastGen, storyType, energy, customApiKey]);

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
  const toggleLearningTips = (storyId: string) => setShowLearningTips(prev => ({ ...prev, [storyId]: !prev[storyId] }));

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
    // Safety check: if text is error, do not play
    if (text.startsWith("Error:")) {
        return;
    }
    
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

        // Check Cache first
        const cacheKey = `${id}-${selectedVoice}`;
        let audioData = audioCacheRef.current[cacheKey];

        if (!audioData) {
             if (energy < 10) {
                 alert("Không đủ năng lượng để tạo giọng đọc AI mới. Chuyển sang giọng máy.");
                 playNativeTTS(text);
                 return;
             }
             // Fetch from API
             const fetchedData = await generateSpeech(text, selectedVoice, isDialogue);
             if (fetchedData) {
                 audioData = fetchedData;
                 audioCacheRef.current[cacheKey] = audioData; // Store in cache
                 setEnergy(prev => Math.max(0, prev - 10)); // Deduct energy only for new generation
             }
        }
        
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
    // API KEY CHECK
    if (!customApiKey) {
        alert("Để sử dụng tính năng Kiểm Tra, vui lòng nhập API Key của riêng bạn trong phần Cài đặt.");
        setShowSettings(true);
        return;
    }

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
        
        // SANITIZE & NORMALIZE QUIZ DATA to fix scoring bugs
        const sanitizedQuestions = questions.map((q, idx) => {
            // Ensure correctAnswer perfectly matches one of the options
            let bestMatch = q.correctAnswer;
            
            // 1. Try exact match (case insensitive trim)
            const exactMatch = q.options.find(opt => opt.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase());
            if (exactMatch) bestMatch = exactMatch;
            
            // 2. Try index match if answer is like "A", "B"
            else if (/^[A-D]$/i.test(q.correctAnswer.trim())) {
                const index = q.correctAnswer.trim().toUpperCase().charCodeAt(0) - 65; // A=0, B=1...
                if (q.options[index]) bestMatch = q.options[index];
            }
            
            // 3. Try substring match (e.g. correct="Apple" in option="A. Apple")
            else {
                const subMatch = q.options.find(opt => opt.includes(q.correctAnswer) || q.correctAnswer.includes(opt));
                if (subMatch) bestMatch = subMatch;
            }

            return {
                ...q,
                id: idx, // Ensure unique ID
                correctAnswer: bestMatch // Use the normalized correct answer
            };
        });

        setQuizQuestions(sanitizedQuestions);
        setEnergy(prev => Math.max(0, prev - 5)); // Deduct energy
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

  const handleMascotClick = () => {
    // Collect words from Today (Start of day 00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const todaysWords = history.filter(item => item.timestamp >= todayTimestamp);

    if (todaysWords.length > 0) {
        // Dedup words
        const uniqueWords = Array.from(new Set(todaysWords.map(w => w.english)));
        
        // Limit to last 20 to strictly avoid too long speech
        const speechList = uniqueWords.slice(0, 20).join(", ");
        
        const intro = "Here are the words you searched today: ";
        const textToSpeak = intro + speechList + (uniqueWords.length > 20 ? ", and more." : ".");
        
        handleAudioToggle('mascot-daily-review', textToSpeak);
    } else {
        // Default Greeting
        const greeting = "Hello, I'm TNP Robot. Use the translation box to learn new words!";
        handleAudioToggle('mascot-greeting', greeting);
    }
  };
  
  const isMascotSpeaking = activeAudioId?.startsWith('mascot');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-7 h-7 text-blue-600" />
            <div>
                 <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 truncate">Study English With TNP</h1>
                 {/* Session Timeline for Mobile (Simplified) */}
                 <p className="text-[10px] text-gray-400 md:hidden flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" /> {formatDuration(onlineSeconds)}
                 </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
              {/* Energy Bar */}
              <div className="flex items-center gap-2">
                  <BoltIcon className={`w-5 h-5 ${energy < 20 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`} />
                  <div className="w-16 md:w-32 h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div 
                        className={`h-full transition-all duration-500 ${energy < 20 ? 'bg-red-500' : 'bg-gradient-to-r from-yellow-400 to-orange-500'}`}
                        style={{ width: `${energy}%` }}
                      ></div>
                  </div>
                  <span className="text-xs font-bold text-gray-600 hidden md:inline">{Math.round(energy)}%</span>
              </div>

              {/* Settings Button */}
              <button 
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-full transition-colors relative ${customApiKey ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                title="Cài đặt API"
              >
                  <Cog6ToothIcon className="w-6 h-6" />
                  {!customApiKey && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
              </button>

              {/* Session Timeline for PC */}
              <div className="hidden md:flex flex-col items-end text-xs text-gray-500 border-l border-gray-100 pl-4 ml-1">
                  <span className="font-medium text-gray-700">
                      {currentTime.toLocaleTimeString('vi-VN')}
                  </span>
                  <span className="flex items-center gap-1">
                      Online: {formatDuration(onlineSeconds)}
                  </span>
              </div>
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
                                        {userAnswers[q.id] === q.correctAnswer ? (
                                             <div className="mb-2 font-bold text-green-600 flex items-center gap-2 pb-2 border-b border-green-200/50">
                                                 <CheckCircleIcon className="w-5 h-5" />
                                                 <span>Chính xác!</span>
                                            </div>
                                        ) : (
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
                            {/* Voice Input Button */}
                            <button
                                onClick={handleVoiceInput}
                                className={`absolute right-3 bottom-3 p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                title="Nhập bằng giọng nói"
                            >
                                <MicrophoneIcon className="w-5 h-5" />
                            </button>

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
                            {/* Quick Suggestions with Scroll */}
                            <div className="order-2 md:order-1 flex-1 min-w-0">
                                <ScrollableRow>
                                    {QUICK_SUGGESTIONS[direction].map((text, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => handleSuggestionClick(text)}
                                            className="text-xs bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 px-3 py-1.5 rounded-full transition-colors border border-gray-200 hover:border-indigo-200 whitespace-nowrap"
                                        >
                                            {text}
                                        </button>
                                    ))}
                                </ScrollableRow>
                            </div>

                            {/* Translate Button */}
                            <button
                                className="order-1 md:order-2 bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-base hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98] w-full md:w-auto min-w-[140px] shrink-0"
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
                    <div className={`mt-8 p-6 md:p-8 rounded-2xl border animate-fade-in relative group transition-all ${translatedResult.english.startsWith('Error:') ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                        {/* Emoji Visual Icon (Improved Position) */}
                        {translatedResult.emoji && (
                            <div className="absolute top-2 right-2 md:top-6 md:right-6 text-5xl md:text-7xl opacity-90 drop-shadow-md select-none pointer-events-none animate-bounce-in">
                                {translatedResult.emoji}
                            </div>
                        )}
                        
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                            <div className="flex-1">
                                <div className="flex items-baseline flex-wrap gap-3">
                                    <h3 className={`text-3xl md:text-4xl font-bold tracking-tight ${translatedResult.english.startsWith('Error:') ? 'text-red-600 text-xl' : 'text-gray-800'}`}>{translatedResult.english}</h3>
                                    {translatedResult.phonetic && (
                                        <span className="text-indigo-500 font-mono text-lg bg-indigo-100 px-2 py-0.5 rounded-lg">{translatedResult.phonetic}</span>
                                    )}
                                </div>
                                {!translatedResult.english.startsWith('Error:') && (
                                    <div className="flex items-center gap-3 mt-2 text-sm">
                                        <span className="bg-white text-indigo-700 font-bold px-3 py-1 rounded-full border border-indigo-100 shadow-sm uppercase tracking-wide text-xs">{translatedResult.partOfSpeech}</span>
                                        <span className="text-gray-500 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-gray-100">
                                            💡 {translatedResult.usageHint}
                                            <button 
                                                onClick={() => handleAudioToggle('usage-hint', translatedResult.usageHint)}
                                                className="ml-2 text-indigo-400 hover:text-indigo-600 transition-colors"
                                                title="Nghe gợi ý"
                                            >
                                                <SpeakerWaveIcon className="w-4 h-4" />
                                            </button>
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tenses Timeline (if available) */}
                        {translatedResult.tenses && (translatedResult.tenses.past || translatedResult.tenses.present || translatedResult.tenses.future) && (
                            <div className="mt-4 pt-4 border-t border-indigo-200/50">
                                <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Các thì cơ bản</h4>
                                <div className="flex items-center justify-between text-sm bg-white p-3 rounded-xl border border-indigo-100">
                                    <div className="text-center">
                                        <span className="block text-gray-400 text-xs mb-1">Quá khứ</span>
                                        <span className="font-semibold text-gray-700">{translatedResult.tenses.past || "-"}</span>
                                    </div>
                                    <div className="flex-1 h-px bg-indigo-100 mx-4 relative top-2"></div>
                                    <div className="text-center">
                                        <span className="block text-indigo-500 text-xs mb-1 font-bold">Hiện tại</span>
                                        <span className="font-bold text-indigo-700 text-lg">{translatedResult.tenses.present || "-"}</span>
                                    </div>
                                    <div className="flex-1 h-px bg-indigo-100 mx-4 relative top-2"></div>
                                    <div className="text-center">
                                        <span className="block text-gray-400 text-xs mb-1">Tương lai</span>
                                        <span className="font-semibold text-gray-700">{translatedResult.tenses.future || "-"}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!translatedResult.english.startsWith('Error:') && (
                            <div className="mt-6 flex flex-wrap items-center gap-4">
                                <button 
                                    onClick={() => handleAudioToggle('translate', translatedResult.sourceEnglish || translatedResult.english)}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm active:scale-95"
                                >
                                    {activeAudioId === 'translate' && !isPaused ? <PauseIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                                    <span className="hidden sm:inline">Nghe (EN)</span>
                                </button>
                                <SpeedSelector speed={playbackSpeed} onChange={setPlaybackSpeed} />
                            </div>
                        )}
                    </div>
                )}
            </section>
            
            {/* Vocabulary History Section */}
            <section className="bg-white rounded-2xl shadow-lg p-5 md:p-8 border border-gray-100">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-yellow-500" />
                        Kho Từ Vựng Của Bạn
                        <span className="bg-gray-100 text-gray-600 text-sm font-normal px-2 py-0.5 rounded-full">{history.length}</span>
                    </h2>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={handleStartQuiz}
                            disabled={history.length < 5}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all font-medium border ${history.length < 5 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                            title={customApiKey ? "Làm bài kiểm tra" : "Yêu cầu API Key"}
                        >
                            {!customApiKey ? <LockClosedIcon className="w-4 h-4" /> : <ClipboardDocumentCheckIcon className="w-4 h-4" />}
                            <span className="hidden md:inline">Kiểm Tra</span>
                            <span className="md:hidden">Quiz</span>
                        </button>
                        <button 
                            onClick={handleClearHistory}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                            title="Xóa tất cả lịch sử"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {groupedHistory.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                        <BookOpenIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Chưa có từ vựng nào. Hãy thử dịch một từ!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedHistory.map((group, idx) => (
                            <DateAccordion 
                                key={group.dateLabel} 
                                dateLabel={group.dateLabel} 
                                items={group.items} 
                                defaultOpen={idx === 0}
                                layout="grid"
                                renderItem={(item: HistoryItem) => (
                                    <div 
                                        onClick={() => handleAudioToggle(`word-${item.id}`, item.english)}
                                        className="group bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer relative"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">{item.english}</span>
                                                    {item.partOfSpeech && (
                                                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">{item.partOfSpeech}</span>
                                                    )}
                                                </div>
                                                <p className="text-gray-600">{item.vietnamese}</p>
                                                {item.usageHint && (
                                                    <p className="text-xs text-gray-400 mt-2 bg-gray-50 p-2 rounded-lg italic border border-gray-50 group-hover:border-indigo-50">
                                                        "{item.usageHint}"
                                                    </p>
                                                )}
                                            </div>
                                            <button 
                                                onClick={(e) => handleDeleteWord(item.id, e)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                                title="Xóa từ này"
                                            >
                                                <XMarkIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            />
                        ))}
                    </div>
                )}
            </section>
            
            {/* Story Generator Section */}
            <section className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl shadow-xl p-6 md:p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
                
                <h2 className="text-xl md:text-3xl font-bold mb-2 flex items-center gap-3 relative z-10">
                    <SparklesIcon className="w-8 h-8 text-yellow-300 animate-pulse" />
                    Ôn Tập Qua Truyện
                </h2>
                <p className="text-indigo-200 mb-6 text-sm md:text-base relative z-10 max-w-xl">
                    AI sẽ tạo câu chuyện thú vị từ các từ vựng bạn đã học trong 10 tiếng qua. 
                    {customApiKey ? " Bạn có thể tạo truyện ngay bây giờ." : " (Cần API Key riêng)"}
                </p>

                {/* Controls Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <div className="space-y-4">
                        {/* Theme Selection */}
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Chủ đề (Gợi ý)</label>
                             <ScrollableRow>
                                {SUGGESTED_THEMES.map((theme, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => setStoryTheme(theme)}
                                        className={`text-sm px-4 py-2 rounded-full whitespace-nowrap transition-all border ${storyTheme === theme ? 'bg-white text-indigo-900 border-white font-semibold' : 'bg-indigo-800/50 text-indigo-200 border-indigo-700/50 hover:bg-indigo-700'}`}
                                    >
                                        {theme}
                                    </button>
                                ))}
                             </ScrollableRow>
                        </div>
                        {/* Manual Theme Input */}
                        <input
                            type="text"
                            placeholder="Hoặc nhập chủ đề tùy ý..."
                            className="w-full bg-indigo-800/50 border border-indigo-600/50 rounded-xl px-4 py-3 text-white placeholder-indigo-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                            value={storyTheme}
                            onChange={(e) => setStoryTheme(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-col justify-end gap-4">
                         {/* Type Toggle */}
                         <div className="flex bg-indigo-950/50 p-1 rounded-xl border border-indigo-700/50">
                             <button 
                                onClick={() => setStoryType('story')}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${storyType === 'story' ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400 hover:text-white'}`}
                             >
                                 📖 Truyện Ngắn
                             </button>
                             <button 
                                onClick={() => setStoryType('dialogue')}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${storyType === 'dialogue' ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-400 hover:text-white'}`}
                             >
                                 💬 Hội Thoại
                             </button>
                         </div>

                        {/* Generate Button */}
                        <button
                            onClick={() => handleGenerateStory(true)} // force=true for testing
                            disabled={isLoadingStory || (!customApiKey && !isReadyForStory)}
                            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]
                                ${!customApiKey 
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'
                                    : isLoadingStory 
                                        ? 'bg-indigo-700 cursor-wait opacity-80' 
                                        : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-indigo-900 hover:from-yellow-300 hover:to-orange-400'
                                }
                            `}
                        >
                            {!customApiKey ? (
                                <>
                                    <LockClosedIcon className="w-5 h-5" />
                                    <span>Tính năng bị khóa</span>
                                </>
                            ) : isLoadingStory ? (
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-900"></div>
                                    <span>Đang sáng tác...</span>
                                </div>
                            ) : (
                                <>
                                    <SparklesIcon className="w-5 h-5" />
                                    <span>Tạo Truyện Mới</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6 flex items-center gap-3 text-xs text-indigo-300">
                    <div className="flex-1 h-1.5 bg-indigo-950 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-yellow-400 transition-all duration-1000"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <span>{isReadyForStory ? "Sẵn sàng!" : "Chờ hồi phục..."}</span>
                </div>
            </section>

            {/* Stories List Section */}
            {stories.length > 0 && (
                <section className="space-y-6">
                    {groupedStories.map((group, idx) => (
                        <DateAccordion 
                            key={group.dateLabel}
                            dateLabel={group.dateLabel}
                            items={group.items}
                            defaultOpen={idx === 0}
                            layout="list"
                            renderItem={(story: GeneratedStory) => (
                                <div key={story.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden animate-fade-in group w-full mb-6 last:mb-0">
                                    {/* Story Header */}
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                                {story.theme}
                                                {story.generationTimeMs && (
                                                    <span className="text-[10px] font-normal text-gray-400 border border-gray-200 rounded px-1 flex items-center gap-0.5">
                                                        ⚡ {(story.generationTimeMs / 1000).toFixed(1)}s
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                                {new Date(story.timestamp).toLocaleTimeString('vi-VN')} 
                                                <span>•</span> 
                                                {story.vocabularyUsed.length} từ vựng
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Toolbar Buttons */}
                                            <button
                                                onClick={() => handleStartClozeTest(story.id, story.content)}
                                                className={`p-2 rounded-xl transition-all border ${clozeStoryId === story.id ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-white hover:bg-orange-50 text-gray-400 hover:text-orange-500 border-transparent hover:border-orange-100'}`}
                                                title="Luyện điền từ"
                                                disabled={!!clozeStoryId && clozeStoryId !== story.id}
                                            >
                                                <PencilSquareIcon className="w-5 h-5" />
                                            </button>
                                            
                                            <div className="h-6 w-px bg-gray-200 mx-1"></div>
                                            
                                            <button 
                                                onClick={() => handleDeleteStory(story.id)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Story Audio Controls */}
                                    <div className="px-6 py-3 border-b border-gray-100 bg-white flex flex-wrap items-center gap-4">
                                        <button 
                                            onClick={() => handleAudioToggle(story.id, story.content, true, story.theme.includes('💬'))}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all border ${activeAudioId === story.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                                        >
                                            {isLoadingAudio && activeAudioId === story.id ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            ) : (activeAudioId === story.id && !isPaused ? <PauseIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />)}
                                            {/* Removed text label as requested for compact look, just icon */}
                                        </button>

                                        {/* Audio Progress Bar */}
                                        {activeAudioId === story.id && (
                                            <div className="flex-1 min-w-[100px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                                                    style={{ width: `${audioProgress * 100}%` }}
                                                ></div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 ml-auto">
                                            <SpeedSelector speed={playbackSpeed} onChange={setPlaybackSpeed} variant="dark" />
                                            <VoiceSelector selected={selectedVoice} onChange={setSelectedVoice} />
                                        </div>
                                    </div>

                                    {/* Story Content */}
                                    <div className="p-6 md:p-8 space-y-8">
                                        {/* English Content */}
                                        <div className="leading-loose text-gray-800 text-lg md:text-xl font-serif tracking-wide">
                                            <InteractiveStoryText 
                                                content={story.content} 
                                                highlightedIndex={activeAudioId === story.id ? highlightedWordIndex : -1}
                                                onWordClick={handleWordClick}
                                                onSelection={handleSelectionLookup}
                                                isClozeMode={clozeStoryId === story.id}
                                                hiddenIndices={clozeHiddenIndices}
                                                userClozeInputs={userClozeInputs}
                                                onClozeInputChange={handleClozeInputChange}
                                                isSubmitted={clozeSubmitted}
                                            />
                                        </div>
                                        
                                        {/* Cloze Actions */}
                                        {clozeStoryId === story.id && !clozeSubmitted && (
                                            <div className="flex justify-center pt-4 border-t border-gray-100">
                                                <button 
                                                    onClick={handleSubmitCloze}
                                                    className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 shadow-md transition-all active:scale-95"
                                                >
                                                    Nộp Bài
                                                </button>
                                            </div>
                                        )}

                                        {/* Vietnamese Translation Toggle */}
                                        <div className="pt-4 border-t border-gray-100">
                                             <button 
                                                onClick={() => toggleVietnamese(story.id)}
                                                className="text-sm font-semibold text-gray-500 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                                             >
                                                 {showVietnamese[story.id] ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                                 {showVietnamese[story.id] ? "Ẩn dịch nghĩa" : "Xem dịch nghĩa"}
                                             </button>
                                             
                                             {showVietnamese[story.id] && (
                                                 <div className="mt-4 p-4 bg-gray-50 rounded-xl text-gray-600 italic border border-gray-100 animate-fade-in leading-relaxed">
                                                     {story.vietnameseContent}
                                                 </div>
                                             )}
                                        </div>
                                    </div>

                                    {/* Grammar & Learning Methods Section */}
                                    <div className="bg-teal-50/50 border-t border-teal-100">
                                         {/* Grammar Toggle */}
                                         <button 
                                            onClick={() => toggleGrammar(story.id)}
                                            className="w-full px-6 py-3 flex items-center justify-between text-teal-700 font-semibold hover:bg-teal-50 transition-colors border-b border-teal-100/50"
                                         >
                                             <div className="flex items-center gap-2">
                                                 <AcademicCapIcon className="w-5 h-5" />
                                                 Góc Ngữ Pháp
                                             </div>
                                             <ChevronDownIcon className={`w-4 h-4 transition-transform ${showGrammar[story.id] ? 'rotate-180' : ''}`} />
                                         </button>
                                         
                                         {showGrammar[story.id] && (
                                             <div className="px-6 pb-6 pt-2 animate-fade-in">
                                                {story.grammarPoints && story.grammarPoints.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {story.grammarPoints.map((point, idx) => (
                                                            <div key={idx} className="bg-white p-4 rounded-xl border border-teal-100 shadow-sm">
                                                                <h4 className="font-bold text-teal-800 mb-1">{point.structure}</h4>
                                                                <p className="text-sm text-gray-600 mb-2">{point.explanation}</p>
                                                                <div className="text-xs bg-gray-50 p-2 rounded border border-gray-100">
                                                                    <span className="font-semibold text-gray-500">Ví dụ:</span> {point.exampleInStory}
                                                                </div>
                                                                <p className="text-xs text-teal-600 mt-2 font-medium">💡 Mẹo: {point.memoryTip}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-center text-gray-400 italic text-sm">Không có dữ liệu ngữ pháp cho bài này.</p>
                                                )}
                                             </div>
                                         )}

                                         {/* Learning Methods Toggle (New) */}
                                         {story.learningMethods && (
                                            <>
                                                <button 
                                                    onClick={() => toggleLearningTips(story.id)}
                                                    className="w-full px-6 py-3 flex items-center justify-between text-amber-700 font-semibold hover:bg-amber-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <LightBulbIcon className="w-5 h-5" />
                                                        Phương Pháp Học & Giao Tiếp
                                                    </div>
                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${showLearningTips[story.id] ? 'rotate-180' : ''}`} />
                                                </button>
                                                
                                                {showLearningTips[story.id] && (
                                                    <div className="px-6 pb-6 pt-2 animate-fade-in">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {/* Memorization Tips */}
                                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                                                                <h4 className="font-bold text-amber-800 mb-3 flex items-center gap-2 border-b border-amber-200 pb-2">
                                                                    🧠 Mẹo Ghi Nhớ
                                                                </h4>
                                                                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                                                                    {story.learningMethods.memorization.map((tip, i) => (
                                                                        <li key={i}>{tip}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>

                                                            {/* Speaking Practice */}
                                                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
                                                                <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2 border-b border-blue-200 pb-2">
                                                                    🗣️ Thực Hành Giao Tiếp
                                                                </h4>
                                                                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                                                                    {story.learningMethods.speaking.map((tip, i) => (
                                                                        <li key={i}>{tip}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                         )}
                                    </div>
                                </div>
                            )}
                        />
                    ))}
                </section>
            )}
        </>
        )}
      </main>

      {/* Mascot Section - Fixed Overlay */}
      {!isQuizMode && (
          <Mascot 
            latestWord={undefined} // Not used anymore as logic is inside
            isSpeaking={!!isMascotSpeaking && !isPaused}
            onSpeak={handleMascotClick}
          />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <Cog6ToothIcon className="w-6 h-6 text-gray-600" />
                        Cài Đặt Hệ Thống
                    </h3>
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-6 text-sm text-yellow-800">
                         <strong>Lưu ý quan trọng:</strong> API Key của bạn sẽ được lưu an toàn trong trình duyệt (localStorage) và chỉ được sử dụng để thực hiện các yêu cầu AI.
                    </div>
                    <p className="text-sm text-gray-500 mb-6">
                        Để mở khóa tính năng <b>Tạo Truyện</b> và <b>Kiểm Tra</b>, vui lòng nhập Google Gemini API Key của bạn.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Google Gemini API Key</label>
                            <div className="relative">
                                <input 
                                    type={showApiKey ? "text" : "password"}
                                    value={tempApiKey}
                                    onChange={(e) => setTempApiKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full p-3 pr-10 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <button 
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                                >
                                    {showApiKey ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-xs text-blue-500 mt-2 hover:underline">
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                                    Lấy API Key miễn phí tại đây ↗
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                    <button 
                        onClick={() => setShowSettings(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                    >
                        Đóng
                    </button>
                    <button 
                        onClick={handleSaveApiKey}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Lưu Cài Đặt
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Lookup Popup (Modal) */}
      {selectedWord && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedWord(null)}>
              <div 
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
              >
                  <div className="bg-indigo-600 p-6 text-white relative overflow-hidden">
                       <div className="relative z-10 flex justify-between items-start">
                           <div>
                                <h3 className="text-3xl font-bold mb-1 flex items-center gap-2">
                                    {selectedWord.word}
                                    {selectedWord.emoji && <span className="text-4xl">{selectedWord.emoji}</span>}
                                </h3>
                                <p className="text-indigo-200 font-mono text-lg">{selectedWord.phonetic}</p>
                           </div>
                           <button onClick={() => setSelectedWord(null)} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-1 rounded-full backdrop-blur-sm transition-all">
                               <XMarkIcon className="w-6 h-6" />
                           </button>
                       </div>
                       <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  </div>
                  
                  <div className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                          <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded text-xs uppercase border border-indigo-100">{selectedWord.type}</span>
                      </div>
                      
                      <div className="space-y-4">
                          <div>
                              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Định nghĩa</p>
                              <p className="text-xl text-gray-800 font-medium leading-relaxed">{selectedWord.meaning}</p>
                          </div>
                          
                          {selectedWord.example && (
                              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ví dụ ngữ cảnh</p>
                                  <p className="text-gray-600 italic">"{selectedWord.example}"</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Selection Tooltip */}
      {selectionPopup && !isLookingUp && (
          <div 
            className="fixed z-50 selection-popup animate-bounce-in"
            style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translate(-50%, -100%)' }}
          >
              <button 
                onClick={(e) => handleWordClick(selectionPopup.text, "User selected text", e)}
                className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 hover:bg-black transition-colors after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-gray-900"
              >
                  <SparklesIcon className="w-3 h-3 text-yellow-400" />
                  Tra cứu nhanh
              </button>
          </div>
      )}

      {/* 10-Minute Congratulation Popup */}
      {showCongratulation && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-scale-in pointer-events-auto border-4 border-yellow-400 relative overflow-hidden">
                  <div className="absolute inset-0 bg-yellow-50 opacity-50 z-0"></div>
                  <div className="relative z-10">
                      <div className="mx-auto bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-inner">
                          <TrophyIcon className="w-10 h-10 text-yellow-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">Tuyệt vời!</h3>
                      <p className="text-gray-600 mb-6">
                          Bạn đã chăm chỉ học tập được <span className="font-bold text-indigo-600">10 phút</span> rồi đấy.
                          Hãy tiếp tục giữ vững phong độ nhé!
                      </p>
                      <button 
                        onClick={() => setShowCongratulation(false)}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg active:scale-95"
                      >
                          Tiếp tục học
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

// --- HELPER COMPONENTS ---

const InteractiveStoryText = ({ 
    content, 
    highlightedIndex, 
    onWordClick, 
    onSelection, 
    isClozeMode, 
    hiddenIndices, 
    userClozeInputs, 
    onClozeInputChange, 
    isSubmitted 
}: any) => {
    // Basic tokenizer that preserves spaces/punctuation for rendering but identifies words for interaction
    // Note: This is a simplified approach. Complex HTML parsing would be heavier.
    // We assume the content is mostly plain text with occasional <b> tags.
    // We strip <b> tags for the "words" array but keep track of indices.
    
    // Step 1: Strip HTML for basic word splitting
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const plainText = tempDiv.textContent || "";
    
    // Split by spaces to approximate words, keeping delimiters
    const tokens = plainText.split(/(\s+)/);
    
    let wordCounter = 0;

    return (
        <div 
            className="interactive-text select-text" 
            onMouseUp={onSelection} 
            onTouchEnd={onSelection}
        >
            {tokens.map((token, i) => {
                const isWord = token.trim().length > 0 && /[a-zA-Z0-9]/.test(token);
                
                // Only increment counter for valid words
                const currentWordIndex = isWord ? wordCounter++ : -1;
                
                if (!isWord) {
                    return <span key={i}>{token}</span>;
                }

                const isHidden = isClozeMode && hiddenIndices.includes(currentWordIndex);
                const isHighlighted = currentWordIndex === highlightedIndex;

                if (isHidden) {
                    const userAnswer = userClozeInputs[currentWordIndex] || "";
                    const isCorrect = isSubmitted && userAnswer.toLowerCase() === token.toLowerCase();

                    return (
                        <span key={i} className="inline-block mx-1 align-middle relative">
                            {isSubmitted ? (
                                <span className={`font-bold px-1 rounded ${isCorrect ? 'text-green-600 bg-green-50 border border-green-200' : 'text-red-600 bg-red-50 border border-red-200 line-through'}`}>
                                    {userAnswer || "(trống)"}
                                </span>
                            ) : (
                                <input
                                    type="text"
                                    className="border-b-2 border-indigo-300 bg-indigo-50/50 text-indigo-900 px-1 py-0.5 w-[80px] text-center focus:outline-none focus:border-indigo-600 rounded-t transition-all"
                                    value={userAnswer}
                                    onChange={(e) => onClozeInputChange(currentWordIndex, e.target.value)}
                                    autoComplete="off"
                                />
                            )}
                            
                            {/* Show correction tooltip if wrong */}
                            {isSubmitted && !isCorrect && (
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-10 pointer-events-none">
                                    {token}
                                </span>
                            )}
                        </span>
                    );
                }

                return (
                    <span 
                        key={i}
                        className={`
                            cursor-pointer transition-all duration-200 rounded px-0.5
                            ${isHighlighted ? 'bg-yellow-300 text-gray-900 scale-105 shadow-sm font-medium' : 'hover:bg-indigo-100 hover:text-indigo-700'}
                        `}
                        onClick={(e) => onWordClick(token, plainText, e)}
                    >
                        {token}
                    </span>
                );
            })}
        </div>
    );
};

const ScrollableRow = ({ children }: { children: React.ReactNode }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const amount = 200;
            scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
        }
    };

    return (
        <div className="relative group/scroll">
            <button 
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 p-1 rounded-full shadow-sm hover:bg-white text-gray-600 opacity-0 group-hover/scroll:opacity-100 transition-opacity disabled:opacity-0"
            >
                <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <div 
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide py-1 px-1 scroll-smooth"
            >
                {children}
            </div>
            <button 
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 p-1 rounded-full shadow-sm hover:bg-white text-gray-600 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
            >
                <ChevronRightIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

const DateAccordion = ({ dateLabel, items, renderItem, defaultOpen, layout = 'grid' }: { dateLabel: string, items: any[], renderItem: any, defaultOpen?: boolean, layout?: 'grid' | 'list' }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen || false);

    return (
        <div className="mb-4">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-2 px-1 text-gray-400 hover:text-indigo-600 transition-colors mb-2"
            >
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    {dateLabel}
                    <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full text-[10px]">{items.length}</span>
                </span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <div className={`grid gap-4 transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
                <div className="overflow-hidden">
                    <div className={`${layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-2' : 'flex flex-col space-y-6 pb-2'}`}>
                        {items.map(renderItem)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SpeedSelector = ({ speed, onChange, variant = 'light' }: { speed: number, onChange: (s: number) => void, variant?: 'light' | 'dark' }) => (
    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border ${variant === 'dark' ? 'bg-gray-50 border-gray-200 text-gray-600' : 'bg-white/50 border-white/50 text-indigo-700'}`}>
        <span>{speed}x</span>
        <input 
            type="range" 
            min="0.5" 
            max="1.5" 
            step="0.25" 
            value={speed} 
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-16 accent-indigo-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
    </div>
);

const VoiceSelector = ({ selected, onChange }: { selected: string, onChange: (v: string) => void }) => (
    <div className="relative group z-20">
        <button className="flex items-center gap-1 text-xs font-medium bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            {VOICE_OPTIONS.find(v => v.id === selected)?.label || selected}
            <ChevronDownIcon className="w-3 h-3" />
        </button>
        <div className="absolute bottom-full right-0 mb-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden hidden group-hover:block animate-fade-in">
            {VOICE_OPTIONS.map(opt => (
                <button
                    key={opt.id}
                    onClick={() => onChange(opt.id)}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-indigo-50 ${selected === opt.id ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-600'}`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

export default App;
