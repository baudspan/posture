// src/App.tsx
import React, { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./store/authStore";
import { WebSocketProvider, useWebSocketContext } from "./context/WebSocketContext";
import { SettingsProvider } from "./context/SettingsContext";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { BottomNav } from "./components/layout/BottomNav";

// Pages
import { Login } from "./pages/Login";
import { Monitor } from "./pages/Monitor";
import { History } from "./pages/History";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";

const AuthSync: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const { pauseStream, resumeStream, sendSettings, setOnOpenCallback, setAuthenticated } = useWebSocketContext();
  const prevAuth = useRef<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (prevAuth.current === isAuthenticated) return;
    prevAuth.current = isAuthenticated;
    setAuthenticated(isAuthenticated);
    if (isAuthenticated) {
      setOnOpenCallback(() => {
        resumeStream();
        try {
          const raw = localStorage.getItem("posture_settings");
          const saved = raw ? JSON.parse(raw) : {};
          sendSettings({
            alert_cooldown_sec:    saved.alert_cooldown_sec    ?? 5,
            sound_alerts_enabled:  saved.sound_alerts_enabled  ?? true,
            show_skeleton_overlay: saved.show_skeleton_overlay ?? true,
          });
        } catch {
          sendSettings({ alert_cooldown_sec: 5, sound_alerts_enabled: true, show_skeleton_overlay: true });
        }
      });
    } else {
      pauseStream();
    }
  }, [isAuthenticated, loading, pauseStream, resumeStream, sendSettings, setOnOpenCallback, setAuthenticated]);

  return null;
};

const MainLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>("monitor");
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    return localStorage.getItem("sidebarExpanded") !== "false";
  });
  const { connected, metrics } = useWebSocketContext();

  const toggleSidebar = () => {
    setSidebarExpanded(prev => {
      const nextVal = !prev;
      localStorage.setItem("sidebarExpanded", String(nextVal));
      return nextVal;
    });
  };

  const renderPage = () => {
    switch (currentPage) {
      case "monitor":   return <Monitor />;
      case "history":   return <History />;
      case "analytics": return <Analytics />;
      case "settings":  return <Settings />;
      default:          return <Monitor />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* Sidebar — hidden on mobile, visible md+ */}
      <div className="hidden md:flex">
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          isExpanded={sidebarExpanded}
          onToggleSidebar={toggleSidebar}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          currentPage={currentPage}
          connected={connected}
          breakCountdownSec={metrics?.break_countdown_sec}
        />
        {/* Extra bottom padding on mobile so content clears the bottom nav */}
        <main className={`flex-1 min-h-0 pb-16 md:pb-0 ${
          currentPage === "monitor"
            ? "overflow-hidden p-3 md:p-6 flex flex-col"
            : "overflow-y-auto p-4 md:p-8"
        }`}>
          {renderPage()}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <div className="md:hidden">
        <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">
        Loading…
      </div>
    );
  }

  return (
    <>
      <AuthSync />
      {isAuthenticated ? (
        <SettingsProvider>
          <MainLayout />
        </SettingsProvider>
      ) : (
        <Login />
      )}
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <AppContent />
      </WebSocketProvider>
    </AuthProvider>
  );
}
