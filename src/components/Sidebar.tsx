
import React from 'react';
import { ToolType } from '../types';
import { 
  LanguageIcon, 
  SparklesIcon, 
  ClipboardDocumentCheckIcon, 
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon
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
    { id: ToolType.DASHBOARD, label: 'Bảng điều khiển', icon: LanguageIcon },
    { id: ToolType.STORIES, label: 'Truyện AI', icon: SparklesIcon },
    { id: ToolType.QUIZ, label: 'Kiểm tra', icon: ClipboardDocumentCheckIcon },
    { id: ToolType.HISTORY, label: 'Lịch sử', icon: ClockIcon },
  ];

  return (
    <aside className={`
      bg-white border-r border-slate-100 transition-all duration-500 flex flex-col z-50 shadow-sm
      ${isCollapsed ? 'w-20' : 'w-64'}
    `}>
      <div className="h-24 flex items-center px-6 border-b border-slate-50 overflow-hidden">
        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
           <SparklesIcon className="w-6 h-6 text-white" />
        </div>
        {!isCollapsed && <span className="ml-4 font-black text-xl tracking-tighter text-slate-800">TNP AI</span>}
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-6">
        {menuItems.map((item) => {
          const isActive = activeTool === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`
                w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group relative
                ${isActive 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' 
                  : 'text-slate-400 hover:bg-slate-50'
                }
              `}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-300'}`} />
              {!isCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-50">
        <button 
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-3 rounded-2xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
        >
          {isCollapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
};
