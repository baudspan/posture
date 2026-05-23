// src/pages/Monitor.tsx
import React, { useEffect, useState } from "react";
import { Play, Pause, Square } from "lucide-react";
import { useAuth } from "../store/authStore";
import { useSettings } from "../hooks/useSettings";
import { useWebSocketContext } from "../context/WebSocketContext";
import { usePostureScore } from "../hooks/usePostureScore";
import { useSession } from "../hooks/useSession";

// Component imports
import { WebcamCanvas } from "../components/monitor/WebcamCanvas";
import { StatusBadge } from "../components/monitor/StatusBadge";
import { PostureGauge } from "../components/monitor/PostureGauge";
import { HeadLeanIndicator } from "../components/monitor/HeadLeanIndicator";
import { ActiveIssues } from "../components/monitor/ActiveIssues";
import { SessionTimer } from "../components/monitor/SessionTimer";
import { BlinkPanel } from "../components/monitor/BlinkPanel";
import { DistanceBadge } from "../components/monitor/DistanceBadge";
import { CalibrationRing } from "../components/monitor/CalibrationRing";

export const Monitor: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  
  // 1. WebSocket Hook
  const {
    connected,
    metrics,
    startCalibration,
    pauseStream,
    resumeStream,
    endSessionStream,
    updateBackendSettings,
    sendFrame
  } = useWebSocketContext();

  // 2. Posture Score Hook (local calculations from metrics + settings)
  const { status } = usePostureScore(metrics, settings);

  // 3. Session Tracking Hook
  const { sessionActive, duration, startSession, endSession } = useSession(metrics, status);
  
  const [streamPaused, setStreamPaused] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (connected) {
      updateBackendSettings(settings);
    }
  }, [connected, settings, updateBackendSettings]);

  const handleStartSession = () => {
    startSession();
    setSaveSuccessMessage(null);
    if (streamPaused) {
      resumeStream();
      setStreamPaused(false);
    }
  };

  const handlePauseToggle = () => {
    if (streamPaused) {
      resumeStream();
      setStreamPaused(false);
    } else {
      pauseStream();
      setStreamPaused(true);
    }
  };

  const handleEndSession = () => {
    if (!user) return;
    const completedSession = endSession(user.id);
    if (completedSession) {
      setSaveSuccessMessage(`Session saved successfully! Duration: ${Math.round(completedSession.durationSec / 60)}m`);
      // Hide success message after 5 seconds
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    }
    endSessionStream();
    setStreamPaused(false);
  };

  // Determine active issues (combine socket active issues + local status)
  const getDisplayIssues = (): string[] => {
    if (!metrics || !metrics.face_detected) return [];
    
    // Use socket list, or re-verify if empty but violations exist
    const issuesList = [...(metrics.active_issues || [])];
    
    // De-duplicate just in case
    return Array.from(new Set(issuesList));
  };

  const activeIssues = getDisplayIssues();

  return (
    <div className="h-full flex flex-col min-h-0 w-full overflow-hidden select-none">
      {/* Toast Save Message Notification (Fixed to avoid altering the grid flow) */}
      {saveSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-lg shadow-emerald-500/10 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping"></span>
          {saveSuccessMessage}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-0 overflow-hidden">
        {/* LEFT PANEL: Video Feed Card */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl h-full flex flex-col min-h-0 select-none transition-colors duration-300">
          {/* Card Header */}
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Video Feed</h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              settings.sound_alerts_enabled 
                ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-800/40" 
                 : "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            }`}>
              {settings.sound_alerts_enabled ? "Audio Enabled" : "Audio Muted"}
            </span>
          </div>
          {/* Video Canvas Container */}
          <div className="flex-1 min-h-0 relative">
            <WebcamCanvas
              metrics={metrics}
              showSkeleton={settings.show_skeleton_overlay}
              activeIssues={activeIssues}
              onFrame={connected && !streamPaused ? sendFrame : undefined}
            />
          </div>
        </div>

        {/* RIGHT PANEL: Live Stats & Analytics */}
        <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-1 scrollbar-thin h-full">
          {/* Sub-column A: Session Info Card and Eye Monitor Card */}
          <div className="flex flex-col gap-6">
            {/* Card 2: Session Info Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col min-h-0 gap-4 transition-colors duration-300 shrink-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 leading-none shrink-0">Session Info</h2>
              
              <div className="flex flex-col gap-4 shrink-0">
                <SessionTimer durationSeconds={duration} isActive={sessionActive} />
                <DistanceBadge
                  status={metrics?.distance_status || "TOO_FAR"}
                  faceWidthRatio={metrics?.face_width_ratio || 0}
                />
                <CalibrationRing
                  status={metrics?.calibration_status || "idle"}
                  progress={metrics?.calibration_progress || 0}
                  onCalibrate={startCalibration}
                  disabled={!connected}
                />
              </div>
              
              <div className="flex gap-3 shrink-0">
                {!sessionActive ? (
                  <button
                    onClick={handleStartSession}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-600 via-blue-700 to-violet-800 hover:brightness-110 text-white border-none rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-98 transition-all duration-300 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Start Session
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handlePauseToggle}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold active:scale-98 transition-all duration-300 cursor-pointer"
                    >
                      <Pause className="w-4 h-4 fill-slate-800 dark:fill-slate-200" />
                      {streamPaused ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={handleEndSession}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white border-none rounded-xl text-xs font-bold active:scale-98 transition-all duration-300 shadow-md shadow-rose-600/10 cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      End Session
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Card 3: Eye Monitor Card (BlinkPanel) */}
            <BlinkPanel
              blinkCount={metrics?.blink_count_session || 0}
              blinkRate={metrics?.blink_rate_per_min || 0}
              blinkStatus={metrics?.blink_status || "Normal"}
              earAvg={metrics?.ear_avg || 0.28}
            />
          </div>

          {/* Sub-column B: StatusBadge, Body Posture Analysis Card and Active Issues Card */}
          <div className="flex flex-col gap-6">
            {/* Status Badge */}
            <StatusBadge status={status} />

            {/* Card 4: Body Posture Analysis Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col min-h-0 shadow-xl transition-colors duration-300 shrink-0 gap-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-2 leading-none shrink-0">Body Posture Analysis</h2>
              
              <div className="flex justify-between items-center gap-4 shrink-0">
                <PostureGauge
                  label="Shoulder"
                  score={metrics?.face_detected ? metrics.shoulder_score : 90}
                  threshold={60}
                />
                <PostureGauge
                  label="Neck"
                  score={metrics?.face_detected ? metrics.neck_score : 85}
                  threshold={60}
                />
                <PostureGauge
                  label="Spine Hunch"
                  score={metrics?.face_detected ? metrics.hunch_score : 88}
                  threshold={60}
                />
              </div>
              
              <div className="mt-2 shrink-0">
                <HeadLeanIndicator
                  headOffset={metrics?.face_detected ? metrics.head_offset_norm : 0}
                  threshold={settings.head_offset_threshold}
                />
              </div>
            </div>

            {/* Card 5: Active Issues Card (ActiveIssues) */}
            <ActiveIssues issues={activeIssues} />
          </div>
        </div>
      </div>
    </div>
  );
};
