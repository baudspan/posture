// src/components/monitor/StatusBadge.tsx
import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, EyeOff } from "lucide-react";
import type { PostureStatus } from "../../types/posture";

interface StatusBadgeProps {
  status: PostureStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = "" }) => {
  const getStatusStyles = () => {
    switch (status) {
      case "GOOD":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/5 dark:shadow-emerald-500/10",
          icon: CheckCircle2,
          text: "GOOD POSTURE",
          desc: "Excellent body alignment. Keep it up!",
          dot: "bg-emerald-500 dark:bg-emerald-400"
        };
      case "SLIPPING":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-amber-500/5 dark:shadow-amber-500/10",
          icon: AlertTriangle,
          text: "SLIPPING...",
          desc: "Minor deviation detected. Adjust your position.",
          dot: "bg-amber-500 dark:bg-amber-400"
        };
      case "POOR":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/35 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-rose-500/5 dark:shadow-rose-500/15",
          icon: AlertCircle,
          text: "POOR POSTURE!",
          desc: "Critical muscle strain risk. Straighten up!",
          dot: "bg-rose-500 dark:bg-rose-400 animate-ping"
        };
      case "NO_FACE":
      default:
        return {
          bg: "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-slate-950/5 dark:shadow-slate-950/10",
          icon: EyeOff,
          text: "LOST TRACKING",
          desc: "Face not detected. Position camera correctly.",
          dot: "bg-slate-400 dark:bg-slate-500"
        };
    }
  };

  const styles = getStatusStyles();
  const Icon = styles.icon;

  return (
    <div className={`p-5 rounded-2xl border ${styles.bg} shadow-lg transition-all duration-300 flex items-center justify-between shrink-0 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white/60 dark:bg-slate-950/60 rounded-xl border border-slate-200/50 dark:border-slate-800/40 shadow-inner">
          <Icon className="w-8 h-8" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`}></span>
            <h2 className="text-lg font-black tracking-wider leading-none m-0 text-slate-900 dark:text-slate-50 transition-colors">
              {styles.text}
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 font-medium transition-colors">
            {styles.desc}
          </p>
        </div>
      </div>
    </div>
  );
};
