// src/components/ui/Card.tsx
import React from "react";

interface CardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  headerActions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  description,
  className = "",
  headerActions
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden ${className}`}>
      {(title || description || headerActions) && (
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 m-0 leading-none">{title}</h2>}
            {description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1 leading-relaxed">{description}</p>
            )}
          </div>
          {headerActions && <div className="shrink-0">{headerActions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};
