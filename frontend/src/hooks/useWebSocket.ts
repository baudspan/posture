// src/hooks/useWebSocket.ts
// Browser-camera edition:
// • Sends { action: "frame", frame_b64: "..." } to the backend for ML.
// • Receives JSON metrics (no frame_b64 back — we display the local stream).
// • Plays Web Audio API beeps when the backend sends alert flags.

import { useState, useEffect, useRef, useCallback } from "react";
import type { RawMetrics } from "../types/posture";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8765";

interface PendingSettings {
  alert_cooldown_sec:    number;
  sound_alerts_enabled:  boolean;
  show_skeleton_overlay: boolean;
  pitch_threshold_deg?:      number;
  roll_threshold_deg?:       number;
  ear_threshold?:            number;
  distance_threshold_ratio?: number;
  break_interval_min?:       number;
}

// ── Web Audio beeps ────────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

// Keepalive: plays a silent buffer on a loop so the AudioContext is never
// garbage-collected or throttled when the tab loses focus. Browsers suspend
// audio on hidden tabs, but an active source node prevents that.
let _keepaliveStarted = false;
function startAudioKeepalive(ctx: AudioContext) {
  if (_keepaliveStarted) return;
  _keepaliveStarted = true;

  // 1-frame silent buffer, looped forever
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;
  src.connect(ctx.destination);
  src.start(0);

  // Re-resume whenever the page becomes visible again (some browsers
  // re-suspend after a tab switch even with an active source)
  document.addEventListener("visibilitychange", () => {
    if (ctx.state === "suspended") ctx.resume();
  });
}

function playBeep(freq: number, duration: number, volume = 1.0) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    startAudioKeepalive(ctx);          // ensure keepalive is running

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // AudioContext not available (SSR / test env) — ignore
  }
}

// Beep presets — volume raised to 1.0 (was 0.4)
const beepAlert = () => playBeep(880, 0.35, 1.0); // posture / distance
const beepBlink = () => playBeep(440, 0.25, 1.0); // blink rate
const beepBreak = () => playBeep(660, 0.55, 1.0); // break reminder


export const useWebSocket = (_url: string = WS_URL) => {
  const [connected, setConnected] = useState<boolean>(false);
  const [metrics,   setMetrics]   = useState<RawMetrics | null>(null);

  const socketRef           = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const mountedRef          = useRef<boolean>(true);
  const isAuthenticatedRef  = useRef<boolean>(false);
  const pendingSettingsRef  = useRef<PendingSettings | null>(null);
  const pendingResumeRef    = useRef<boolean>(false);

  // ── Flush pending messages on open ────────────────────────────────────────
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
        flushPending(ws);
        if (!pendingResumeRef.current && isAuthenticatedRef.current) {
          ws.send(JSON.stringify({ action: "resume" }));
          console.log("[WS] onopen fallback → resume");
          try {
            const raw   = localStorage.getItem("posture_settings");
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
          const data = JSON.parse(event.data as string) as RawMetrics & {
            alerts?: { posture: boolean; distance: boolean; blink: boolean; break: boolean };
          };

          // Play browser beeps based on alert flags from backend
          if (data.alerts) {
            if (data.alerts.posture || data.alerts.distance) beepAlert();
            if (data.alerts.blink)  beepBlink();
            if (data.alerts.break)  beepBreak();
          }

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

  // ── Send a captured frame to the backend ──────────────────────────────────
  const sendFrame = useCallback((frameB64: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action: "frame", frame_b64: frameB64 }));
    }
  }, []);

  // ── Send settings ──────────────────────────────────────────────────────────
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
      pendingSettingsRef.current = s;
      console.log("[WS] sendSettings queued:", s);
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

  const setOnOpenCallback = useCallback((fn: () => void) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      fn();
    } else {
      pendingResumeRef.current = true;
    }
  }, []);

  const setAuthenticated = useCallback((val: boolean) => {
    isAuthenticatedRef.current = val;
    if (val) pendingResumeRef.current = true;
  }, []);

  return {
    connected,
    metrics,
    sendFrame,          // ← NEW: used by WebcamCanvas
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
