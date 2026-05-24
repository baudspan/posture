// src/context/WebSocketContext.tsx
import React, { createContext, useContext } from "react";
import { useWebSocket as useRawWebSocket } from "../hooks/useWebSocket";
import type { RawMetrics } from "../types/posture";

interface WebSocketContextType {
  connected:         boolean;
  metrics:           RawMetrics | null;
  sendFrame:         (frameB64: string) => void;  // ← NEW
  startCalibration:  () => void;
  pauseStream:       () => void;
  resumeStream:      () => void;
  endSessionStream:  () => void;
  reconnect:         () => void;
  sendSettings: (s: {
    alert_cooldown_sec:    number;
    sound_alerts_enabled:  boolean;
    show_skeleton_overlay: boolean;
  }) => void;
  setOnOpenCallback: (fn: () => void) => void;
  setAuthenticated:  (val: boolean) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ws = useRawWebSocket();
  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return context;
};
