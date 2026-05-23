// src/context/WebSocketContext.tsx
import React, { createContext, useContext } from "react";
import { useWebSocket as useRawWebSocket } from "../hooks/useWebSocket";
import type { PostureSettings, RawMetrics } from "../types/posture";

interface WebSocketContextType {
  connected: boolean;
  metrics: RawMetrics | null;
  startCalibration: () => void;
  pauseStream: () => void;
  resumeStream: () => void;
  endSessionStream: () => void;
  updateBackendSettings: (settings: PostureSettings) => void;
  sendFrame: (image: string) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ws = useRawWebSocket(); // This runs the actual hook once

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
