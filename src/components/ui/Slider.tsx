// src/components/ui/Slider.tsx
import React from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  description?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  description
}) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-800 transition-colors space-y-3">
      <div className="flex justify-between items-baseline">
        <div>
          <label className="text-lg font-semibold text-slate-900 dark:text-white">{label}</label>
          {description && (
            <p className="text-base text-slate-600 dark:text-slate-300 font-medium mt-0.5">{description}</p>
          )}
        </div>
        <span className="font-mono text-sm font-bold text-teal-600 dark:text-teal-400">
          {value}
          <span className="text-xs text-slate-500 dark:text-slate-300 ml-0.5 font-bold">{unit}</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-500 border border-slate-300 dark:border-slate-800"
        />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{max}</span>
      </div>
    </div>
  );
};
