// src/hooks/useWebSocket.ts
import { useState, useEffect, useRef, useCallback } from "react";
import type { RawMetrics } from "../types/posture";
import { getMockSkeleton } from "../lib/mockSkeleton";
import { getSettings } from "../lib/localStorage";

// ============================================================================
// @BACKEND-TEAM TODO:
// Configure your WebSocket URL here. Defaults to ws://localhost:8765.
// ============================================================================
export const useWebSocket = (_url: string = "ws://localhost:8765") => {
  const [connected, setConnected] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<RawMetrics | null>(null);
  
  // Simulation states
  const [calibrationStatus, setCalibrationStatus] = useState<"idle" | "in_progress" | "complete" | "failed">("idle");
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const frameIndexRef = useRef<number>(0);
  const blinkCountRef = useRef<number>(0);
  const sessionElapsedRef = useRef<number>(0);
  const breakCountdownRef = useRef<number>(1200); // 20 minutes default in seconds

  // ============================================================================
  // @BACKEND-TEAM TODO: WebSocket Connection & Handshake Integration
  //
  // Currently, the connection is simulated (Mock Mode) below. 
  // To connect to your real Python WebSocket server:
  // 
  // 1. Uncomment the standard WebSocket connection code block below.
  // 2. Comment out or delete the "Mock Handshake" and "Main data simulation loop" blocks.
  // 3. Make sure to feed incoming parsed ws messages directly to setMetrics(data).
  // ============================================================================
  
  /*
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to", url);
        setConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RawMetrics;
          setMetrics(data);
        } catch (e) {
          console.error("Error parsing WebSocket JSON data:", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed.");
        setConnected(false);
        socketRef.current = null;
        
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };
    } catch (err) {
      console.error("Failed to establish WebSocket connection:", err);
      setConnected(false);
    }
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const sendAction = useCallback((action: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action }));
    } else {
      console.warn("Cannot send action. WebSocket not connected:", action);
    }
  }, []);
  */

  // ============================================================================
  // MOCK MODE: Simulated Handshake & Data Stream
  // Remove or disable the following code blocks when plugging in real WebSocket
  // ============================================================================

  // Mock Handshake
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnected(true);
      console.log("Mock WebSocket connected successfully (Simulated)");
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Update calibration status inside the loop
  const calibrationStatusRef = useRef(calibrationStatus);
  const calibrationProgressRef = useRef(calibrationProgress);
  useEffect(() => {
    calibrationStatusRef.current = calibrationStatus;
    calibrationProgressRef.current = calibrationProgress;
  }, [calibrationStatus, calibrationProgress]);

  // Main data simulation loop
  useEffect(() => {
    if (!connected || isPaused) return;

    const interval = setInterval(() => {
      frameIndexRef.current += 1;
      const frame = frameIndexRef.current;
      const time = frame * 0.15;

      // 1. Manage Calibration Progress
      let currentCalStatus = calibrationStatusRef.current;
      let currentCalProgress = calibrationProgressRef.current;

      if (currentCalStatus === "in_progress") {
        currentCalProgress += 20;
        if (currentCalProgress >= 100) {
          currentCalProgress = 100;
          currentCalStatus = "complete";
        }
        setCalibrationStatus(currentCalStatus);
        setCalibrationProgress(currentCalProgress);
      } else if (currentCalStatus === "complete") {
        currentCalStatus = "idle";
        currentCalProgress = 0;
        setCalibrationStatus(currentCalStatus);
        setCalibrationProgress(currentCalProgress);
      }

      // 2. Increments of seconds
      // Since interval runs every 500ms, every 2 ticks = 1 second
      if (frame % 2 === 0) {
        sessionElapsedRef.current += 1;
        if (breakCountdownRef.current > 0) {
          breakCountdownRef.current -= 1;
        } else {
          // Reset countdown when it hits 0
          const settings = getSettings();
          breakCountdownRef.current = settings.break_interval_min * 60;
        }
      }

      // 3. Face Detection & Metrics Simulation
      const face_detected = Math.random() > 0.02; // 98% tracking rate

      let head_pitch_deg = 0;
      let face_width_ratio = 0;
      let distance_status: "TOO_CLOSE" | "GOOD" | "TOO_FAR" = "GOOD";
      let left_ear = 0;
      let right_ear = 0;
      let ear_avg = 0;
      let eyes_closed = false;
      let shoulder_score = 90;
      let neck_score = 85;
      let hunch_score = 88;
      let head_offset_norm = 0;
      let active_issues: string[] = [];

      if (face_detected) {
        // Posture metrics drift via sine/cosine waves + random noise
        head_pitch_deg = Number((15 + Math.cos(time * 0.4) * 18 + (Math.random() - 0.5) * 2).toFixed(1));
        face_width_ratio = Number((0.29 + Math.sin(time * 0.1) * 0.13 + (Math.random() - 0.5) * 0.01).toFixed(3));
        
        // Clamp and compute distance status
        if (face_width_ratio >= 0.4) {
          distance_status = "TOO_CLOSE";
        } else if (face_width_ratio < 0.2) {
          distance_status = "TOO_FAR";
        } else {
          distance_status = "GOOD";
        }

        // Simulating blinks vs regular eye openness
        const isBlinkFrame = frame % 24 === 0; // Blink once every 12 seconds
        if (isBlinkFrame) {
          left_ear = 0.08;
          right_ear = 0.08;
          eyes_closed = true;
          blinkCountRef.current += 1;
        } else {
          left_ear = Number((0.27 + (Math.random() - 0.5) * 0.02).toFixed(3));
          right_ear = Number((0.27 + (Math.random() - 0.5) * 0.02).toFixed(3));
          eyes_closed = false;
        }
        ear_avg = Number(((left_ear + right_ear) / 2).toFixed(3));

        // Simulated body posture scores (0-100)
        shoulder_score = Math.max(0, Math.min(100, Math.round(85 + Math.sin(time * 0.2) * 16 + (Math.random() - 0.5) * 3)));
        neck_score = Math.max(0, Math.min(100, Math.round(80 + Math.cos(time * 0.15) * 23 + (Math.random() - 0.5) * 3)));
        hunch_score = Math.max(0, Math.min(100, Math.round(78 + Math.sin(time * 0.25) * 21 + (Math.random() - 0.5) * 3)));

        // Head offset lean (-1.0 to 1.0)
        head_offset_norm = Number((Math.sin(time * 0.3) * 0.09 + (Math.random() - 0.5) * 0.01).toFixed(3));

        // Evaluate active issues against dynamic user settings
        const settings = getSettings();
        const pitch_threshold = settings.pitch_threshold_deg;
        const distance_threshold = settings.distance_threshold_ratio;
        const head_offset_threshold = settings.head_offset_threshold;

        if (hunch_score < 60) active_issues.push("Hunching forward");
        if (neck_score < 60) active_issues.push("Neck strain");
        if (shoulder_score < 60) active_issues.push("Shoulder imbalance");
        if (head_offset_norm < -head_offset_threshold) active_issues.push("Leaning left");
        if (head_offset_norm > head_offset_threshold) active_issues.push("Leaning right");
        if (head_pitch_deg > pitch_threshold) active_issues.push("Slouching");
        if (face_width_ratio > distance_threshold) active_issues.push("Too close to screen");
      }

      // Calculate blink rate
      const blink_rate_per_min = sessionElapsedRef.current > 10
        ? Number(((blinkCountRef.current / sessionElapsedRef.current) * 60).toFixed(1))
        : 14.5;
      
      let blink_status: "Normal" | "Low" | "Very Low" = "Normal";
      if (blink_rate_per_min < 8) {
        blink_status = "Very Low";
      } else if (blink_rate_per_min < 12) {
        blink_status = "Low";
      }

      // Get visual skeleton synced with leans
      let lean: "left" | "right" | "none" = "none";
      const settings = getSettings();
      if (head_offset_norm < -settings.head_offset_threshold) {
        lean = "left";
      } else if (head_offset_norm > settings.head_offset_threshold) {
        lean = "right";
      }
      const mockSkeleton = getMockSkeleton(frame, lean);

      // Construct payload
      const simulatedPayload: RawMetrics = {
        timestamp: Date.now() / 1000,
        frame_index: frame,
        face_detected,
        head_pitch_deg,
        face_width_ratio,
        distance_status,
        left_ear,
        right_ear,
        ear_avg,
        eyes_closed,
        blink_count_session: blinkCountRef.current,
        blink_rate_per_min,
        blink_status,
        calibration_status: currentCalStatus,
        calibration_progress: currentCalProgress,
        session_elapsed_sec: sessionElapsedRef.current,
        break_countdown_sec: breakCountdownRef.current,
        shoulder_score,
        neck_score,
        hunch_score,
        head_offset_norm,
        active_issues,
        skeleton_landmarks: mockSkeleton.landmarks,
        skeleton_edges: mockSkeleton.edges
      };

      setMetrics(simulatedPayload);
    }, 500);

    return () => clearInterval(interval);
  }, [connected, isPaused]);

  // Actions
  const startCalibration = useCallback(() => {
    setCalibrationStatus("in_progress");
    setCalibrationProgress(0);
    console.log("Calibration started (Simulated)");
  }, []);

  const pauseStream = useCallback(() => {
    setIsPaused(true);
    console.log("Metrics stream paused (Simulated)");
  }, []);

  const resumeStream = useCallback(() => {
    setIsPaused(false);
    console.log("Metrics stream resumed (Simulated)");
  }, []);

  const endSessionStream = useCallback(() => {
    setIsPaused(false);
    sessionElapsedRef.current = 0;
    blinkCountRef.current = 0;
    frameIndexRef.current = 0;
    const settings = getSettings();
    breakCountdownRef.current = settings.break_interval_min * 60;
    setCalibrationStatus("idle");
    setCalibrationProgress(0);
    setMetrics(null);
    console.log("Tracking session ended and reset (Simulated)");
  }, []);

  const connect = useCallback(() => {
    setConnected(false);
    setTimeout(() => {
      setConnected(true);
    }, 500);
  }, []);

  return {
    connected,
    metrics,
    startCalibration,
    pauseStream,
    resumeStream,
    endSessionStream,
    reconnect: connect
  };
};

