// src/App.tsx
import React, { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./store/authStore";
import { WebSocketProvider, useWebSocketContext } from "./context/WebSocketContext";
import { SettingsProvider } from "./context/SettingsContext";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";

// Pages
import { Login } from "./pages/Login";
import { Monitor } from "./pages/Monitor";
import { History } from "./pages/History";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";

/**
 * Bridges auth state → backend pause/resume.
 * Uses setOnOpenCallback so resume is sent even if the socket
 * isn't open yet when auth resolves (race condition fix).
 */
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
      // Queue resume + settings flush so both fire the instant socket is open
      setOnOpenCallback(() => {
        resumeStream();
        // Read saved settings from localStorage directly (SettingsProvider may not
        // be mounted yet at this point — it's inside the auth gate)
        try {
          const raw = localStorage.getItem("posture_settings");
          const saved = raw ? JSON.parse(raw) : {};
          sendSettings({
            alert_cooldown_sec:    saved.alert_cooldown_sec    ?? 5,
            sound_alerts_enabled:  saved.sound_alerts_enabled  ?? true,
            show_skeleton_overlay: saved.show_skeleton_overlay ?? true,
          });
          console.log("[AuthSync] logged in → resume + settings sent", saved);
        } catch {
          sendSettings({ alert_cooldown_sec: 5, sound_alerts_enabled: true, show_skeleton_overlay: true });
        }
      });
    } else {
      pauseStream();
      console.log("[AuthSync] logged out → pause sent");
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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        isExpanded={sidebarExpanded}
        onToggleSidebar={toggleSidebar}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          currentPage={currentPage}
          connected={connected}
          breakCountdownSec={metrics?.break_countdown_sec}
        />
        <main className={`flex-1 min-h-0 ${currentPage === "monitor" ? "overflow-hidden p-6 flex flex-col" : "overflow-y-auto p-8"}`}>
          {renderPage()}
        </main>
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
      {/* Always mounted so AuthSync can always send pause/resume */}
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
      {/* WebSocketProvider lives outside auth gate so the socket
          stays alive and AuthSync can message the backend on logout */}
      <WebSocketProvider>
        <AppContent />
      </WebSocketProvider>
    </AuthProvider>
  );
}
