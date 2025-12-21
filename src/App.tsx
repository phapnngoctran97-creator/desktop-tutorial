
import React, { useState, useEffect } from 'react';
import { HistoryItem, TranslationResponse, ToolType } from './types';
import { translateText } from './services/geminiService';
import { Mascot } from './components/Mascot';
import { Sidebar } from './components/Sidebar';
import { 
  BookOpenIcon, ClockIcon, SparklesIcon, ArrowsRightLeftIcon, ChevronRightIcon, TrophyIcon, BoltIcon, CheckCircleIcon, XCircleIcon, TrashIcon
} from './components/Icons';

// Fix: Removed conflicting manual declaration of aistudio as it is already defined as AIStudio in the environment.

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inputText, setInputText] = useState('');
  const [translatedResults, setTranslatedResults] = useState<TranslationResponse[]>([]);
  const [direction, setDirection] = useState<'vi_en' | 'en_vi'>('en_vi');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyConfigured, setIsKeyConfigured] = useState<boolean>(false);

  // Kiểm tra trạng thái Key liên tục
  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore: aistudio is provided by the environment
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        try {
          // @ts-ignore
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsKeyConfigured(hasKey);
        } catch (e) {
          console.error("Error checking key:", e);
        }
      }
    };
    checkKey();
    const timer = setInterval(checkKey, 2000);
    return () => clearInterval(timer);
  }, []);

  // Fix: Assume the key selection was successful after triggering openSelectKey() as per the coding guidelines.
  const handleConnectKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        // MUST assume the key selection was successful after triggering openSelectKey()
        setIsKeyConfigured(true);
      } catch (err) {
        console.error("Failed to open key selector:", err);
      }
    } else {
      alert("Tính năng nhập Key chỉ hoạt động trong môi trường Google AI Studio.");
    }
  };

  const handleBatchTranslate = async () => {
    const text = inputText.trim();
    if (!text) return;
    
    if (!isKeyConfigured) {
      handleConnectKey();
      return;
    }

    setIsLoading(true);
    setTranslatedResults([]);

    try {
      // Tách từ theo dấu phẩy, chấm phẩy hoặc xuống dòng
      const words = text.split(/[,\n;]+/).map(w => w.trim()).filter(w => w.length > 0);
      
      // Xử lý dịch từng từ (Tối đa 5 từ/lần để tránh timeout)
      const limit = words.slice(0, 10);
      const results = await Promise.all(limit.map(async (word) => {
        const res = await translateText(word, direction);
        return { ...res, sourceText: word };
      }));

      setTranslatedResults(results);

      // Cập nhật lịch sử
      const newItems: HistoryItem[] = results.map((res, idx) => ({
        id: `${Date.now()}-${idx}`,
        vietnamese: direction === 'vi_en' ? limit[idx] : res.english,
        english: direction === 'en_vi' ? limit[idx] : res.english,
        partOfSpeech: res.partOfSpeech,
        usageHint: res.usageHint,
        timestamp: Date.now(),
        usedInStory: false
      }));

      setHistory(prev => [...newItems, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Xóa toàn bộ lịch sử từ vựng?")) setHistory([]);
  };

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Phần nhập liệu tra cứu hàng loạt */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-800">Tra cứu nhanh</h3>
            <button 
              onClick={() => setDirection(d => d === 'en_vi' ? 'vi_en' : 'en_vi')}
              className="text-xs font-black bg-blue-50 text-blue-600 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              <ArrowsRightLeftIcon className="w-4 h-4" />
              {direction === 'en_vi' ? 'ANH - VIỆT' : 'VIỆT - ANH'}
            </button>
          </div>
          
          <textarea 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-40 p-6 bg-slate-50 rounded-3xl border-none focus:ring-2 focus:ring-blue-500/20 text-xl font-medium resize-none placeholder-slate-300"
            placeholder="Nhập danh sách từ vựng (cách nhau bằng dấu phẩy)..."
          />
          
          <button 
            onClick={handleBatchTranslate}
            disabled={isLoading}
            className="w-full mt-6 bg-slate-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-600 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <SparklesIcon className="w-6 h-6 text-blue-400" />
                TRA CỨU HÀNG LOẠT
              </>
            )}
          </button>
        </div>

        {/* Trạng thái AI & Key */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-inner ${isKeyConfigured ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
            <BoltIcon className={`w-10 h-10 ${isKeyConfigured ? '' : 'animate-pulse'}`} />
          </div>
          <div>
            <h4 className="font-black text-xl text-slate-800">
              {isKeyConfigured ? "AI Đã Sẵn Sàng" : "Chưa Có Kết Nối"}
            </h4>
            <p className="text-slate-400 text-sm mt-1">
              {isKeyConfigured ? "Hệ thống đang sử dụng Key của bạn." : "Vui lòng nhập Key để bắt đầu dịch."}
            </p>
          </div>
          <button 
            onClick={handleConnectKey}
            className={`w-full py-4 rounded-2xl font-black transition-all ${isKeyConfigured ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-600/20'}`}
          >
            {isKeyConfigured ? "ĐỔI API KEY" : "NHẬP API KEY"}
          </button>
        </div>
      </div>

      {/* Kết quả dịch */}
      {translatedResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8 duration-500">
          {translatedResults.map((res, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{res.emoji}</span>
                <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{res.partOfSpeech}</span>
              </div>
              <h4 className="text-2xl font-black text-slate-800">{res.english}</h4>
              <p className="text-blue-600 font-bold mb-3">{res.phonetic}</p>
              <div className="h-px bg-slate-50 w-full mb-3"></div>
              <p className="text-slate-500 text-sm italic">"{res.usageHint}"</p>
            </div>
          ))}
        </div>
      )}

      {/* Hoạt động gần đây */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <ClockIcon className="w-6 h-6 text-blue-500" /> Hoạt động gần đây
          </h3>
          {history.length > 0 && (
            <button onClick={clearHistory} className="text-slate-300 hover:text-red-500 transition-colors">
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {history.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {history.slice(0, 10).map(item => (
              <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
                <span className="font-black text-slate-800">{item.english}</span>
                <span className="text-slate-400 text-xs truncate">{item.vietnamese}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-300 italic font-medium">Chưa có dữ liệu tra cứu</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-['Inter']">
      <Sidebar 
        activeTool={activeTool} 
        onSelect={setActiveTool} 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-100/20 to-transparent pointer-events-none"></div>
        <div className="max-w-6xl mx-auto p-8 md:p-12 relative z-10">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">VocaStory <span className="text-blue-600">AI</span></h1>
              <p className="text-slate-400 font-bold text-sm mt-1">Học tập từ vựng hàng loạt thông minh</p>
            </div>
            
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
              <div className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest ${isKeyConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {isKeyConfigured ? 'AI ONLINE' : 'AI OFFLINE'}
              </div>
              <button 
                onClick={handleConnectKey}
                className={`p-2 rounded-xl transition-all ${isKeyConfigured ? 'text-slate-400 hover:text-blue-600' : 'text-blue-600 bg-blue-50 animate-pulse'}`}
                title="Quản lý API Key"
              >
                <BoltIcon className="w-6 h-6" />
              </button>
            </div>
          </header>

          <div className="min-h-[70vh]">
            {activeTool === ToolType.DASHBOARD ? renderDashboard() : (
              <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400 text-xl font-bold">Vui lòng sử dụng tính năng tại Dashboard chính.</p>
                <button onClick={() => setActiveTool(ToolType.DASHBOARD)} className="mt-6 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold">Về Dashboard</button>
              </div>
            )}
          </div>

          <footer className="mt-20 py-10 border-t border-slate-200/60 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-xs font-black tracking-widest">
            <p>&copy; 2024 TNP LANGUAGE AI. TRẢI NGHIỆM HỌC TẬP THẾ HỆ MỚI.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-blue-600 transition-colors">PRIVACY</a>
              <a href="#" className="hover:text-blue-600 transition-colors">TERMS</a>
            </div>
          </footer>
        </div>
      </main>
      <Mascot isSpeaking={false} onSpeak={() => {}} />
    </div>
  );
};

export default App;
