// src/components/layout/BottomNav.tsx
// Mobile-only bottom navigation bar (hidden on md+)
import React from "react";
import { Activity, History, BarChart3, Settings } from "lucide-react";

interface BottomNavProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const navItems = [
  { id: "monitor",   label: "Monitor",   icon: Activity  },
  { id: "history",   label: "History",   icon: History   },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings",  label: "Settings",  icon: Settings  },
];

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, setCurrentPage }) => (
  <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-stretch safe-area-inset-bottom">
    {navItems.map(({ id, label, icon: Icon }) => {
      const active = currentPage === id;
      return (
        <button
          key={id}
          onClick={() => setCurrentPage(id)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors ${
            active
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Icon className={`w-5 h-5 ${active ? "text-emerald-600 dark:text-emerald-400" : ""}`} />
          {label}
          {active && <span className="w-1 h-1 rounded-full bg-emerald-500 mt-0.5" />}
        </button>
      );
    })}
  </nav>
);
