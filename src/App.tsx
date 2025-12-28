
import React, { useState, useEffect } from 'react';
import { HistoryItem, TranslationResponse, ToolType, GeneratedStory, QuizQuestion } from './types';
import { translateText, generateStoryFromWords, generateQuizFromHistory } from './services/geminiService';
import { Mascot } from './components/Mascot';
import { Sidebar } from './components/Sidebar';
import { 
  ClockIcon, SparklesIcon, ArrowsRightLeftIcon, 
  ChevronRightIcon, BoltIcon, TrashIcon,
  AcademicCapIcon, BookOpenIcon
} from './components/Icons';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inputText, setInputText] = useState('');
  const [translatedResults, setTranslatedResults] = useState<(TranslationResponse & { source: string })[]>([]);
  const [direction, setDirection] = useState<'vi_en' | 'en_vi'>('en_vi');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);
  const [quizScore, setQuizScore] = useState<{correct: number, total: number} | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      // 1. Kiểm tra xem có Key trong biến môi trường (Cloudflare/Production) không
      if (process.env.API_KEY && process.env.API_KEY !== '') {
        setIsConnected(true);
        return;
      }

      // 2. Nếu không có, kiểm tra trong môi trường AI Studio
      try {
        // @ts-ignore
        if (window.aistudio?.hasSelectedApiKey) {
          // @ts-ignore
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsConnected(hasKey);
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
      setIsConnected(true);
    } else {
      alert("Ở môi trường Cloudflare, bạn cần cấu hình API_KEY trong phần 'Settings > Variables and Secrets' của Cloudflare Dashboard.");
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    // Nếu không có key, yêu cầu kết nối
    if (!isConnected && (!process.env.API_KEY || process.env.API_KEY === '')) { 
      await handleConnectAPI(); 
      return; 
    }

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
        vietnamese: direction === 'vi_en' ? res.source : (res.english === 'Error' ? 'Lỗi dịch' : res.usageHint), // Fallback đơn giản
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
    if (history.length < 3) { alert("Bạn cần tra cứu ít nhất 3 từ để tạo truyện!"); return; }
    setIsLoading(true);
    try {
      const words = history.slice(0, 5).map(h => h.english);
      const story = await generateStoryFromWords(words);
      setStories(prev => [story, ...prev]);
      setActiveTool(ToolType.STORIES);
    } catch (err) {
      console.error(err);
      alert("Không thể tạo truyện. Vui lòng kiểm tra API Key.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (history.length < 4) { alert("Cần ít nhất 4 từ trong lịch sử để tạo bài kiểm tra!"); return; }
    setIsLoading(true);
    try {
      const quiz = await generateQuizFromHistory(history.slice(0, 10));
      setCurrentQuiz(quiz);
      setQuizScore(null);
      setActiveTool(ToolType.QUIZ);
    } catch (err) {
      console.error(err);
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
              <BookOpenIcon className="w-6 h-6 text-indigo-500" /> Tra cứu từ vựng
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
            className="w-full h-32 p-6 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500/20 text-lg resize-none placeholder-slate-300"
            placeholder="Nhập từ hoặc danh sách từ (cách nhau bởi dấu phẩy)..."
          />
          <button 
            onClick={handleTranslate}
            disabled={isLoading}
            className="w-full mt-4 bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "TRA CỨU NGAY"}
          </button>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="text-center">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${isConnected ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500 animate-pulse'}`}>
              <BoltIcon className="w-8 h-8" />
            </div>
            <h4 className="font-black text-slate-800">{isConnected ? "AI Sẵn sàng" : "Chưa kết nối AI"}</h4>
            <p className="text-slate-400 text-xs mt-1">
              {isConnected 
                ? "Key đã được thiết lập thành công." 
                : "Vui lòng cấu hình API_KEY trên Cloudflare để sử dụng."}
            </p>
          </div>
          <button 
            onClick={handleConnectAPI}
            className={`w-full py-3 mt-6 rounded-xl font-black text-sm transition-all ${isConnected ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}
          >
            {isConnected ? "KIỂM TRA LẠI" : "KẾT NỐI API"}
          </button>
        </div>
      </div>

      {translatedResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {translatedResults.map((res, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
               <div className="flex justify-between items-start mb-4">
                <span className="text-3xl">{res.emoji}</span>
                <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-1 rounded">{res.partOfSpeech}</span>
              </div>
              <h4 className="text-xl font-black text-slate-800">{res.english}</h4>
              <p className="text-indigo-400 font-bold text-sm mb-4">{res.phonetic}</p>
              <p className="text-slate-500 text-sm italic">"{res.usageHint}"</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-slate-400" /> Lịch sử tra cứu
          </h3>
          <div className="flex gap-2">
            <button onClick={handleCreateStory} className="text-xs font-black bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl hover:bg-indigo-100">VIẾT TRUYỆN AI</button>
            <button onClick={handleStartQuiz} className="text-xs font-black bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-100">LÀM KIỂM TRA</button>
          </div>
        </div>
        {history.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {history.slice(0, 10).map(item => (
              <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm truncate">{item.english}</p>
                <p className="text-slate-400 text-xs truncate">{item.vietnamese}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-slate-300 italic">Chưa có dữ liệu tra cứu</p>
        )}
      </div>
    </div>
  );

  const renderStories = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <SparklesIcon className="w-8 h-8 text-indigo-500" /> Truyện AI Thông Minh
        </h2>
        <button onClick={() => setActiveTool(ToolType.DASHBOARD)} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl">Quay lại Dashboard</button>
      </div>
      {stories.length > 0 ? (
        stories.map(story => (
          <div key={story.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">English Context</h4>
                  <p className="text-slate-700 leading-relaxed font-medium text-lg">{story.content}</p>
                </div>
                <div className="space-y-4 bg-slate-50 p-6 rounded-2xl">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Bản dịch tiếng Việt</h4>
                  <p className="text-slate-500 leading-relaxed italic">{story.vietnameseContent}</p>
                </div>
             </div>
             <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50">
                {story.vocabularyUsed.map((v, i) => (
                  <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-500">#{v}</span>
                ))}
             </div>
          </div>
        ))
      ) : (
        <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
          <p className="text-slate-400 font-bold">Bạn chưa có câu chuyện nào.</p>
        </div>
      )}
    </div>
  );

  const renderQuiz = () => (
    <div className="max-w-3xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-800">Kiểm tra từ vựng</h2>
        <p className="text-slate-400">Dựa trên từ vựng bạn vừa học</p>
      </div>
      {currentQuiz.length > 0 ? (
        <div className="space-y-6">
          {currentQuiz.map((q, idx) => (
            <div key={q.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
              <h4 className="text-lg font-bold text-slate-800">Câu {idx + 1}: {q.question}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {q.options.map((opt, i) => (
                  <button 
                    key={i} 
                    onClick={() => {
                      if (opt === q.correctAnswer) alert("Chính xác! 🎉");
                      else alert(`Sai rồi, đáp án đúng là: ${q.correctAnswer}`);
                    }}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left font-medium text-slate-600"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setActiveTool(ToolType.DASHBOARD)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">HOÀN THÀNH</button>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
           <AcademicCapIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
           <p className="text-slate-400 font-bold">Bắt đầu bài kiểm tra ngay!</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden">
      <Sidebar 
        activeTool={activeTool} 
        onSelect={setActiveTool} 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto p-8 md:p-12 relative">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-black tracking-tighter">StudyWith<span className="text-indigo-600">TNP</span></h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Học tiếng Anh thông minh cùng AI</p>
          </div>
          <div className="flex items-center gap-4">
             <div className={`px-4 py-2 rounded-full text-[10px] font-black tracking-widest border transition-all ${isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                {isConnected ? 'API SẴN SÀNG' : 'THIẾU API KEY'}
             </div>
             <button onClick={handleConnectAPI} title="Cấu hình API" className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600"><BoltIcon className="w-5 h-5" /></button>
          </div>
        </header>

        {activeTool === ToolType.DASHBOARD && renderDashboard()}
        {activeTool === ToolType.STORIES && renderStories()}
        {activeTool === ToolType.QUIZ && renderQuiz()}
        {activeTool === ToolType.HISTORY && renderDashboard()}

        <footer className="mt-20 py-8 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-300 tracking-widest uppercase">
          <p>&copy; 2024 TNP LANGUAGE PLATFORM</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-indigo-600">Privacy</a>
            <a href="#" className="hover:text-indigo-600">Terms</a>
          </div>
        </footer>
      </main>
      <Mascot isSpeaking={false} onSpeak={() => {}} />
    </div>
  );
};

export default App;
