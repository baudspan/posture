// src/components/monitor/PostureGauge.tsx
import React from "react";

interface PostureGaugeProps {
  label: string;
  score: number;
  threshold?: number;
}

export const PostureGauge: React.FC<PostureGaugeProps> = ({
  label,
  score,
  threshold = 60
}) => {
  // SVG configuration
  const size = 100;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Limit score to [0, 100]
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  // Determine colors and status text based on score
  const isWarning = safeScore >= threshold && safeScore < 80;
  const isOptimal = safeScore >= 80;

  const getStatusColorClass = () => {
    if (isOptimal) return "text-emerald-400";
    if (isWarning) return "text-amber-400";
    return "text-rose-500 animate-pulse";
  };

  const getStatusLabel = () => {
    if (isOptimal) return "Optimal";
    if (isWarning) return "Warning";
    return "Critical";
  };

  return (
    <div className="flex flex-col items-center select-none p-1 flex-1 min-w-0">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* SVG Progress Ring */}
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            {/* Deep Ocean Glow Gradient: bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 */}
            <linearGradient id="ocean-gauge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#059669" /> {/* emerald-600 */}
              <stop offset="50%" stopColor="#1d4ed8" /> {/* blue-700 */}
              <stop offset="100%" stopColor="#5b21b6" /> {/* violet-800 */}
            </linearGradient>
          </defs>
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-slate-300 dark:stroke-slate-800 fill-none"
            strokeWidth={strokeWidth}
          />
          {/* Foreground progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ocean-gauge-gradient)"
            className="fill-none transition-all duration-500 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Text (Large, bold and highly readable) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">{safeScore}%</span>
          <span className="text-[8px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">Score</span>
        </div>
      </div>

      {/* Label and sub-status */}
      <span className="text-[11px] font-bold mt-2.5 text-slate-700 dark:text-slate-200 truncate w-full text-center">{label}</span>
      <span className={`text-[9px] uppercase font-extrabold tracking-wider mt-0.5 ${getStatusColorClass()}`}>
        {getStatusLabel()}
      </span>
    </div>
  );
};
