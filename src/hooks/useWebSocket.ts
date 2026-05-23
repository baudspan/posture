// src/hooks/useWebSocket.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { RawMetrics } from "../types/posture";

export const useWebSocket = (url: string = "ws://localhost:8765") => {
  const [connected, setConnected] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<RawMetrics | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef<boolean>(true);

  const clearReconnectTimer = () => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimer();
    shouldReconnectRef.current = true;

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      clearReconnectTimer();
      console.log("WebSocket connected to", url);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RawMetrics;
        setMetrics(data);
      } catch (error) {
        console.error("Could not parse backend metrics:", error);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      socketRef.current = null;

      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  const sendAction = useCallback((action: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action }));
    } else {
      console.warn("Cannot send action; backend is not connected:", action);
    }
  }, []);

  const startCalibration = useCallback(() => {
    sendAction("startCalibration");
  }, [sendAction]);

  const pauseStream = useCallback(() => {
    sendAction("pauseStream");
  }, [sendAction]);

  const resumeStream = useCallback(() => {
    sendAction("resumeStream");
  }, [sendAction]);

  const endSessionStream = useCallback(() => {
    setMetrics(null);
    sendAction("endSessionStream");
  }, [sendAction]);

  return {
    connected,
    metrics,
    startCalibration,
    pauseStream,
    resumeStream,
    endSessionStream,
    reconnect: connect,
  };
};
