// src/components/monitor/DistanceBadge.tsx
import React from "react";
import { UserCheck, UserMinus, UserX } from "lucide-react";

interface DistanceBadgeProps {
  status: "TOO_CLOSE" | "GOOD" | "TOO_FAR" | string;
  faceWidthRatio: number;
}

export const DistanceBadge: React.FC<DistanceBadgeProps> = ({ status, faceWidthRatio }) => {
  const getStyles = () => {
    switch (status) {
      case "GOOD":
        return {
          card: "bg-slate-100 dark:bg-slate-800 border-emerald-300 dark:border-emerald-900/40 hover:border-emerald-400 dark:hover:border-emerald-800/60",
          iconBg: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
          icon: UserCheck,
          text: "text-emerald-600 dark:text-emerald-400",
          label: "Optimal Distance",
          desc: "Perfect viewing distance."
        };
      case "TOO_CLOSE":
        return {
          card: "border-rose-400 dark:border-rose-700 animate-alert-critical",
          iconBg: "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400",
          icon: UserX,
          text: "text-rose-600 dark:text-rose-400 font-bold",
          label: "Too Close!",
          desc: "Lean back. Protect your eyes."
        };
      case "TOO_FAR":
      default:
        return {
          card: "border-amber-400 dark:border-amber-600 animate-alert-warning",
          iconBg: "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400",
          icon: UserMinus,
          text: "text-amber-600 dark:text-amber-400",
          label: "Too Far Away",
          desc: "Get closer for tracking."
        };
    }
  };

  const styles = getStyles();
  const Icon = styles.icon;

  return (
    <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 select-none ${styles.card}`}>
      <div className={`p-2 rounded-lg transition-colors ${styles.iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider transition-colors">Screen Distance</span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 transition-colors">Ratio: {faceWidthRatio.toFixed(2)}</span>
        </div>
        <div className={`text-sm font-bold tracking-wide transition-colors ${styles.text}`}>
          {styles.label}
        </div>
        <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate mt-0.5 transition-colors">{styles.desc}</p>
      </div>
    </div>
  );
};
