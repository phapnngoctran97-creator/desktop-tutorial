
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HistoryItem, GeneratedStory, WordDefinition, TranslationResponse, WordSuggestion, QuizQuestion, GrammarPoint, ToolType } from './types';
import { translateText, generateStoryFromWords, lookupWord, generateSpeech, getWordSuggestions, generateQuizFromWords } from './services/geminiService';
import { Mascot } from './components/Mascot';
import { Sidebar } from './components/Sidebar';
import { 
  BookOpenIcon, LanguageIcon, ClockIcon, SparklesIcon, TrashIcon, SpeakerWaveIcon, PauseIcon, XMarkIcon, AcademicCapIcon, ArrowsRightLeftIcon, ClipboardDocumentCheckIcon, CheckCircleIcon, XCircleIcon, ChevronDownIcon, PencilSquareIcon, TrophyIcon, BoltIcon, MicrophoneIcon, Cog6ToothIcon, EyeIcon, EyeSlashIcon, ChevronLeftIcon, ChevronRightIcon, LockClosedIcon, LightBulbIcon
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
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                 <TrophyIcon className="w-6 h-6 text-yellow-500" /> Tiến độ học tập
               </h3>
               <p className="text-gray-500">Chào mừng bạn trở lại! Hãy bắt đầu bằng việc dịch một từ mới hoặc xem lại kho từ vựng.</p>
               <button 
                onClick={() => setActiveTool(ToolType.TRANSLATE)}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm"
               >Bắt đầu ngay</button>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                 <ClockIcon className="w-6 h-6 text-blue-500" /> Lịch sử gần đây
               </h3>
               {history.length > 0 ? (
                 <ul className="space-y-3">
                    {history.slice(0, 3).map(item => (
                      <li key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-bold">{item.english}</span>
                        <span className="text-gray-500 text-sm">{item.vietnamese}</span>
                      </li>
                    ))}
                 </ul>
               ) : (
                 <p className="text-gray-400 italic">Chưa có lịch sử học tập nào.</p>
               )}
            </div>
          </div>
        );
      case ToolType.TRANSLATE:
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
               <textarea 
                  className="w-full p-4 text-xl border-none focus:ring-0 outline-none min-h-[150px] resize-none"
                  placeholder={direction === 'en_vi' ? "Nhập tiếng Anh..." : "Nhập tiếng Việt..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
               />
               <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-0">
                  <button onClick={() => setDirection(d => d === 'en_vi' ? 'vi_en' : 'en_vi')} className="flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600">
                    <ArrowsRightLeftIcon className="w-5 h-5" /> {direction === 'en_vi' ? 'EN ➔ VI' : 'VI ➔ EN'}
                  </button>
                  <button onClick={handleTranslate} disabled={isLoadingTranslate} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md flex items-center gap-2">
                    {isLoadingTranslate ? 'Đang dịch...' : 'Dịch ngay'}
                  </button>
               </div>
            </div>
            {translatedResult && (
              <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100 animate-fade-in shadow-sm">
                <h3 className="text-4xl font-bold text-gray-800 mb-2">{translatedResult.english} {translatedResult.emoji}</h3>
                <p className="text-blue-600 font-mono text-xl mb-4">{translatedResult.phonetic}</p>
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm inline-block">
                  <span className="font-bold text-blue-700 uppercase text-xs mr-2">{translatedResult.partOfSpeech}</span>
                  <span className="text-gray-600">💡 {translatedResult.usageHint}</span>
                </div>
              </div>
            )}
          </div>
        );
      case ToolType.HISTORY:
        return (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
               <BookOpenIcon className="w-7 h-7 text-blue-500" /> Kho từ vựng của bạn
            </h2>
            {history.length === 0 ? (
              <div className="text-center py-10 text-gray-400">Bạn chưa có từ vựng nào trong danh sách.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map(item => (
                  <div key={item.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow bg-gray-50/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-lg text-blue-600">{item.english}</span>
                      <span className="text-[10px] bg-white border px-2 py-0.5 rounded text-gray-400 uppercase font-bold">{item.partOfSpeech}</span>
                    </div>
                    <p className="text-gray-700 font-medium">{item.vietnamese}</p>
                    {item.usageHint && <p className="text-xs text-gray-400 mt-2 italic">"{item.usageHint}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="bg-white p-20 rounded-2xl text-center border border-dashed border-gray-200">
             <div className="text-4xl mb-4">🚀</div>
             <p className="text-gray-400 font-medium text-lg">Tính năng này sẽ sớm ra mắt trong bản cập nhật tới!</p>
             <button onClick={() => setActiveTool(ToolType.DASHBOARD)} className="mt-6 text-blue-600 font-bold hover:underline">Quay về trang chính</button>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        activeTool={activeTool} 
        onSelect={setActiveTool} 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">VocaStory AI <span className="text-blue-600">English</span></h1>
          <div className="flex items-center gap-4">
             <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
                <BoltIcon className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-gray-700">{energy}%</span>
             </div>
          </div>
        </header>
        {renderToolContent()}
      </main>
      <Mascot isSpeaking={!!activeAudioId} onSpeak={() => alert("Xin chào! Hãy cùng khám phá thế giới từ vựng tiếng Anh nhé.")} />
    </div>
  );
};

export default App;
