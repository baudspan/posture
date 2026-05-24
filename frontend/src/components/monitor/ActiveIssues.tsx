// src/components/monitor/ActiveIssues.tsx
import React from "react";
import { AlertCircle, ThumbsUp } from "lucide-react";

interface ActiveIssuesProps {
  issues: string[];
}

export const ActiveIssues: React.FC<ActiveIssuesProps> = ({ issues }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl transition-all duration-300 flex-1 flex flex-col min-h-0">
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2 transition-colors">
        Active Issues
        {issues.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-[10px] font-bold animate-pulse">
            {issues.length}
          </span>
        )}
      </h3>

      <div className="flex-1 flex flex-col justify-center select-none">
        {issues.length > 0 ? (
          <div className="flex flex-wrap gap-2 content-start h-full">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 text-rose-400 border border-rose-900/60 text-xs font-semibold shadow-inner transition-colors duration-300 animate-fade-in"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                {issue}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-300 py-2">
            <div className="p-2.5 bg-slate-950/60 rounded-full border border-slate-800 text-emerald-400 shadow-inner transition-colors duration-300">
              <ThumbsUp className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-300 transition-colors">All alignments correct</p>
          </div>
        )}
      </div>
    </div>
  );
};
