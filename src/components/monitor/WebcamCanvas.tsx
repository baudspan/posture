// src/components/monitor/WebcamCanvas.tsx
import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import type { RawMetrics } from "../../types/posture";
import { getMockSkeleton } from "../../lib/mockSkeleton";

interface WebcamCanvasProps {
  metrics: RawMetrics | null;
  showSkeleton: boolean;
  activeIssues: string[];
}

export const WebcamCanvas: React.FC<WebcamCanvasProps> = ({
  metrics,
  showSkeleton,
  activeIssues
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const localFrameIndex = useRef<number>(0);

  // Initialize camera stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    
    navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false 
    })
    .then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        activeStream = stream;
        setStreamActive(true);
        setStreamError(null);
      }
    })
    .catch((err) => {
      console.error("Camera access error:", err);
      setStreamError("Failed to access camera. Please check permissions.");
      setStreamActive(false);
    });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Drawing loop for canvas skeleton overlay
  useEffect(() => {
    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !streamActive) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Match canvas dimensions to video render size
      if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
      }

      // Clear previous frames
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!showSkeleton) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      // Determine skeleton landmarks to draw
      let landmarks: Array<{ id: number; x: number; y: number }> = [];
      let edges: Array<[number, number]> = [];

      localFrameIndex.current++;

      if (metrics && metrics.face_detected && metrics.skeleton_landmarks) {
        // Use live WebSocket skeleton
        landmarks = metrics.skeleton_landmarks;
        edges = metrics.skeleton_edges || [];
      } else {
        // Fallback to animated mock skeleton
        const lean = activeIssues.some(i => i.includes("left")) ? "left" : 
                     activeIssues.some(i => i.includes("right")) ? "right" : "none";
        const mock = getMockSkeleton(localFrameIndex.current, lean);
        landmarks = mock.landmarks;
        edges = mock.edges;
      }

      const w = canvas.width;
      const h = canvas.height;

      // Helper function to resolve joint colors based on active violations
      const getLineColor = (idA: number, idB: number) => {
        // If shoulder imbalance is active, color the shoulder bar red/orange
        if (idA === 11 && idB === 12 && activeIssues.some(i => i.includes("Shoulder"))) {
          return "rgba(244, 63, 94, 0.85)"; // Neon Rose
        }
        // If hunching is active, color the torso/hip connectors red/orange
        if ((idA === 11 && idB === 23 || idA === 12 && idB === 24) && activeIssues.some(i => i.includes("Hunch"))) {
          return "rgba(245, 158, 11, 0.85)"; // Neon Amber
        }
        // If neck strain is active, color the head-to-shoulder connections
        if ((idA === 0 && idB === 11 || idA === 0 && idB === 12) && activeIssues.some(i => i.includes("Neck"))) {
          return "rgba(244, 63, 94, 0.85)";
        }
        return "rgba(20, 184, 166, 0.7)"; // Standard neon teal
      };

      // Draw Edges (connective lines)
      edges.forEach(([idA, idB]) => {
        const ptA = landmarks.find(l => l.id === idA);
        const ptB = landmarks.find(l => l.id === idB);

        if (ptA && ptB) {
          ctx.beginPath();
          ctx.moveTo(ptA.x * w, ptA.y * h);
          ctx.lineTo(ptB.x * w, ptB.y * h);
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.strokeStyle = getLineColor(idA, idB);
          
          // Glow effect
          ctx.shadowBlur = 8;
          ctx.shadowColor = ctx.strokeStyle as string;
          
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        }
      });

      // Draw Joints (nodes)
      landmarks.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, 6, 0, 2 * Math.PI);
        
        let nodeColor = "rgba(16, 185, 129, 1)"; // Neon Emerald
        // Check if this joint is involved in an issue
        if (pt.id === 0 && activeIssues.some(i => i.includes("Slouch") || i.includes("close") || i.includes("Lean"))) {
          nodeColor = "rgba(244, 63, 94, 1)"; // Nose turns rose
        } else if ((pt.id === 11 || pt.id === 12) && activeIssues.some(i => i.includes("Shoulder") || i.includes("Neck"))) {
          nodeColor = "rgba(244, 63, 94, 1)"; // Shoulders turn rose
        } else if ((pt.id === 11 || pt.id === 12) && activeIssues.some(i => i.includes("Hunch"))) {
          nodeColor = "rgba(245, 158, 11, 1)"; // Shoulders turn amber
        }

        ctx.fillStyle = nodeColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = nodeColor;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [metrics, showSkeleton, streamActive, activeIssues]);

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-center group transition-colors duration-300">
      {/* Video capture */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform -scale-x-100"
      />

      {/* Skeleton drawing layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
      />

      {/* Video Off Overlay State */}
      {!streamActive && (
        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300 transition-colors duration-300">
          <CameraOff className="w-12 h-12 text-slate-400 dark:text-slate-700 animate-pulse" />
          <p className="text-sm font-medium">
            {streamError || "Initializing camera source..."}
          </p>
        </div>
      )}

      {/* Mini Active Camera Indicator */}
      {streamActive && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-all duration-300 shadow-sm">
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          Camera Feed Active
        </div>
      )}
    </div>
  );
};
