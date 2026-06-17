import React from 'react';
import { Minus, Square, X, Target } from 'lucide-react';

export function Titlebar() {
  // Only display the custom titlebar if running inside Electron
  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

  if (!isElectron) {
    return null;
  }

  const handleMinimize = () => {
    (window as any).electronAPI.minimize();
  };

  const handleMaximize = () => {
    (window as any).electronAPI.maximize();
  };

  const handleClose = () => {
    (window as any).electronAPI.close();
  };

  return (
    <div 
      className="flex items-center justify-between h-9 bg-zinc-950 text-zinc-400 select-none border-b border-zinc-800 text-xs w-full"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side: Brand Logo & Title */}
      <div className="flex items-center gap-2 pl-3">
        <Target className="w-4 h-4 text-emerald-500 animate-pulse" />
        <span className="font-semibold tracking-wider text-zinc-200">
          QueueGuidance AI Monitoring
        </span>
      </div>

      {/* Right side: Native Window Actions */}
      <div 
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-11 h-full hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-11 h-full hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-11 h-full hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
