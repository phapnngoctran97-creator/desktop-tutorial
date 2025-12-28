
import React, { useState, useEffect } from 'react';
import { HistoryItem, TranslationResponse, ToolType, GeneratedStory, QuizQuestion } from './types';
import { translateText, generateStoryFromWords, generateQuizFromHistory } from './services/geminiService';
import { Mascot } from './components/Mascot';
import { Sidebar } from './components/Sidebar';
import { 
  ClockIcon, SparklesIcon, ArrowsRightLeftIcon, 
  BoltIcon, BookOpenIcon, AcademicCapIcon,
  CheckCircleIcon, XCircleIcon, ArrowPathIcon
} from './components/Icons';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inputText, setInputText] = useState('');
  const [translatedResults, setTranslatedResults] = useState<(TranslationResponse & { source: string })[]>([]);
  const [direction, setDirection] = useState<'vi_en' | 'en_vi'>('en_vi');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'none' | 'system' | 'session'>('none');
  
  // State cho Truyện AI
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  
  // State cho Quiz
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (process.env.API_KEY && process.env.API_KEY.length > 10) {
        setApiStatus('system');
        return;
      }
      try {
        // @ts-ignore
        if (window.aistudio?.hasSelectedApiKey) {
          // @ts-ignore
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) setApiStatus('session');
        }
      } catch (e) {
        console.debug("API Check failed", e);
      }
    };
    checkKey();
    const interval = setInterval(checkKey, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectAPI = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    } else {
      alert("Để deploy Cloudflare: Settings -> Variables -> Add API_KEY -> Redeploy.");
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    if (apiStatus === 'none') { await handleConnectAPI(); return; }

    setIsLoading(true);
    try {
      const words = inputText.split(/[,\n;]+/).map(w => w.trim()).filter(w => w.length > 0);
      const results = await Promise.all(words.slice(0, 5).map(async (word) => {
        const res = await translateText(word, direction);
        return { ...res, source: word };
      }));

      setTranslatedResults(results);
      const newItems: HistoryItem[] = results.map((res, idx) => ({
        id: `${Date.now()}-${idx}`,
        vietnamese: direction === 'vi_en' ? res.source : res.english, // Đây là bản dịch tạm thời
        english: direction === 'en_vi' ? res.source : res.english,
        partOfSpeech: res.partOfSpeech,
        usageHint: res.usageHint,
        timestamp: Date.now(),
        usedInStory: false
      }));
      setHistory(prev => [...newItems, ...prev].slice(0, 50));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStory = async () => {
    if (history.length < 3) {
      alert("Bạn cần dịch ít nhất 3 từ để AI có đủ dữ liệu tạo truyện!");
      return;
    }
    setIsLoading(true);
    try {
      const wordsToUse = history.slice(0, 6).map(h => h.english);
      const story = await generateStoryFromWords(wordsToUse);
      setStories(prev => [story, ...prev]);
      setActiveTool(ToolType.STORIES);
    } catch (err) {
      alert("Lỗi khi tạo truyện. Vui lòng kiểm tra API Key.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (history.length < 4) {
      alert("Bạn cần ít nhất 4 từ trong lịch sử để tạo bài kiểm tra!");
      return;
    }
    setIsLoading(true);
    setShowQuizResults(false);
    setQuizAnswers({});
    try {
      const questions = await generateQuizFromHistory(history.slice(0, 10));
      setCurrentQuiz(questions);
      setActiveTool(ToolType.QUIZ);
    } catch (err) {
      alert("Không thể tạo bài kiểm tra.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <BookOpenIcon className="w-6 h-6 text-indigo-500" /> Tra cứu đa năng
            </h3>
            <button 
              onClick={() => setDirection(d => d === 'en_vi' ? 'vi_en' : 'en_vi')}
              className="text-xs font-black bg-slate-50 text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2"
            >
              <ArrowsRightLeftIcon className="w-4 h-4" />
              {direction === 'en_vi' ? 'ANH - VIỆT' : 'VIỆT - ANH'}
            </button>
          </div>
          <textarea 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-32 p-6 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500/20 text-lg resize-none placeholder-slate-300 transition-all"
            placeholder="Ví dụ: apple, banana, car..."
          />
          <button 
            onClick={handleTranslate}
            disabled={isLoading}
            className="w-full mt-4 bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : "DỊCH VÀ LƯU VÀO BỘ NHỚ"}
          </button>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
          <h4 className="font-black text-slate-800 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-amber-400" /> Học tập với AI</h4>
          <button 
            onClick={handleCreateStory} 
            disabled={isLoading}
            className="w-full p-4 bg-indigo-50 text-indigo-700 rounded-2xl font-bold hover:bg-indigo-100 transition-all flex items-center justify-between group"
          >
            <span>Viết truyện từ vựng</span>
            <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </button>
          <button 
            onClick={handleStartQuiz}
            disabled={isLoading}
            className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-100 transition-all flex items-center justify-between group"
          >
            <span>Làm bài kiểm tra nhanh</span>
            <AcademicCapIcon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
          </button>
          <div className="mt-auto pt-4 border-t border-slate-50">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                <div className={`w-2 h-2 rounded-full ${apiStatus !== 'none' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                {apiStatus === 'system' ? 'SERVER CONNECTED' : apiStatus === 'session' ? 'SESSION ACTIVE' : 'API KEY REQUIRED'}
             </div>
          </div>
        </div>
      </div>

      {translatedResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {translatedResults.map((res, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
               <div className="flex justify-between items-start mb-4">
                <span className="text-4xl group-hover:scale-110 transition-transform block">{res.emoji}</span>
                <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-1 rounded">{res.partOfSpeech}</span>
              </div>
              <h4 className="text-xl font-black text-slate-800">{res.english}</h4>
              <p className="text-indigo-400 font-bold text-sm mb-4">{res.phonetic}</p>
              <p className="text-slate-500 text-sm italic leading-relaxed">"{res.usageHint}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStories = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <SparklesIcon className="w-8 h-8 text-indigo-500" /> Thư viện Truyện AI
        </h2>
        <button onClick={() => setActiveTool(ToolType.DASHBOARD)} className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors">Quay lại</button>
      </div>
      
      {isLoading && (
        <div className="bg-white p-20 rounded-[3rem] text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <SparklesIcon className="w-8 h-8" />
          </div>
          <p className="font-black text-slate-600">Gemini đang sáng tác câu chuyện cho bạn...</p>
        </div>
      )}

      {stories.length > 0 && !isLoading ? (
        <div className="space-y-8">
          {stories.map(story => (
            <div key={story.id} className="bg-white overflow-hidden rounded-[2.5rem] shadow-xl shadow-indigo-100/20 border border-slate-100">
              <div className="p-8 md:p-12">
                <div className="flex items-center gap-4 mb-8">
                  <div className="px-4 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-tighter">{story.theme}</div>
                  <div className="text-slate-300 text-xs font-medium">{new Date(story.timestamp).toLocaleDateString()}</div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> English Story
                    </h4>
                    <p className="text-slate-700 leading-relaxed font-medium text-lg lg:text-xl italic">
                      {story.content}
                    </p>
                  </div>
                  
                  <div className="space-y-6 bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Bản dịch tiếng Việt
                    </h4>
                    <p className="text-slate-500 leading-relaxed text-base">
                      {story.vietnameseContent}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 px-8 py-6 flex flex-wrap gap-3">
                <span className="text-[10px] font-black text-slate-400 uppercase self-center mr-2">Từ vựng đã dùng:</span>
                {story.vocabularyUsed.map((v, i) => (
                  <span key={i} className="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-indigo-600 shadow-sm hover:scale-105 transition-transform">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !isLoading && (
        <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
          <p className="text-slate-400 font-bold">Hãy tra cứu từ vựng và nhấn "Viết truyện" để bắt đầu!</p>
        </div>
      )}
    </div>
  );

  const renderQuiz = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in zoom-in-95 duration-500 pb-20">
      <div className="text-center space-y-4">
        <div className="inline-block p-3 bg-emerald-50 text-emerald-500 rounded-2xl mb-2">
          <AcademicCapIcon className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black text-slate-800">Thử thách trí nhớ</h2>
        <p className="text-slate-400 font-medium">Chọn đáp án đúng nhất dựa trên các từ bạn vừa tra cứu</p>
      </div>

      {isLoading ? (
        <div className="bg-white p-20 rounded-[3rem] text-center space-y-4 shadow-sm border border-slate-100">
          <ArrowPathIcon className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
          <p className="font-bold text-slate-500 tracking-tight">AI đang chuẩn bị bộ câu hỏi cho riêng bạn...</p>
        </div>
      ) : currentQuiz.length > 0 ? (
        <div className="space-y-8">
          {currentQuiz.map((q, idx) => (
            <div key={q.id} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <span className="text-indigo-500 font-black text-xs uppercase tracking-widest">Question 0{idx + 1}</span>
                  <h4 className="text-xl font-bold text-slate-800 leading-tight">{q.question}</h4>
                </div>
                {showQuizResults && (
                   <div className="shrink-0">
                      {quizAnswers[q.id] === q.correctAnswer ? (
                        <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                      ) : (
                        <XCircleIcon className="w-8 h-8 text-red-500" />
                      )}
                   </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options.map((opt, i) => {
                  const isSelected = quizAnswers[q.id] === opt;
                  const isCorrect = opt === q.correctAnswer;
                  
                  let buttonClass = "p-5 rounded-2xl border-2 text-left font-bold transition-all relative overflow-hidden ";
                  if (!showQuizResults) {
                    buttonClass += isSelected 
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md" 
                      : "border-slate-50 bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white";
                  } else {
                    if (isCorrect) buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-700";
                    else if (isSelected && !isCorrect) buttonClass += "border-red-500 bg-red-50 text-red-700";
                    else buttonClass += "border-slate-50 bg-slate-50 text-slate-400 opacity-60";
                  }

                  return (
                    <button 
                      key={i} 
                      disabled={showQuizResults}
                      onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))}
                      className={buttonClass}
                    >
                      <span className="mr-3 text-indigo-300 opacity-50">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {showQuizResults && (
                <div className="bg-slate-50 p-6 rounded-2xl border-l-4 border-indigo-500 animate-in fade-in slide-in-from-left-4">
                  <p className="text-sm text-slate-600 leading-relaxed italic">
                    <span className="font-black text-indigo-500 uppercase text-[10px] block mb-1">Giải thích:</span>
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          ))}

          {!showQuizResults ? (
            <button 
              onClick={() => {
                if (Object.keys(quizAnswers).length < currentQuiz.length) {
                  alert("Vui lòng trả lời hết tất cả các câu hỏi!");
                  return;
                }
                setShowQuizResults(true);
              }}
              className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black hover:bg-black transition-all shadow-xl shadow-slate-200"
            >
              NỘP BÀI KIỂM TRA
            </button>
          ) : (
            <button 
              onClick={() => setActiveTool(ToolType.DASHBOARD)}
              className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
            >
              HOÀN THÀNH & QUAY LẠI
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
           <AcademicCapIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
           <p className="text-slate-400 font-bold">Hệ thống chưa có câu hỏi nào. Hãy tra cứu thêm từ vựng!</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-['Inter']">
      <Sidebar 
        activeTool={activeTool} 
        onSelect={setActiveTool} 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto p-8 md:p-12 relative scrollbar-hide">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-black tracking-tighter">StudyWith<span className="text-indigo-600">TNP</span></h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Học tiếng Anh thông minh cùng AI</p>
          </div>
          <div className="flex items-center gap-4">
             <div className={`px-4 py-2 rounded-full text-[10px] font-black tracking-widest border transition-all ${apiStatus !== 'none' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                {apiStatus === 'system' ? 'SYSTEM CONNECTED' : apiStatus === 'session' ? 'SESSION KEY' : 'OFFLINE'}
             </div>
             <button onClick={handleConnectAPI} className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"><BoltIcon className="w-5 h-5" /></button>
          </div>
        </header>

        {activeTool === ToolType.DASHBOARD && renderDashboard()}
        {activeTool === ToolType.STORIES && renderStories()}
        {activeTool === ToolType.QUIZ && renderQuiz()}
        {activeTool === ToolType.HISTORY && renderDashboard()}
        
        <footer className="mt-20 py-8 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-300 tracking-widest uppercase">
          <p>&copy; 2024 TNP LANGUAGE PLATFORM</p>
          <div className="flex gap-6">
            <span>v1.2.0-stable</span>
          </div>
        </footer>
      </main>
      <Mascot latestWord={translatedResults[0]?.english} isSpeaking={false} onSpeak={() => {}} />
    </div>
  );
};

export default App;
