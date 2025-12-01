
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HistoryItem, GeneratedStory, WordDefinition, TranslationResponse } from './src/types';
import { translateText, generateStoryFromWords, lookupWord } from './src/services/geminiService';
import { 
  BookOpenIcon, 
  LanguageIcon, 
  ClockIcon, 
  SparklesIcon, 
  TrashIcon, 
  ArrowPathIcon 
} from './components/Icons';

// Constants
const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
const STORAGE_KEY_HISTORY = 'vocastory_history';
const STORAGE_KEY_STORY = 'vocastory_stories';
const STORAGE_KEY_LAST_GEN = 'vocastory_last_gen_time';

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
  
  // New State for Bilingual & Lookup Features
  const [showVietnamese, setShowVietnamese] = useState<Record<string, boolean>>({});
  const [selectedWord, setSelectedWord] = useState<WordDefinition | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  
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
    try {
      const wordList = targetWords.map(w => w.english);
      const result = await generateStoryFromWords(wordList, storyTheme);

      const newStory: GeneratedStory = {
        id: Date.now().toString(),
        content: result.english,
        vietnameseContent: result.vietnamese,
        timestamp: Date.now(),
        vocabularyUsed: wordList,
        theme: storyTheme || 'General',
      };

      setStories(prev => [newStory, ...prev]);
      setLastGenTime(Date.now());
      
    } catch (error) {
      console.error("Story generation failed", error);
      alert("Không thể tạo câu chuyện lúc này.");
    } finally {
      setIsLoadingStory(false);
    }
  }, [history, isReadyForStory, lastGenTime, storyTheme, timeSinceLastGen]);

  const handleClearHistory = () => {
    if (window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử?")) {
      setHistory([]);
      setStories([]);
      setLastGenTime(0);
      setTranslatedResult(null);
    }
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

  // Helper component to render clickable text
  const InteractiveStoryText = ({ content }: { content: string }) => {
    // Regex to split by bold tags, then split remaining text by spaces to make words clickable
    // HTML structure from Gemini: "Some text <b>word</b> some text."
    
    // 1. Split by HTML tags first to preserve Bold words
    const parts = content.split(/(<b>.*?<\/b>)/g);

    return (
      <div className="leading-relaxed">
        {parts.map((part, index) => {
          if (part.startsWith('<b>') && part.endsWith('</b>')) {
            // It's a key vocabulary word
            const innerText = part.replace(/<\/?b>/g, '');
            return (
              <span 
                key={index} 
                onClick={(e) => handleWordClick(innerText, content, e)}
                className="font-bold text-yellow-300 cursor-pointer hover:bg-white/20 px-0.5 rounded transition-colors"
              >
                {innerText}
              </span>
            );
          } else {
            // Normal text, split by space to make words clickable
            return (
              <span key={index}>
                {part.split(/(\s+)/).map((word, wIndex) => {
                  if (word.trim().length === 0) return word; // Return spaces as is
                  return (
                    <span 
                      key={`${index}-${wIndex}`}
                      onClick={(e) => handleWordClick(word, content, e)}
                      className="cursor-pointer hover:underline hover:text-indigo-200 transition-colors"
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
                  <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 mb-3">
                    <p className="text-xl md:text-3xl font-bold text-indigo-900 break-words">
                      {translatedResult.english}
                    </p>
                    {translatedResult.partOfSpeech && (
                      <span className="text-xs font-semibold uppercase tracking-wide bg-indigo-200 text-indigo-800 px-2 py-1 rounded-md">
                        {translatedResult.partOfSpeech}
                      </span>
                    )}
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
                      <div key={item.id} className="group flex flex-col bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 px-4 py-2 rounded-xl transition-all min-w-[140px] max-w-[240px]">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-indigo-700 truncate mr-2">{item.english}</span>
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
                  Hệ thống tạo truyện song ngữ mỗi 10 tiếng. Nhấn vào bất kỳ từ tiếng Anh nào để tra nghĩa.
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

              <div className="space-y-3">
                <input 
                  type="text" 
                  value={storyTheme}
                  onChange={(e) => setStoryTheme(e.target.value)}
                  placeholder="Chủ đề (VD: Adventure)..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
                <button
                  onClick={() => handleGenerateStory(true)} 
                  disabled={isLoadingStory || history.length < 2}
                  className="w-full py-3 bg-white text-indigo-900 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isLoadingStory ? (
                     <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-5 h-5" />
                  )}
                  {isReadyForStory ? 'Tạo Câu Chuyện Ngay' : 'Tạo Ngay (Bỏ qua chờ)'}
                </button>
              </div>
            </div>

            {/* Story Display */}
            <div className="lg:col-span-2 bg-white/5 rounded-2xl border border-white/10 p-6 max-h-[600px] overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {stories.length > 0 ? (
                <div className="space-y-8">
                  {stories.map((story, index) => (
                    <div key={story.id} className="animate-fade-in group">
                      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                        <span className="text-xs font-medium uppercase tracking-wider text-indigo-300 bg-indigo-900/50 px-2 py-1 rounded">
                          {story.theme}
                        </span>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleVietnamese(story.id)}
                            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-indigo-100 transition-colors flex items-center gap-1"
                          >
                            <LanguageIcon className="w-3 h-3" />
                            {showVietnamese[story.id] ? 'Ẩn Tiếng Việt' : 'Hiện Song Ngữ'}
                          </button>
                          <span className="text-xs text-indigo-300">
                            {new Date(story.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* English Content */}
                      <div className="prose prose-invert prose-lg max-w-none text-indigo-50 mb-4">
                         <InteractiveStoryText content={story.content} />
                      </div>

                      {/* Vietnamese Content (Collapsible) */}
                      {showVietnamese[story.id] && (
                        <div className="bg-indigo-950/50 p-4 rounded-xl border border-indigo-500/20 animate-fade-in mt-4">
                          <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2">Bản dịch tiếng việt</h4>
                          <p className="text-indigo-200 text-sm leading-relaxed">
                            {story.vietnameseContent || "Chưa có bản dịch cho câu chuyện này."}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-indigo-300 mb-2">Vocabulary used:</p>
                        <div className="flex flex-wrap gap-2">
                          {story.vocabularyUsed.map((word, i) => (
                            <span key={i} className="text-xs bg-white/10 px-2 py-1 rounded text-white font-medium border border-white/5">
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                      {index < stories.length - 1 && <div className="my-8 border-b border-white/10"></div>}
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
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 pointer-events-auto transform transition-all animate-bounce-in border border-indigo-100"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-2xl font-bold text-indigo-900 capitalize flex items-center gap-2">
                  {selectedWord.word}
                  {selectedWord.phonetic && <span className="text-sm font-normal text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">{selectedWord.phonetic}</span>}
                </h3>
                <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">{selectedWord.type}</span>
              </div>
              <button onClick={() => setSelectedWord(null)} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="space-y-3 mt-4">
              <div>
                <p className="text-gray-800 font-medium text-lg leading-snug">
                  {selectedWord.meaning}
                </p>
              </div>
              {selectedWord.example && (
                <div className="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-400">
                  <p className="text-sm text-indigo-800 italic">"{selectedWord.example}"</p>
                </div>
              )}
            </div>
          </div>
          {/* Overlay to close on click outside */}
          <div 
            className="absolute inset-0 bg-black/20 -z-10 pointer-events-auto"
            onClick={() => setSelectedWord(null)}
          ></div>
        </div>
      )}
    </div>
  );
};

export default App;
