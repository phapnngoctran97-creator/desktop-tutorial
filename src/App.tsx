
import React, { useState, useEffect } from 'react';
import { HistoryItem, TranslationResponse, ToolType } from './types';
import { translateText } from './services/geminiService';
import { Mascot } from './components/Mascot';
import { Sidebar } from './components/Sidebar';
import { 
  BookOpenIcon, ClockIcon, SparklesIcon, ArrowsRightLeftIcon, ChevronRightIcon, Cog6ToothIcon, TrophyIcon, LockClosedIcon, LightBulbIcon, BoltIcon, CheckCircleIcon, XCircleIcon
} from './components/Icons';

// Fix: Khai báo kiểu cho window.aistudio để tránh lỗi TypeScript conflict với môi trường platform
// Sử dụng kiểu AIStudio như thông báo lỗi yêu cầu và đảm bảo tính tương thích
declare global {
  interface AIStudio {
    hasSelectedApiKey(): Promise<boolean>;
    openSelectKey(): Promise<void>;
  }

  interface Window {
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inputText, setInputText] = useState('');
  const [translatedResult, setTranslatedResult] = useState<TranslationResponse | TranslationResponse[] | null>(null);
  const [direction, setDirection] = useState<'vi_en' | 'en_vi'>('en_vi');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingTranslate, setIsLoadingTranslate] = useState(false);
  const [isKeyConfigured, setIsKeyConfigured] = useState<boolean>(false);

  // Kiểm tra trạng thái API Key định kỳ từ AI Studio
  useEffect(() => {
    const checkKeyStatus = async () => {
      try {
        if (window.aistudio) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsKeyConfigured(hasKey);
        }
      } catch (e) {
        console.debug("AI Studio environment check skipped or failed.");
      }
    };

    checkKeyStatus();
    // Kiểm tra lại mỗi 3 giây để cập nhật UI nếu người dùng đổi key
    const interval = setInterval(checkKeyStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectKey = async () => {
    try {
      if (window.aistudio) {
        // Gọi trình chọn key của AI Studio
        await window.aistudio.openSelectKey();
        // Race condition: Giả định thành công ngay sau khi mở dialog theo guideline
        setIsKeyConfigured(true);
      } else {
        console.warn("window.aistudio not found. Please use this app within the AI Studio environment.");
      }
    } catch (err) {
      console.error("Lỗi khi mở trình chọn Key:", err);
    }
  };

  const handleTranslate = async () => {
    const textToProcess = inputText.trim();
    if (!textToProcess) return;
    
    // Luôn yêu cầu kết nối key nếu chưa có trước khi dịch
    if (!isKeyConfigured) {
      await handleConnectKey();
      // Ngay cả khi chưa xác nhận hasSelectedApiKey, ta vẫn thử dịch tiếp theo logic race condition
    }

    setIsLoadingTranslate(true);
    setTranslatedResult(null);

    try {
      // Hỗ trợ tra cứu hàng loạt: Tách theo xuống dòng hoặc dấu phẩy
      const words = textToProcess
        .split(/[\n,]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);
      
      if (words.length > 1) {
        // Giới hạn 10 từ mỗi lần để đảm bảo hiệu suất
        const batch = words.slice(0, 10);
        const results = await Promise.all(batch.map(word => translateText(word, direction)));
        setTranslatedResult(results);
        
        // Lưu vào lịch sử cho từng từ thành công
        const newHistoryItems: HistoryItem[] = [];
        results.forEach((res, idx) => {
          if (res && res.english && !res.english.startsWith('Lỗi')) {
            newHistoryItems.push({
              id: `${Date.now()}-${idx}`,
              vietnamese: direction === 'vi_en' ? batch[idx] : res.english,
              english: direction === 'en_vi' ? batch[idx] : res.english,
              partOfSpeech: res.partOfSpeech,
              usageHint: res.usageHint,
              timestamp: Date.now(),
              usedInStory: false
            });
          }
        });
        setHistory(prev => [...newHistoryItems, ...prev]);
      } else {
        // Dịch đơn lẻ một từ hoặc câu
        const res = await translateText(textToProcess, direction);
        setTranslatedResult(res);
        if (res && res.english && !res.english.startsWith('Lỗi')) {
          setHistory(prev => [{
            id: Date.now().toString(),
            vietnamese: direction === 'vi_en' ? textToProcess : res.english,
            english: direction === 'en_vi' ? textToProcess : res.english,
            partOfSpeech: res.partOfSpeech,
            usageHint: res.usageHint,
            timestamp: Date.now(),
            usedInStory: false
          }, ...prev]);
        }
      }
    } catch (err) {
      console.error("Translation flow error:", err);
    } finally { 
      setIsLoadingTranslate(false); 
    }
  };

  const renderToolContent = () => {
    switch (activeTool) {
      case ToolType.DASHBOARD:
        return (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <h3 className="text-3xl font-black text-slate-800 mb-4">Xin chào! 👋</h3>
                  <p className="text-slate-500 leading-relaxed mb-6">
                    Sẵn sàng tra cứu từ vựng hàng loạt? Bạn có thể nhập danh sách từ cách nhau bằng dấu phẩy để AI giúp bạn xử lý nhanh chóng.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => setActiveTool(ToolType.TRANSLATE)}
                    className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                  >
                    Bắt đầu dịch <ChevronRightIcon className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setActiveTool(ToolType.HISTORY)}
                    className="bg-slate-100 text-slate-700 px-8 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Thư viện của tôi
                  </button>
                </div>
              </div>
              
              <div className={`p-8 rounded-[2.5rem] border transition-all flex flex-col items-center text-center justify-center gap-4 ${isKeyConfigured ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                {isKeyConfigured ? (
                  <>
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                      <CheckCircleIcon className="w-10 h-10" />
                    </div>
                    <h4 className="font-black text-emerald-900">API Đã Kết Nối</h4>
                    <p className="text-emerald-700 text-xs">AI đã sẵn sàng phục vụ bạn.</p>
                    <button onClick={handleConnectKey} className="mt-2 text-emerald-600 text-xs font-bold hover:underline">Đổi Project/Key</button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-2">
                      <BoltIcon className="w-10 h-10 animate-pulse" />
                    </div>
                    <h4 className="font-black text-amber-900">Cần Kết Nối API</h4>
                    <p className="text-amber-700 text-xs px-4">Vui lòng kết nối để sử dụng Gemini AI trả phí của bạn.</p>
                    <button 
                      onClick={handleConnectKey}
                      className="mt-4 bg-amber-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-colors"
                    >
                      Kết nối ngay
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
               <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <ClockIcon className="w-6 h-6 text-blue-500" /> Vừa tra cứu
               </h3>
               {history.length > 0 ? (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {history.slice(0, 5).map(item => (
                      <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                        <span className="font-black text-slate-800 text-lg">{item.english}</span>
                        <span className="text-slate-500 text-xs">{item.vietnamese}</span>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="py-10 text-center text-slate-300 italic font-medium">Chưa có dữ liệu tra cứu nào.</div>
               )}
            </div>
          </div>
        );
      case ToolType.TRANSLATE:
        return (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 relative overflow-hidden">
               <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>
               <div className="flex justify-between items-center mb-6">
                 <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Nhập nội dung</h4>
                 <div className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold">
                   Hỗ trợ tra cứu nhiều từ (ví dụ: apple, banana, car)
                 </div>
               </div>
               <textarea 
                  className="w-full p-4 text-2xl font-medium border-none focus:ring-0 outline-none min-h-[160px] resize-none text-slate-800 placeholder-slate-200"
                  placeholder={direction === 'en_vi' ? "Type English words here..." : "Nhập từ hoặc câu tiếng Việt..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
               />
               <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-slate-50 gap-4">
                  <button 
                    onClick={() => setDirection(d => d === 'en_vi' ? 'vi_en' : 'en_vi')} 
                    className="flex items-center gap-3 bg-slate-50 px-6 py-3.5 rounded-2xl text-slate-600 font-bold hover:bg-slate-100 transition-colors border border-slate-100"
                  >
                    <ArrowsRightLeftIcon className="w-5 h-5 text-blue-500" />
                    {direction === 'en_vi' ? 'English ➔ Việt' : 'Việt ➔ English'}
                  </button>
                  <button 
                    onClick={handleTranslate} 
                    disabled={isLoadingTranslate} 
                    className="w-full sm:w-auto bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                  >
                    {isLoadingTranslate ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : 'Bắt đầu dịch'}
                  </button>
               </div>
            </div>

            {translatedResult && (
              <div className="animate-in slide-in-from-top-4 duration-500">
                {Array.isArray(translatedResult) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {translatedResult.map((res, i) => (
                      <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 hover:border-blue-200 transition-all group">
                        <div className="text-4xl group-hover:scale-110 transition-transform">{res.emoji}</div>
                        <div>
                          <h4 className="text-2xl font-black text-blue-600 leading-tight">{res.english}</h4>
                          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">{res.partOfSpeech} • {res.phonetic}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-indigo-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-8">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <h3 className="text-5xl font-black tracking-tighter">{translatedResult.english}</h3>
                          <span className="text-5xl drop-shadow-lg">{translatedResult.emoji}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mb-8">
                          <p className="text-indigo-100 font-mono text-xl bg-white/10 px-4 py-1.5 rounded-xl backdrop-blur-sm border border-white/10">
                            {translatedResult.phonetic}
                          </p>
                          <span className="bg-yellow-400 text-slate-900 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-yellow-400/20">
                            {translatedResult.partOfSpeech}
                          </span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-7 rounded-[2rem] border border-white/10 max-w-2xl shadow-inner">
                          <p className="text-indigo-50 text-xl leading-relaxed italic">
                            <span className="font-black text-white not-italic mr-2">Tips:</span>
                            "{translatedResult.usageHint}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case ToolType.HISTORY:
        return (
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                 <BookOpenIcon className="w-9 h-9 text-blue-600" /> Thư viện của tôi
              </h2>
              <div className="text-slate-500 font-bold text-sm bg-slate-50 px-6 py-2.5 rounded-2xl border border-slate-100">
                Đã lưu {history.length} mục
              </div>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-24 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
                <p className="text-slate-400 text-lg font-bold">Thư viện đang trống. Hãy bắt đầu dịch ngay!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map(item => (
                  <div key={item.id} className="group p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/10 transition-all cursor-default">
                    <div className="flex justify-between items-start mb-4">
                      <span className="font-black text-2xl text-slate-800 group-hover:text-blue-600 transition-colors">{item.english}</span>
                      <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500 uppercase font-black tracking-widest">{item.partOfSpeech}</span>
                    </div>
                    <p className="text-slate-600 font-bold mb-4">{item.vietnamese}</p>
                    <div className="h-px bg-slate-50 w-full mb-4"></div>
                    <p className="text-xs text-slate-400 italic leading-relaxed line-clamp-3">"{item.usageHint}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="bg-white p-20 rounded-[3rem] text-center border border-slate-100 animate-in zoom-in duration-500">
             <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-5xl">⚡</div>
             <h3 className="text-3xl font-black text-slate-800 mb-4">Sắp ra mắt</h3>
             <p className="text-slate-400 font-medium max-w-sm mx-auto mb-10">Chúng tôi đang nỗ lực phát triển trí tuệ nhân tạo để mang lại trải nghiệm tốt nhất.</p>
             <button onClick={() => setActiveTool(ToolType.DASHBOARD)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-blue-600 transition-all">Quay lại Tổng quan</button>
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
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-100/20 to-transparent pointer-events-none"></div>
        <div className="max-w-6xl mx-auto p-8 md:p-12 relative z-10">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
            <div className="group">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                Study English <span className="text-blue-600 group-hover:animate-pulse">With TNP</span>
              </h1>
              <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Học tập ngữ cảnh cùng Gemini AI</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isKeyConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                  <span className="font-black text-slate-700 text-xs tracking-widest uppercase">{isKeyConfigured ? 'AI Connect OK' : 'AI Offline'}</span>
               </div>
               <button 
                 onClick={handleConnectKey}
                 className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg ${isKeyConfigured ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-blue-600 text-white animate-pulse shadow-blue-600/20 hover:scale-105'}`}
               >
                  <BoltIcon className={`w-5 h-5 ${isKeyConfigured ? 'text-blue-400' : 'text-white'}`} />
                  {isKeyConfigured ? 'Đã Cấu Hình' : 'Kết Nối API'}
               </button>
            </div>
          </header>
          <div className="min-h-[60vh]">
            {renderToolContent()}
          </div>
          <footer className="mt-24 py-12 border-t border-slate-200/60 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 text-sm font-bold uppercase tracking-widest">
            <p>&copy; 2024 TNP Language AI Studio. Practice makes perfect.</p>
            <div className="flex gap-8">
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Billing Docs</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Feedback</a>
            </div>
          </footer>
        </div>
      </main>
      <Mascot isSpeaking={false} onSpeak={() => {}} />
    </div>
  );
};

export default App;
