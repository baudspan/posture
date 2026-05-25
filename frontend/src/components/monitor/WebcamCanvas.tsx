// src/components/monitor/WebcamCanvas.tsx
// Captures webcam in-browser via getUserMedia.
// Draws live video + face skeleton overlay on one canvas.
// Sends raw (unmirrored) frames to backend for ML analysis.

import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import type { RawMetrics } from "../../types/posture";

const FRAME_INTERVAL_MS = 40;   // ~25 fps to backend (was 80 ms / ~12 fps)
const JPEG_QUALITY      = 0.5;  // lower quality = smaller payload = less latency
const CAPTURE_W         = 480;  // send smaller frame to backend (was full 640×480)
const CAPTURE_H         = 360;

interface WebcamCanvasProps {
  metrics:      RawMetrics | null;
  showSkeleton: boolean;
  activeIssues: string[];
  onFrame:      (frameB64: string) => void;
  paused?:      boolean;
}

export const WebcamCanvas: React.FC<WebcamCanvasProps> = ({
  metrics,
  showSkeleton,
  activeIssues,
  onFrame,
  paused = false,
}) => {
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const videoRef     = useRef<HTMLVideoElement | null>(null);
  const captureRef   = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const animRef      = useRef<number | null>(null);
  const lastSendRef  = useRef<number>(0);

  // Live refs — updated every render, no stale closures in the RAF loop
  const metricsRef      = useRef(metrics);
  const issuesRef       = useRef(activeIssues);
  const skeletonRef     = useRef(showSkeleton);
  const pausedRef       = useRef(paused);
  const onFrameRef      = useRef(onFrame);

  metricsRef.current  = metrics;
  issuesRef.current   = activeIssues;
  skeletonRef.current = showSkeleton;
  pausedRef.current   = paused;
  onFrameRef.current  = onFrame;

  const [hasStream, setHasStream] = useState(false);
  const [camError,  setCamError]  = useState<string | null>(null);

  // ── getUserMedia ──────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    const video = document.createElement("video");
    video.autoplay    = true;
    video.playsInline = true;
    video.muted       = true;
    videoRef.current  = video;

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        return video.play();
      })
      .then(() => {
        setHasStream(true);
        setCamError(null);
      })
      .catch((err) => {
        console.error("getUserMedia:", err);
        setCamError("Camera permission denied or unavailable.");
      });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      videoRef.current = null;
    };
  }, []);

  // ── RAF draw + capture loop ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const video   = videoRef.current;
      const ctx     = canvas.getContext("2d");
      if (!ctx || !video || video.readyState < 2) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const W = video.videoWidth  || 640;
      const H = video.videoHeight || 480;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width  = W;
        canvas.height = H;
      }

      // ── Draw mirrored video ──────────────────────────────────────────────
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, W, H);
      ctx.restore();

      // ── Skeleton overlay ─────────────────────────────────────────────────
      const m    = metricsRef.current;
      const skel = skeletonRef.current;

      if (skel && m && m.face_detected) {
        const landmarks: Array<{ id: number; x: number; y: number }> = m.skeleton_landmarks ?? [];
        const edges: Array<[number, number]>                          = m.skeleton_edges     ?? [];

        if (landmarks.length > 0) {
          const issues      = issuesRef.current;
          const postureWarn = !m.posture_ok || !m.pitch_ok || !m.roll_ok
            || issues.some(i =>
                i.toLowerCase().includes("slouch") ||
                i.toLowerCase().includes("forward") ||
                i.toLowerCase().includes("tilting") ||
                i.toLowerCase().includes("close")
              );

          const edgeColor   = postureWarn ? "rgba(244,63,94,0.55)"  : "rgba(20,184,166,0.5)";
          const dotColor    = postureWarn ? "rgba(244,63,94,0.85)"  : "rgba(20,184,166,0.85)";
          const dotColorKey = postureWarn ? "rgba(244,63,94,1)"     : "rgba(16,185,129,1)";

          // Build point map — mirror x to match the flipped video
          const ptMap = new Map<number, { px: number; py: number }>();
          for (const pt of landmarks) {
            ptMap.set(pt.id, { px: (1 - pt.x) * W, py: pt.y * H });
          }

          // Edges
          ctx.lineWidth   = 1.4;
          ctx.lineCap     = "round";
          ctx.strokeStyle = edgeColor;
          for (const [idA, idB] of edges) {
            const a = ptMap.get(idA);
            const b = ptMap.get(idB);
            if (!a || !b) continue;
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.stroke();
          }

          // Dots
          const KEY_IDS = new Set([1, 33, 263, 234, 454, 168, 10, 152]);
          for (const pt of landmarks) {
            const p = ptMap.get(pt.id);
            if (!p) continue;
            const isKey = KEY_IDS.has(pt.id);
            ctx.beginPath();
            ctx.arc(p.px, p.py, isKey ? 3.5 : 1.8, 0, 2 * Math.PI);
            ctx.fillStyle   = isKey ? dotColorKey : dotColor;
            ctx.shadowBlur  = isKey ? 6 : 0;
            ctx.shadowColor = isKey ? dotColorKey : "transparent";
            ctx.fill();
          }
          ctx.shadowBlur = 0;
        }
      }

      // ── Send raw (unmirrored) frame to backend ───────────────────────────
      const now = performance.now();
      if (!pausedRef.current && now - lastSendRef.current >= FRAME_INTERVAL_MS) {
        lastSendRef.current = now;
        const cap = captureRef.current;
        if (cap.width !== CAPTURE_W || cap.height !== CAPTURE_H) {
          cap.width  = CAPTURE_W;
          cap.height = CAPTURE_H;
        }
        const capCtx = cap.getContext("2d");
        if (capCtx) {
          // Draw raw (non-mirrored) video for ML — scaled down for speed
          capCtx.drawImage(video, 0, 0, CAPTURE_W, CAPTURE_H);
          const dataUrl  = cap.toDataURL("image/jpeg", JPEG_QUALITY);
          const frameB64 = dataUrl.slice("data:image/jpeg;base64,".length);
          onFrameRef.current(frameB64);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []); // runs once — all live values via refs

  return (
    <div
      className="relative w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-center group transition-colors duration-300"
      style={{ aspectRatio: "4 / 3" }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ display: hasStream ? "block" : "none" }}
      />

      {!hasStream && (
        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
          <CameraOff className="w-12 h-12 text-slate-400 dark:text-slate-700 animate-pulse" />
          {camError
            ? <p className="text-sm font-medium text-rose-500">{camError}</p>
            : <p className="text-sm font-medium">Starting camera…</p>
          }
        </div>
      )}

      {hasStream && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-all duration-300">
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          Live Camera Feed
        </div>
      )}

      {hasStream && metrics?.face_detected && (
        <div className={`absolute top-4 right-4 px-3 py-1 rounded-lg text-xs font-bold shadow-md backdrop-blur-md ${
          metrics.posture_ok
            ? "bg-emerald-900/80 text-emerald-300 border border-emerald-700"
            : "bg-rose-900/80 text-rose-300 border border-rose-700"
        }`}>
          {metrics.posture_ok
            ? "✓ Good Posture"
            : !metrics.pitch_ok
            ? "⚠ Slouching Forward"
            : "⚠ Head Tilting"}
        </div>
      )}
    </div>
  );
};
