// src/components/monitor/SessionTimer.tsx
import React from "react";
import { Play } from "lucide-react";

interface SessionTimerProps {
  durationSeconds: number;
  isActive: boolean;
}

export const SessionTimer: React.FC<SessionTimerProps> = ({ durationSeconds, isActive }) => {
  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    return [
      hrs.toString().padStart(2, "0"),
      mins.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0")
    ].join(":");
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-300 flex flex-col justify-between select-none">
      <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider transition-colors">Session Time</div>
      <div className="flex items-baseline gap-3 my-2">
        <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white tracking-tight transition-colors">
          {formatTime(durationSeconds)}
        </span>
        {isActive && (
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        )}
      </div>
      <div className="text-[10px] text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1 transition-colors">
        {isActive ? (
          <>
            <Play className="w-3 h-3 text-emerald-500 dark:text-emerald-400 fill-emerald-500 dark:fill-emerald-400 animate-pulse" />
            Session is active
          </>
        ) : (
          "Session is idle"
        )}
      </div>
    </div>
  );
};
