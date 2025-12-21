
import React from 'react';
import { ToolType } from '../types';
import { 
  LayoutDashboard, 
  LanguageIcon, 
  BookOpenIcon, 
  SparklesIcon, 
  ClipboardDocumentCheckIcon, 
  ChevronLeftIcon,
  ChevronRightIcon
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
    <aside className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col z-50 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between h-20">
        {!isCollapsed && <span className="font-extrabold text-blue-600 truncate text-lg">VocaStory AI</span>}
        <button onClick={onToggleCollapse} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
          {isCollapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative ${
              activeTool === item.id 
                ? 'bg-blue-50 text-blue-600 font-bold shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <item.icon className={`w-6 h-6 shrink-0 ${activeTool === item.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
            {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex flex-col items-center justify-center py-2 opacity-50 grayscale hover:grayscale-0 transition-all cursor-default">
           {!isCollapsed && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Powered by</span>}
           <div className="font-black text-gray-800 text-xs">Gemini 3</div>
        </div>
      </div>
    </aside>
  );
};
