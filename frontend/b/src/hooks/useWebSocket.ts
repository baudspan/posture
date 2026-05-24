// src/hooks/useWebSocket.ts
import { useState, useEffect, useRef, useCallback } from "react";
import type { RawMetrics } from "../types/posture";

const WS_URL = "ws://localhost:8765";

interface PendingSettings {
  alert_cooldown_sec: number;
  sound_alerts_enabled: boolean;
  show_skeleton_overlay: boolean;
  pitch_threshold_deg?: number;
  roll_threshold_deg?: number;
  ear_threshold?: number;
  distance_threshold_ratio?: number;
  break_interval_min?: number;
}

export const useWebSocket = (_url: string = WS_URL) => {
  const [connected, setConnected] = useState<boolean>(false);
  const [metrics,   setMetrics]   = useState<RawMetrics | null>(null);

  const socketRef           = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const mountedRef          = useRef<boolean>(true);
  const isAuthenticatedRef  = useRef<boolean>(false);
  // Queue for settings + resume that couldn't be sent while socket was closed
  const pendingSettingsRef  = useRef<PendingSettings | null>(null);
  const pendingResumeRef    = useRef<boolean>(false);

  // ── Flush pending messages immediately after socket opens ─────────────────
  const flushPending = useCallback((ws: WebSocket) => {
    if (pendingResumeRef.current) {
      ws.send(JSON.stringify({ action: "resume" }));
      console.log("[WS] flushed → resume");
      pendingResumeRef.current = false;
    }
    if (pendingSettingsRef.current) {
      const s = pendingSettingsRef.current;
      ws.send(JSON.stringify({
        action:               "update_settings",
        alert_cooldown_sec:    s.alert_cooldown_sec,
        sound_alerts_enabled:  s.sound_alerts_enabled,
        show_skeleton_overlay: s.show_skeleton_overlay,
      }));
      console.log("[WS] flushed → settings", s);
      pendingSettingsRef.current = null;
    }
  }, []);

  // ── Connection ─────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) return;

    try {
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.log("WebSocket connected to", WS_URL);
        setConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        // Always flush pending messages first
        flushPending(ws);
        // Fallback: if authenticated but nothing was queued, still send resume
        if (!pendingResumeRef.current && isAuthenticatedRef.current) {
          ws.send(JSON.stringify({ action: "resume" }));
          console.log("[WS] onopen fallback → resume");
          // Also flush saved settings from localStorage
          try {
            const raw = localStorage.getItem("posture_settings");
            const saved = raw ? JSON.parse(raw) : {};
            ws.send(JSON.stringify({
              action:               "update_settings",
              alert_cooldown_sec:    saved.alert_cooldown_sec    ?? 5,
              sound_alerts_enabled:  saved.sound_alerts_enabled  ?? true,
              show_skeleton_overlay: saved.show_skeleton_overlay ?? true,
            }));
          } catch { /* ignore */ }
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as RawMetrics;
          setMetrics(data);
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        console.log("WebSocket closed. Reconnecting in 3 s…");
        setConnected(false);
        socketRef.current = null;
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };
    } catch (err) {
      console.error("Failed to open WebSocket:", err);
      setConnected(false);
    }
  }, [flushPending]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      socketRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  // ── Send helper ────────────────────────────────────────────────────────────
  const sendAction = useCallback((action: string, payload?: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, ...payload }));
    }
  }, []);

  // ── Send settings — queues if socket not ready, flushes when it opens ──────
  const sendSettings = useCallback((s: PendingSettings) => {
    const payload = {
      action:               "update_settings",
      alert_cooldown_sec:    s.alert_cooldown_sec,
      sound_alerts_enabled:  s.sound_alerts_enabled,
      show_skeleton_overlay: s.show_skeleton_overlay,
      ...(s.pitch_threshold_deg       !== undefined && { pitch_threshold_deg:       s.pitch_threshold_deg }),
      ...(s.roll_threshold_deg        !== undefined && { roll_threshold_deg:        s.roll_threshold_deg  }),
      ...(s.ear_threshold             !== undefined && { ear_threshold:             s.ear_threshold        }),
      ...(s.distance_threshold_ratio  !== undefined && { distance_threshold_ratio:  s.distance_threshold_ratio }),
      ...(s.break_interval_min        !== undefined && { break_interval_min:        s.break_interval_min   }),
    };
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      console.log("[WS] sendSettings →", payload);
    } else {
      // Queue it — will be flushed in onopen
      pendingSettingsRef.current = s;
      console.log("[WS] sendSettings queued (socket not open):", s);
    }
  }, []);

  // ── Public actions ─────────────────────────────────────────────────────────
  const startCalibration = useCallback(() => sendAction("calibrate"), [sendAction]);
  const pauseStream      = useCallback(() => sendAction("pause"),     [sendAction]);

  const resumeStream = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action: "resume" }));
    } else {
      pendingResumeRef.current = true;
    }
  }, []);

  const endSessionStream = useCallback(() => {
    sendAction("end_session");
    setMetrics(null);
  }, [sendAction]);

  const reconnect = useCallback(() => {
    socketRef.current?.close();
    setTimeout(connect, 300);
  }, [connect]);

  // Kept for API compatibility with AuthSync
  const setOnOpenCallback = useCallback((fn: () => void) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      fn();
    } else {
      // Wrap fn into pending queue
      pendingResumeRef.current = true;
    }
  }, []);

  const setAuthenticated = useCallback((val: boolean) => {
    isAuthenticatedRef.current = val;
    if (val) pendingResumeRef.current = true; // always queue resume on login
  }, []);

  return {
    connected,
    metrics,
    startCalibration,
    pauseStream,
    resumeStream,
    endSessionStream,
    reconnect,
    sendSettings,
    setOnOpenCallback,
    setAuthenticated,
  };
};
