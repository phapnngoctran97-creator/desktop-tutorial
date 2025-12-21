
import React from 'react';
import { ToolType } from '../types';
import { 
  LayoutDashboard, 
  LanguageIcon, 
  BookOpenIcon, 
  SparklesIcon, 
  ClipboardDocumentCheckIcon, 
  ChevronLeftIcon,
  ChevronRightIcon,
  TrophyIcon
} from './Icons';

interface SidebarProps {
  activeTool: ToolType;
  onSelect: (tool: ToolType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTool, 
  onSelect, 
  isCollapsed, 
  onToggleCollapse
}) => {
  const menuItems = [
    { id: ToolType.DASHBOARD, label: 'Tổng quan', icon: LayoutDashboard },
    { id: ToolType.TRANSLATE, label: 'Phiên dịch', icon: LanguageIcon },
    { id: ToolType.HISTORY, label: 'Từ vựng', icon: BookOpenIcon },
    { id: ToolType.STORIES, label: 'Truyện AI', icon: SparklesIcon },
    { id: ToolType.QUIZ, label: 'Kiểm tra', icon: ClipboardDocumentCheckIcon },
  ];

  return (
    <aside className={`
      bg-[#0f172a] border-r border-slate-800 transition-all duration-500 flex flex-col z-50 shadow-2xl
      ${isCollapsed ? 'w-20' : 'w-72'}
    `}>
      {/* Header / Logo */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800/50">
        {!isCollapsed && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-white tracking-tight text-xl">Voca<span className="text-blue-500">AI</span></span>
          </div>
        )}
        {isCollapsed && (
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
             <SparklesIcon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`
                w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden
                ${isActive 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 translate-x-1' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }
              `}
            >
              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"></div>
              )}
              
              <item.icon className={`
                w-6 h-6 shrink-0 transition-transform duration-300 group-hover:scale-110
                ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}
              `} />
              
              {!isCollapsed && (
                <span className="text-sm font-semibold tracking-wide truncate">{item.label}</span>
              )}

              {/* Tooltip for collapsed mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-slate-800 shadow-2xl transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Level Status */}
      <div className="p-5 border-t border-slate-800/50 bg-slate-900/30">
        {!isCollapsed ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <TrophyIcon className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Rank</span>
                <span className="text-sm text-white font-bold">Newbie Learner</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-full w-1/3 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <TrophyIcon className="w-6 h-6 text-yellow-500 opacity-50 hover:opacity-100 transition-opacity cursor-pointer" />
          </div>
        )}

        <button 
          onClick={onToggleCollapse}
          className="mt-6 w-full flex items-center justify-center p-2 rounded-xl border border-slate-800 text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
        >
          {isCollapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
};
