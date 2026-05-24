// src/components/monitor/WebcamCanvas.tsx
// Video frame + skeleton drawn on ONE canvas so coordinates always align perfectly.

import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import type { RawMetrics } from "../../types/posture";

interface WebcamCanvasProps {
  metrics: RawMetrics | null; 
  showSkeleton: boolean;
  activeIssues: string[];
}

export const WebcamCanvas: React.FC<WebcamCanvasProps> = ({
  metrics,
  showSkeleton,
  activeIssues,
}) => {
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const imgRef          = useRef<HTMLImageElement>(new Image());
  const animFrameRef    = useRef<number | null>(null);
  const metricsRef      = useRef<RawMetrics | null>(null);
  const activeIssuesRef = useRef<string[]>([]);
  const showSkeletonRef = useRef<boolean>(showSkeleton);
  const [hasFrame, setHasFrame]   = useState(false);
  const [imgSize,  setImgSize]    = useState({ w: 640, h: 480 });

  // Keep refs in sync every render — no stale closures
  metricsRef.current      = metrics;
  activeIssuesRef.current = activeIssues;
  showSkeletonRef.current = showSkeleton;

  // ── Main draw loop (runs once, reads refs for current values) ─────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const currentMetrics = metricsRef.current;
      const currentIssues  = activeIssuesRef.current;
      const skeleton       = showSkeletonRef.current;
      const img            = imgRef.current;

      // Size canvas to match the image so 1 canvas-pixel = 1 image-pixel
      if (img.naturalWidth > 0) {
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) { animFrameRef.current = requestAnimationFrame(draw); return; }

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // ── Draw video frame (mirrored) ───────────────────────────────────────
      if (img.naturalWidth > 0) {
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, W, H);
        ctx.restore();
      }

      // ── Draw skeleton overlay ─────────────────────────────────────────────
      if (skeleton) {
        const landmarks: any[] = (currentMetrics as any)?.skeleton_landmarks ?? [];
        const edges: any[]     = (currentMetrics as any)?.skeleton_edges     ?? [];

        if (landmarks.length > 0) {
          const hasSlouch   = currentIssues.some(i => i.includes("Slouch") || i.includes("forward"));
          const hasTilt     = currentIssues.some(i => i.includes("Tilting") || i.includes("tilting"));
          const hasClose    = currentIssues.some(i => i.includes("close"));
          const hasLean     = currentIssues.some(i => i.toLowerCase().includes("lean") || i.toLowerCase().includes("tilt"));
          const postureWarn = hasSlouch || hasTilt || hasClose || hasLean;

          const edgeColor = postureWarn ? "rgba(244,63,94,0.55)"  : "rgba(20,184,166,0.5)";
          const dotColor  = postureWarn ? "rgba(244,63,94,0.85)"  : "rgba(20,184,166,0.85)";
          const dotColorKey = postureWarn ? "rgba(244,63,94,1)"   : "rgba(16,185,129,1)";

          // Build lookup — mirror x to match flipped video
          const ptMap = new Map<number, { px: number; py: number }>();
          landmarks.forEach((pt: any) => {
            ptMap.set(pt.id, {
              px: (1 - pt.x) * W,   // mirror x
              py: pt.y * H,
            });
          });

          // Edges
          ctx.lineWidth   = 1.2;
          ctx.lineCap     = "round";
          ctx.strokeStyle = edgeColor;
          edges.forEach(([idA, idB]: [number, number]) => {
            const a = ptMap.get(idA);
            const b = ptMap.get(idB);
            if (!a || !b) return;
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.stroke();
          });

          // Dots
          const KEY_IDS = new Set([1, 33, 263, 234, 454, 168, 10, 152]);
          landmarks.forEach((pt: any) => {
            const p = ptMap.get(pt.id);
            if (!p) return;
            const isKey = KEY_IDS.has(pt.id);
            const r = isKey ? 3.5 : 1.8;
            const c = isKey ? dotColorKey : dotColor;
            ctx.beginPath();
            ctx.arc(p.px, p.py, r, 0, 2 * Math.PI);
            ctx.fillStyle = c;
            if (isKey) { ctx.shadowBlur = 6; ctx.shadowColor = c; }
            ctx.fill();
            ctx.shadowBlur = 0;
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []); // runs once — all values read from refs

  // ── Decode incoming base64 JPEG into the img element ─────────────────────
  useEffect(() => {
    const frameB64 = (metrics as any)?.frame_b64 as string | undefined;
    if (!frameB64) return;
    const img = imgRef.current;
    img.onload = () => {
      setHasFrame(true);
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = `data:image/jpeg;base64,${frameB64}`;
  }, [(metrics as any)?.frame_b64]);

  // Aspect ratio for the container so CSS never crops or distorts
  const aspectRatio = `${imgSize.w} / ${imgSize.h}`;

  return (
    <div
      className="relative w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-center group transition-colors duration-300"
      style={{ aspectRatio }}
    >
      {/* Single canvas — video + skeleton drawn together */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: hasFrame ? "block" : "none" }}
      />

      {/* Placeholder */}
      {!hasFrame && (
        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300 transition-colors duration-300">
          <CameraOff className="w-12 h-12 text-slate-400 dark:text-slate-700 animate-pulse" />
          <p className="text-sm font-medium">Waiting for camera stream from backend…</p>
          <p className="text-xs text-slate-400 dark:text-slate-600">
            Make sure <code className="font-mono">server.py</code> is running
          </p>
        </div>
      )}

      {/* Live badge */}
      {hasFrame && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-all duration-300 shadow-sm">
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          Live Camera Feed
        </div>
      )}

      {/* Posture badge */}
      {hasFrame && metrics?.face_detected && (
        <div className={`absolute top-4 right-4 px-3 py-1 rounded-lg text-xs font-bold shadow-md backdrop-blur-md
          ${(metrics as any).posture_ok
            ? "bg-emerald-900/80 text-emerald-300 border border-emerald-700"
            : "bg-rose-900/80 text-rose-300 border border-rose-700"
          }`}>
          {(metrics as any).posture_ok
            ? "✓ Good Posture"
            : !(metrics as any).pitch_ok
            ? "⚠ Slouching Forward"
            : "⚠ Head Tilting"}
        </div>
      )}
    </div>
  );
};
