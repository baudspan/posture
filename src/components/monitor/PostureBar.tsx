// src/components/monitor/PostureBar.tsx
import React from "react";

interface PostureBarProps {
  label: string;
  score: number;
  threshold?: number;
}

export const PostureBar: React.FC<PostureBarProps> = ({ label, score, threshold = 60 }) => {
  const getProgressColor = () => {
    if (score >= 80) return "bg-gradient-to-r from-emerald-500 to-emerald-400";
    if (score >= threshold) return "bg-gradient-to-r from-amber-500 to-amber-400";
    return "bg-gradient-to-r from-rose-600 to-rose-500";
  };

  const getTextColor = () => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400 font-bold";
    if (score >= threshold) return "text-amber-600 dark:text-amber-400 font-bold";
    return "text-rose-600 dark:text-rose-400 font-black animate-pulse";
  };

  const getStatusLabel = () => {
    if (score >= 80) return "Optimal";
    if (score >= threshold) return "Warning";
    return "Critical";
  };

  return (
    <div className="space-y-2 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-300">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 transition-colors">{label} Alignment</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
            {getStatusLabel()}
          </span>
          <span className={`text-base font-mono transition-colors ${getTextColor()}`}>{score}%</span>
        </div>
      </div>

      {/* Progress container */}
      <div className="h-3 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/40 p-0.5 transition-colors duration-300">
        <div
          className={`h-full rounded-full ${getProgressColor()} transition-all duration-500 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>
      
      {/* Threshold indicator helper */}
      <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1 transition-colors">
        <span>Min (0)</span>
        <span className="text-slate-600 dark:text-slate-300">Threshold ({threshold})</span>
        <span>Max (100)</span>
      </div>
    </div>
  );
};
