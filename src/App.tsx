
import React, { useState, useEffect } from 'react';
import { HistoryItem, TranslationResponse, ToolType } from './types';
import { translateText } from './services/geminiService';
import { Mascot } from './components/Mascot';
import { Sidebar } from './components/Sidebar';
import { 
  BookOpenIcon, ClockIcon, SparklesIcon, ArrowsRightLeftIcon, ChevronRightIcon, Cog6ToothIcon, TrophyIcon, LockClosedIcon, LightBulbIcon, BoltIcon
} from './components/Icons';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inputText, setInputText] = useState('');
  const [translatedResult, setTranslatedResult] = useState<TranslationResponse | null>(null);
  const [direction, setDirection] = useState<'vi_en' | 'en_vi'>('en_vi');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingTranslate, setIsLoadingTranslate] = useState(false);
  const [energy, setEnergy] = useState(100);
  const [isKeyConfigured, setIsKeyConfigured] = useState<boolean>(false);

  // Kiểm tra trạng thái API Key khi khởi chạy nhưng không chặn UI
  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setIsKeyConfigured(hasKey);
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setIsKeyConfigured(true);
    } catch (err) {
      console.error("Lỗi khi mở trình chọn Key:", err);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    // Nếu chưa có key, yêu cầu người dùng chọn trước
    if (!isKeyConfigured) {
      handleConnectKey();
      return;
    }

    setIsLoadingTranslate(true);
    try {
      const res = await translateText(inputText, direction);
      setTranslatedResult(res);
      if (res && res.english && !res.english.startsWith('Lỗi')) {
        setHistory(prev => [{
          id: Date.now().toString(),
          vietnamese: direction === 'vi_en' ? inputText : res.english,
          english: direction === 'en_vi' ? inputText : res.english,
          partOfSpeech: res.partOfSpeech,
          usageHint: res.usageHint,
          timestamp: Date.now(),
          usedInStory: false
        }, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally { 
      setIsLoadingTranslate(false); 
    }
  };

  const renderToolContent = () => {
    switch (activeTool) {
      case ToolType.DASHBOARD:
        return (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Banner yêu cầu API nếu chưa có */}
            {!isKeyConfigured && (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                    <LightBulbIcon className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">Chưa kết nối Gemini API</h4>
                    <p className="text-amber-700 text-sm">Vui lòng kết nối API key để sử dụng đầy đủ các tính năng thông minh.</p>
                  </div>
                </div>
                <button 
                  onClick={handleConnectKey}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-600/20 whitespace-nowrap"
                >
                  Kết nối ngay
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-blue-500/5 transition-all">
                 <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                   <TrophyIcon className="w-6 h-6 text-blue-600" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-800 mb-3">Sẵn sàng học tập?</h3>
                 <p className="text-slate-500 leading-relaxed mb-8">Hãy bắt đầu hành trình chinh phục tiếng Anh bằng cách dịch các từ vựng mới và lưu chúng vào kho lưu trữ cá nhân.</p>
                 <button 
                  onClick={() => setActiveTool(ToolType.TRANSLATE)}
                  className="w-full bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg flex items-center justify-center gap-2 group"
                 >
                   Bắt đầu dịch ngay
                   <ChevronRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                 <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                   <ClockIcon className="w-6 h-6 text-blue-500" /> Hoạt động gần đây
                 </h3>
                 {history.length > 0 ? (
                   <ul className="space-y-4">
                      {history.slice(0, 4).map(item => (
                        <li key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{item.english}</span>
                            <span className="text-slate-400 text-xs">{item.vietnamese}</span>
                          </div>
                          <span className="text-[10px] bg-white border px-2 py-1 rounded-lg text-blue-500 font-black uppercase tracking-tighter">{item.partOfSpeech}</span>
                        </li>
                      ))}
                   </ul>
                 ) : (
                   <div className="flex flex-col items-center justify-center py-10 opacity-30 grayscale">
                      <BookOpenIcon className="w-16 h-16 mb-4" />
                      <p className="text-slate-500 italic">Chưa có dữ liệu</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
        );
      case ToolType.TRANSLATE:
        return (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 relative overflow-hidden">
               <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl"></div>
               <textarea 
                  className="w-full p-4 text-2xl font-medium border-none focus:ring-0 outline-none min-h-[180px] resize-none text-slate-800 placeholder-slate-300"
                  placeholder={direction === 'en_vi' ? "Type something in English..." : "Nhập câu tiếng Việt..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
               />
               <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-slate-50 gap-4">
                  <button 
                    onClick={() => setDirection(d => d === 'en_vi' ? 'vi_en' : 'en_vi')} 
                    className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl text-slate-600 font-bold hover:bg-slate-100 transition-colors border border-slate-100"
                  >
                    <ArrowsRightLeftIcon className="w-5 h-5 text-blue-500" />
                    {direction === 'en_vi' ? 'English to Vietnamese' : 'Vietnamese to English'}
                  </button>
                  <button 
                    onClick={handleTranslate} 
                    disabled={isLoadingTranslate} 
                    className="w-full sm:w-auto bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                  >
                    {isLoadingTranslate ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (isKeyConfigured ? 'Dịch ngay' : 'Kết nối API & Dịch')}
                  </button>
               </div>
            </div>

            {translatedResult && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 rounded-[2.5rem] text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                   <SparklesIcon className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <h3 className="text-5xl font-black tracking-tight">{translatedResult.english}</h3>
                    <span className="text-4xl">{translatedResult.emoji}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mb-8">
                    <p className="text-blue-100 font-mono text-2xl bg-white/10 px-4 py-1 rounded-xl backdrop-blur-sm">{translatedResult.phonetic}</p>
                    <span className="bg-yellow-400 text-slate-900 px-3 py-1 rounded-lg text-xs font-black uppercase">{translatedResult.partOfSpeech}</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 max-w-2xl">
                    <p className="text-blue-50 text-lg leading-relaxed italic">
                      <span className="font-black text-white not-italic mr-2">Tip:</span>
                      "{translatedResult.usageHint}"
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case ToolType.HISTORY:
        return (
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in duration-700">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                 <BookOpenIcon className="w-9 h-9 text-blue-600" /> Thư viện từ vựng
              </h2>
              <div className="text-slate-400 font-bold text-sm bg-slate-50 px-4 py-2 rounded-xl">
                {history.length} từ đã lưu
              </div>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                <p className="text-slate-400 text-lg font-medium">Danh sách của bạn đang trống.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map(item => (
                  <div key={item.id} className="group p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <span className="font-black text-2xl text-slate-800 group-hover:text-blue-600 transition-colors">{item.english}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-500 uppercase font-bold">{item.partOfSpeech}</span>
                    </div>
                    <p className="text-slate-600 font-bold mb-4">{item.vietnamese}</p>
                    <div className="h-px bg-slate-50 w-full mb-4"></div>
                    <p className="text-xs text-slate-400 italic leading-relaxed line-clamp-2">"{item.usageHint}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-200 animate-in zoom-in duration-500">
             <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-5xl">🚀</div>
             <h3 className="text-2xl font-black text-slate-800 mb-4">Tính năng sắp ra mắt!</h3>
             <p className="text-slate-400 font-medium max-w-sm mx-auto mb-10">Chúng tôi đang hoàn thiện công nghệ AI để mang đến cho bạn trải nghiệm học tập tốt nhất.</p>
             <button onClick={() => setActiveTool(ToolType.DASHBOARD)} className="text-blue-600 font-black hover:bg-blue-50 px-8 py-3 rounded-2xl transition-all">Quay lại Dashboard</button>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-['Inter']">
      <Sidebar 
        activeTool={activeTool} 
        onSelect={setActiveTool} 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none"></div>
        <div className="max-w-6xl mx-auto p-8 md:p-12 relative z-10">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">VocaStory <span className="text-blue-600">AI</span></h1>
              <p className="text-slate-400 font-bold text-sm mt-1">Nền tảng học tiếng Anh cá nhân hóa</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span className="font-black text-slate-700 text-sm tracking-widest">{energy}% ENERGY</span>
               </div>
               <button 
                 onClick={handleConnectKey}
                 className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all shadow-lg ${isKeyConfigured ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white animate-pulse shadow-blue-600/20'}`}
               >
                  <BoltIcon className={`w-5 h-5 ${isKeyConfigured ? 'text-blue-400' : 'text-white'}`} />
                  {isKeyConfigured ? 'Connected' : 'Connect Key'}
               </button>
            </div>
          </header>
          <div className="min-h-[calc(100vh-250px)]">
            {renderToolContent()}
          </div>
          <footer className="mt-20 py-10 border-t border-slate-200/60 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-sm font-bold">
            <p>&copy; 2024 VocaStory AI. Build your English daily.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Feedback</a>
            </div>
          </footer>
        </div>
      </main>
      <Mascot isSpeaking={false} onSpeak={() => alert("Học cùng TNP nhé!")} />
    </div>
  );
};

export default App;
