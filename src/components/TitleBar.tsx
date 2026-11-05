import React from 'react';
import { Minus, Square, X, Bot, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';

export const TitleBar: React.FC = () => {
  const handleMinimize = () => api.window.minimize();
  const handleMaximize = () => api.window.maximize();
  const handleClose = () => api.window.close();

  return (
    <div className="h-9 w-full bg-slate-950 border-b border-slate-800/80 flex items-center justify-between px-3 select-none z-50 text-xs">
      {/* Draggable left section */}
      <div className="flex items-center space-x-2 text-slate-300 font-medium" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
          <Bot className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-slate-200 tracking-wide text-xs">Easy Automate</span>
        <span className="text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-1.5 py-0.2 rounded-full font-mono">
          Desktop v1.0
        </span>
      </div>

      {/* Middle status indicator */}
      <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-400" style={{ WebkitAppRegion: 'drag' } as any}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="text-slate-400">Playwright & NLP Engine Ready</span>
      </div>

      {/* Right controls (for Electron custom titlebar) */}
      {api.isElectron && (
        <div className="flex items-center space-x-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={handleMinimize}
            className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 rounded transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
