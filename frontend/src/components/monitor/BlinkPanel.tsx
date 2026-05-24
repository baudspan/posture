// src/components/monitor/BlinkPanel.tsx
import React from "react";
import { Eye } from "lucide-react";

interface BlinkPanelProps {
  blinkCount: number;
  blinkRate: number;
  blinkStatus: "Normal" | "Low" | "Very Low" | string;
  earAvg: number;
}

export const BlinkPanel: React.FC<BlinkPanelProps> = ({
  blinkCount,
  blinkRate,
  blinkStatus,
  earAvg
}) => {
  const getBlinkStatusStyles = () => {
    switch (blinkStatus) {
      case "Normal":
        return {
          text: "text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40",
          label: "Healthy"
        };
      case "Low":
        return {
          text: "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40",
          label: "Dry Eye Risk"
        };
      case "Very Low":
      default:
        return {
          text: "text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 animate-pulse",
          label: "High Strain"
        };
    }
  };

  const statusStyles = getBlinkStatusStyles();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between select-none shadow-xl transition-colors duration-300">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <span className="text-base font-bold text-slate-900 dark:text-white transition-colors">Eye Monitor</span>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold transition-colors ${statusStyles.text}`}>
          {statusStyles.label}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 my-2 mb-4">
        {/* Left Side: Blink rate */}
        <div>
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block uppercase tracking-wider transition-colors">Blink Rate</span>
          <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white transition-colors">{blinkRate}</span>
          <span className="text-slate-600 dark:text-slate-300 text-[10px] ml-1 font-bold transition-colors">/ min</span>
        </div>

        {/* Right Side: Total count */}
        <div>
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block uppercase tracking-wider transition-colors">Total Blinks</span>
          <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white transition-colors">{blinkCount}</span>
        </div>
      </div>

      {/* EAR level bar */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-3 mt-1 transition-colors duration-300">
        <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 transition-colors">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            EAR Avg (Eye Openness)
          </span>
          <span className="font-mono text-slate-700 dark:text-slate-200 transition-colors">{earAvg.toFixed(3)}</span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-950/60 rounded-full overflow-hidden border border-slate-300 dark:border-slate-800 p-0.5 transition-colors duration-300">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              earAvg >= 0.22 ? "bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800" : "bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse"
            }`}
            style={{ width: `${Math.min(100, (earAvg / 0.4) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
