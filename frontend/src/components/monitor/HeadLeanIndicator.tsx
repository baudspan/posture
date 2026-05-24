// src/components/monitor/HeadLeanIndicator.tsx
import React from "react";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

interface HeadLeanIndicatorProps {
  headOffset: number; // -1 to +1
  threshold: number;  // e.g. 0.06
}

export const HeadLeanIndicator: React.FC<HeadLeanIndicatorProps> = ({ headOffset, threshold }) => {
  const isLeaningLeft = headOffset < -threshold;
  const isLeaningRight = headOffset > threshold;
  
  // Convert offset to a percentage for the visual cursor indicator (-0.2 to +0.2 scale)
  const maxVisualRange = 0.15;
  const percentage = Math.max(-50, Math.min(50, (headOffset / maxVisualRange) * 50));
  const cursorLeftPosition = 50 + percentage; // 0% to 100%

  return (
    <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-300">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4 transition-colors">Lateral Balance</h3>

      <div className="flex items-center justify-between gap-4 mb-4 select-none">
        {/* Left Lean Arrow */}
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <div
            className={`p-2 rounded-lg border transition-all duration-300 ${
              isLeaningLeft
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/40 text-rose-600 dark:text-rose-500 shadow-md shadow-rose-500/5 animate-pulse"
                : "bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800/40 text-slate-400 dark:text-slate-600"
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-bold transition-colors ${isLeaningLeft ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
            Leaning Left
          </span>
        </div>

        {/* Center Balanced Indicator */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`p-2.5 rounded-full border transition-all duration-300 ${
              !isLeaningLeft && !isLeaningRight
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/5"
                : "bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800/40 text-slate-400 dark:text-slate-600"
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-bold transition-colors ${!isLeaningLeft && !isLeaningRight ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
            Centered
          </span>
        </div>

        {/* Right Lean Arrow */}
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <div
            className={`p-2 rounded-lg border transition-all duration-300 ${
              isLeaningRight
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/40 text-rose-600 dark:text-rose-500 shadow-md shadow-rose-500/5 animate-pulse"
                : "bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800/40 text-slate-400 dark:text-slate-600"
            }`}
          >
            <ArrowRight className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-bold transition-colors ${isLeaningRight ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
            Leaning Right
          </span>
        </div>
      </div>

      {/* Visual Slider Gauge */}
      <div className="relative h-2 bg-slate-100 dark:bg-slate-950 rounded-full border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        {/* Safe threshold zone overlay */}
        <div
          className="absolute h-full bg-slate-200/50 dark:bg-slate-900 border-x border-slate-300/40 dark:border-slate-800/60 transition-colors duration-300"
          style={{
            left: `${50 - (threshold / maxVisualRange) * 50}%`,
            right: `${50 - (threshold / maxVisualRange) * 50}%`
          }}
        />

        {/* Sliding cursor */}
        <div
          className={`absolute -top-1 w-4 h-4 rounded-full border shadow transition-all duration-300 ease-out transform -translate-x-1/2 ${
            isLeaningLeft || isLeaningRight
              ? "bg-rose-500 border-rose-300 dark:border-rose-200 shadow-rose-500/50"
              : "bg-teal-400 border-teal-200 dark:border-teal-100 shadow-teal-500/50"
          }`}
          style={{ left: `${cursorLeftPosition}%` }}
        />
      </div>
      <div className="flex justify-between text-[8px] font-bold text-slate-500 dark:text-slate-400 mt-1 transition-colors">
        <span>Lean L</span>
        <span>Balance Gauge</span>
        <span>Lean R</span>
      </div>
    </div>
  );
};
