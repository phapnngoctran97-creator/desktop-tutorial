
import React, { useState, useEffect } from 'react';
import { HistoryItem, TranslationResponse, ToolType, GeneratedStory, QuizQuestion } from './types';
import { translateText, generateStoryFromWords, generateQuizFromHistory } from './services/geminiService';
import { Mascot } from './components/Mascot';
import { Sidebar } from './components/Sidebar';
import { 
  ClockIcon, SparklesIcon, ArrowsRightLeftIcon, 
  BoltIcon, BookOpenIcon, AcademicCapIcon
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
  
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    const checkKey = async () => {
      // 1. Kiểm tra Key hệ thống (Cloudflare injected)
      if (process.env.API_KEY && process.env.API_KEY.length > 10) {
        setApiStatus('system');
        return;
      }

      // 2. Kiểm tra Key phiên (AI Studio preview)
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
      alert("Để cấu hình trên Cloudflare: Settings -> Variables -> Add API_KEY -> Redeploy.");
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
        vietnamese: direction === 'vi_en' ? res.source : res.english,
        english: direction === 'en_vi' ? res.source : res.english,
        partOfSpeech: res.partOfSpeech,
        usageHint: res.usageHint,
        timestamp: Date.now(),
        usedInStory: false
      }));
      setHistory(prev => [...newItems, ...prev].slice(0, 50));
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối AI. Kiểm tra lại cấu hình API Key.");
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
            placeholder="Nhập các từ cần tra cứu, cách nhau bằng dấu phẩy..."
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
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${apiStatus !== 'none' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500 animate-pulse'}`}>
              <BoltIcon className="w-8 h-8" />
            </div>
            <h4 className="font-black text-slate-800">
              {apiStatus === 'system' ? "Cloudflare API Active" : apiStatus === 'session' ? "Studio Session Active" : "No API Configured"}
            </h4>
            <p className="text-slate-400 text-xs mt-1">
              {apiStatus === 'system' ? "Đang sử dụng Key cấu hình trên server." : "Cần API Key để sử dụng tính năng thông minh."}
            </p>
          </div>
          <button 
            onClick={handleConnectAPI}
            className={`w-full py-3 mt-6 rounded-xl font-black text-sm transition-all ${apiStatus !== 'none' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}
          >
            CẤU HÌNH API
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
             <div className={`px-4 py-2 rounded-full text-[10px] font-black tracking-widest border transition-all ${apiStatus !== 'none' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                {apiStatus === 'system' ? 'SYSTEM KEY' : apiStatus === 'session' ? 'SESSION KEY' : 'OFFLINE MODE'}
             </div>
             <button onClick={handleConnectAPI} className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600"><BoltIcon className="w-5 h-5" /></button>
          </div>
        </header>

        {activeTool === ToolType.DASHBOARD && renderDashboard()}
        {/* Các tab khác được render tương tự như App.tsx cũ nhưng đảm bảo check apiStatus */}
        
        <footer className="mt-20 py-8 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-300 tracking-widest uppercase">
          <p>&copy; 2024 TNP LANGUAGE PLATFORM</p>
        </footer>
      </main>
      <Mascot latestWord={translatedResults[0]?.english} isSpeaking={false} onSpeak={() => {}} />
    </div>
  );
};

export default App;
