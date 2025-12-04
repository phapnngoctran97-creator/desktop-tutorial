
import React, { useState, useEffect } from 'react';

interface MascotProps {
  latestWord?: string;
  isSpeaking: boolean;
  onSpeak: () => void;
}

export const Mascot: React.FC<MascotProps> = ({ latestWord, isSpeaking, onSpeak }) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [showBubble, setShowBubble] = useState(true);

  // Blink logic
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 4000);
    return () => clearInterval(blinkInterval);
  }, []);

  // Show bubble initially
  useEffect(() => {
    setShowBubble(true);
    // Auto hide bubble after 5s if not speaking, but show again on hover (via CSS group)
    const timer = setTimeout(() => setShowBubble(false), 5000);
    return () => clearTimeout(timer);
  }, [latestWord, isSpeaking]);

  return (
    <div className="fixed bottom-6 right-4 md:bottom-10 md:right-10 z-50 flex flex-col items-end">
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes talk {
            0%, 100% { height: 4px; }
            50% { height: 12px; }
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
          .animate-talk {
            animation: talk 0.2s ease-in-out infinite;
          }
        `}
      </style>

      {/* Container for click interaction */}
      <div 
        onClick={onSpeak}
        className="relative cursor-pointer group animate-float transition-transform active:scale-95"
        title="Click để nghe ôn tập từ vựng hôm nay!"
      >
        {/* Speech Bubble - Positioned to the LEFT of the robot now */}
        <div className={`absolute right-[110%] top-0 mr-2 bg-white px-4 py-3 rounded-2xl rounded-tr-none shadow-xl border border-indigo-100 transition-all duration-500 w-48 text-right flex items-center justify-end ${showBubble || isSpeaking ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto'}`}>
          <p className="text-xs md:text-sm font-bold text-indigo-600 leading-snug">
            {isSpeaking ? "Đang đọc danh sách từ..." : "Hello, I'm TNP Robot"}
          </p>
        </div>

        {/* The 3D Robot Head */}
        <div className="w-20 h-20 md:w-24 md:h-24 relative">
            {/* Shadow */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-14 h-3 bg-black/20 rounded-[50%] blur-sm transition-all duration-300 group-hover:w-10 group-hover:blur-md"></div>

            {/* Main Head Shape - 3D Gradient */}
            <div className="w-full h-full bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 rounded-3xl shadow-2xl relative overflow-hidden border-t border-white/30 border-l border-white/20 ring-2 ring-white/10">
                
                {/* Glossy Reflection */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                
                {/* Antenna */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full shadow-lg transition-colors duration-300 ${isSpeaking ? 'bg-red-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                    <div className="w-0.5 h-3 bg-gray-400"></div>
                </div>

                {/* Face Screen */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-12 md:w-16 md:h-14 bg-gray-900 rounded-xl flex flex-col items-center justify-center gap-2 shadow-inner border border-white/10">
                    
                    {/* Eyes */}
                    <div className="flex gap-3">
                        <div className={`w-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-100 ${isBlinking ? 'h-0.5 mt-1.5' : 'h-4'}`}></div>
                        <div className={`w-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-100 ${isBlinking ? 'h-0.5 mt-1.5' : 'h-4'}`}></div>
                    </div>

                    {/* Mouth */}
                    {isSpeaking ? (
                         <div className="w-6 h-1 bg-white/20 rounded-full overflow-hidden flex items-center justify-center gap-0.5">
                             <div className="w-full bg-cyan-300 rounded-full animate-talk"></div>
                         </div>
                    ) : (
                        <div className="w-4 h-1 bg-white/20 rounded-full"></div>
                    )}
                </div>

                {/* Cheeks */}
                <div className="absolute top-[60%] left-2 w-2 h-1 bg-pink-400/50 rounded-full blur-[1px]"></div>
                <div className="absolute top-[60%] right-2 w-2 h-1 bg-pink-400/50 rounded-full blur-[1px]"></div>
            </div>

            {/* Headphones / Ears */}
            <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-8 bg-indigo-700 rounded-l-lg border-r border-white/20"></div>
            <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-8 bg-indigo-700 rounded-r-lg border-l border-white/20"></div>
        </div>
      </div>
    </div>
  );
};
