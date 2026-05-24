// src/components/monitor/CalibrationRing.tsx
import React from "react";
import { Sparkles, ScanFace } from "lucide-react";

interface CalibrationRingProps {
  status: "idle" | "in_progress" | "complete" | "failed" | string;
  progress: number; // 0 to 100
  onCalibrate: () => void;
  disabled: boolean;
}

export const CalibrationRing: React.FC<CalibrationRingProps> = ({
  status,
  progress,
  onCalibrate,
  disabled
}) => {
  const isInProgress = status === "in_progress";
  const isComplete = status === "complete";

  // SVG Circular path constants
  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const getStatusText = () => {
    if (isInProgress) return `Calibrating (${progress}%)`;
    if (isComplete) return "Calibrated!";
    return "Calibrate Sensor";
  };

  const getButtonStyles = () => {
    if (disabled) return "bg-slate-850 border-slate-800 text-slate-500 cursor-not-allowed";
    if (isInProgress) return "bg-emerald-950/20 border-emerald-900 text-emerald-400 cursor-not-allowed";
    if (isComplete) return "bg-emerald-950/30 border-emerald-800/40 text-emerald-400 border cursor-pointer";
    return "bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 hover:brightness-110 text-white border-none shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer";
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-300 flex flex-col gap-4 select-none">
      <div className="w-full">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 transition-colors">
          <ScanFace className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Camera Calibration
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 font-medium leading-relaxed transition-colors">
          Sit upright in your natural correct posture and calibrate to capture baseline shoulders and head tilt. Takes 3 seconds.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 w-full">
        {/* Progress Ring / Calibration Icon */}
        <div className="relative w-14 h-14 flex items-center justify-center bg-slate-200 dark:bg-slate-950 rounded-full border border-slate-300 dark:border-slate-800 transition-colors duration-300 shrink-0">
          {isInProgress ? (
            <>
              {/* SVG Ring */}
              <svg className="absolute w-full h-full transform -rotate-90">
                <defs>
                  <linearGradient id="ocean-calib-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#059669" /> {/* emerald-600 */}
                    <stop offset="50%" stopColor="#1d4ed8" /> {/* blue-700 */}
                    <stop offset="100%" stopColor="#5b21b6" /> {/* violet-800 */}
                  </linearGradient>
                </defs>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  className="stroke-slate-850 fill-none"
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="url(#ocean-calib-gradient)"
                  className="fill-none transition-all duration-100 ease-linear"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[10px] font-mono font-bold text-emerald-400">{progress}%</span>
            </>
          ) : isComplete ? (
            <Sparkles className="w-6 h-6 text-emerald-500 dark:text-emerald-400 animate-pulse" />
          ) : (
            <ScanFace className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          )}
        </div>

        {/* Trigger Button */}
        <button
          onClick={onCalibrate}
          disabled={disabled || isInProgress}
          className={`px-5 py-2.5 rounded-lg border font-bold text-xs transition-all duration-300 ${getButtonStyles()}`}
        >
          {getStatusText()}
        </button>
      </div>
    </div>
  );
};
