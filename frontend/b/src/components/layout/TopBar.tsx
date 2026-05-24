import React from "react";
import { Wifi, WifiOff, Clock, Sun, Moon, PersonStanding } from "lucide-react";
import { useAuth } from "../../store/authStore";

interface TopBarProps {
  currentPage: string;
  connected: boolean;
  breakCountdownSec?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentPage,
  connected,
  breakCountdownSec
}) => {
  const { user, firebaseUser } = useAuth();

  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") return "light";
    if (saved === "dark") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  React.useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: nextTheme }));
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case "monitor":
        return "Live Posture Monitor";
      case "history":
        return "Session History";
      case "analytics":
        return "Analytics Dashboard";
      case "settings":
        return "System Settings";
      default:
        return "Dashboard";
    }
  };

  const formatCountdown = (seconds?: number) => {
    if (seconds === undefined) return "20:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
      <div className="flex items-center gap-3.5">
        <div className="bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 text-white border-none p-1.5 rounded-lg shadow-sm shadow-emerald-500/5 shrink-0 flex items-center justify-center">
          <PersonStanding className="w-4 h-4" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 m-0 leading-none transition-colors">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Break Reminder Timer */}
        {breakCountdownSec !== undefined && breakCountdownSec > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-colors">
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-semibold">Next break in:</span>
            <span className="text-sm font-mono font-bold text-teal-600 dark:text-teal-400">
              {formatCountdown(breakCountdownSec)}
            </span>
          </div>
        )}

        {/* WebSocket Connection Status */}
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-full text-xs font-bold shadow-sm shadow-emerald-500/10 transition-colors">
              <Wifi className="w-3.5 h-3.5" />
              Connected
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping absolute ml-22"></span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 rounded-full text-xs font-bold animate-pulse transition-colors">
              <WifiOff className="w-3.5 h-3.5" />
              Reconnecting...
            </span>
          )}
        </div>

        {/* Light/Dark Mode Toggler */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all duration-300 active:scale-95 cursor-pointer"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>

        {/* User profile avatar info */}
        {user && (
          <div className="flex items-center gap-2.5">
            {firebaseUser?.photoURL ? (
              <img
                src={firebaseUser.photoURL}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 shadow-inner object-cover"
                title={user.name}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold shadow-inner transition-colors">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
