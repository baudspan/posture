import React from "react";
import { Activity, History, BarChart3, Settings, LogOut, PersonStanding, Menu } from "lucide-react";
import { useAuth } from "../../store/authStore";

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  isExpanded: boolean;
  onToggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, isExpanded, onToggleSidebar }) => {
  const { logout, user } = useAuth();

  const navItems = [
    { id: "monitor", label: "Live Monitor", icon: Activity },
    { id: "history", label: "Session History", icon: History },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between h-screen sticky top-0 transition-all duration-300 ${isExpanded ? "w-64" : "w-20"}`}>
      <div>
        {/* Brand Logo Header / Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className={`w-full h-16 flex items-center border-b border-slate-200 dark:border-slate-800 transition-all duration-300 text-left cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/40 outline-none border-none ${
            isExpanded ? "px-6 gap-3" : "px-2 justify-center"
          }`}
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <div className="bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 text-white border-none p-2 rounded-lg shadow-lg shadow-emerald-500/10 shrink-0 relative w-9 h-9 flex items-center justify-center">
            {/* Swaps PersonStanding with Menu on hover */}
            <PersonStanding className="w-5 h-5 absolute transition-opacity duration-150 group-hover:opacity-0" />
            <Menu className="w-5 h-5 absolute transition-opacity duration-150 opacity-0 group-hover:opacity-100" />
          </div>
          {isExpanded && (
            <span className="font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 truncate animate-fade-in">
              POSTURE GUARD
            </span>
          )}
        </button>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center rounded-xl transition-all duration-300 font-medium cursor-pointer ${
                  isExpanded ? "px-4 py-3 gap-3" : "p-3 justify-center"
                } ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 text-white border-none shadow-md shadow-indigo-500/10"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                }`}
                title={!isExpanded ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                {isExpanded && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Session and Logout Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 transition-colors">
        {user && (
          isExpanded ? (
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/40 mb-3 transition-colors animate-fade-in">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Active Guard</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">{user.name}</p>
              <p className="text-xs text-slate-650 dark:text-slate-300 truncate">{user.email}</p>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div 
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold shadow-inner transition-colors" 
                title={`Active Guard: ${user.name}`}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )
        )}
        <button
          onClick={logout}
          className={`w-full flex items-center text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 transition-colors font-medium cursor-pointer ${
            isExpanded ? "px-4 py-3 gap-3" : "p-3 justify-center"
          }`}
          title={!isExpanded ? "Log Out" : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {isExpanded && <span className="truncate">Log Out</span>}
        </button>
      </div>
    </aside>
  );
};
