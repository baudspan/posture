// src/App.tsx
import React, { useState } from "react";
import { AuthProvider, useAuth } from "./store/authStore";
import { WebSocketProvider, useWebSocketContext } from "./context/WebSocketContext";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";

// Pages
import { Login } from "./pages/Login";
import { Monitor } from "./pages/Monitor";
import { History } from "./pages/History";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";

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
      case "monitor":
        return <Monitor />;
      case "history":
        return <History />;
      case "analytics":
        return <Analytics />;
      case "settings":
        return <Settings />;
      default:
        return <Monitor />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* Navigation Sidebar */}
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        isExpanded={sidebarExpanded}
        onToggleSidebar={toggleSidebar}
      />

      {/* Main Content Area */}
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
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <WebSocketProvider>
      <MainLayout />
    </WebSocketProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
