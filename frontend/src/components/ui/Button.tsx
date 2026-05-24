// src/components/ui/Button.tsx
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "secondary":
        return "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-50 border-slate-200 dark:border-slate-700 active:scale-98";
      case "danger":
        return "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-600/10 active:scale-98";
      case "ghost":
        return "bg-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white border-transparent";
      case "primary":
      default:
        return "bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 hover:brightness-110 text-white border-none shadow-md shadow-emerald-500/10 active:scale-98";
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return "px-3 py-1.5 text-xs rounded-lg";
      case "lg":
        return "px-6 py-3 text-sm rounded-xl font-extrabold";
      case "md":
      default:
        return "px-4.5 py-2.5 text-xs rounded-lg font-bold";
    }
  };

  return (
    <button
      className={`border inline-flex items-center justify-center gap-2 transition-all duration-300 ${getVariantStyles()} ${getSizeStyles()} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
