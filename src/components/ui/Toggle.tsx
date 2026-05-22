// src/components/ui/Toggle.tsx
import React from "react";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  checked,
  onChange,
  description
}) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-800 transition-colors flex items-center justify-between gap-4">
      <div>
        <label className="text-lg font-semibold text-slate-900 dark:text-white">{label}</label>
        {description && (
          <p className="text-base text-slate-600 dark:text-slate-300 font-medium mt-0.5">{description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
          checked ? "bg-teal-500" : "bg-slate-200 border-slate-300 dark:bg-slate-950 dark:border-slate-800"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-250 ease-in-out ${
            checked ? "translate-x-5 bg-white" : "translate-x-0 bg-slate-300 dark:bg-slate-400"
          }`}
        />
      </button>
    </div>
  );
};
