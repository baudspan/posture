// src/pages/Settings.tsx
import React, { useEffect } from "react";
import { useSettings } from "../hooks/useSettings";
import { useWebSocketContext } from "../context/WebSocketContext";
import { DEFAULT_SETTINGS } from "../lib/localStorage";
import { Slider } from "../components/ui/Slider";
import { Toggle } from "../components/ui/Toggle";
import { Bell, Shield, Eye, RotateCcw } from "lucide-react";

export const Settings: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { sendSettings } = useWebSocketContext();

  // Push saved settings to backend as soon as the WS is connected
  useEffect(() => {
    sendSettings({
      alert_cooldown_sec:    settings.alert_cooldown_sec,
      sound_alerts_enabled:  settings.sound_alerts_enabled,
      show_skeleton_overlay: settings.show_skeleton_overlay,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — settings is stable from context

  // Helper: update settings and immediately push backend-relevant ones
  const update = (patch: Parameters<typeof updateSettings>[0]) => {
    // updateSettings is async (setState), so compute merged value here before it updates
    const merged = { ...settings, ...patch };
    updateSettings(patch);
    console.log("[Settings] Sending to backend:", {
      alert_cooldown_sec:    merged.alert_cooldown_sec,
      sound_alerts_enabled:  merged.sound_alerts_enabled,
      show_skeleton_overlay: merged.show_skeleton_overlay,
    });
    sendSettings({
      alert_cooldown_sec:    merged.alert_cooldown_sec,
      sound_alerts_enabled:  merged.sound_alerts_enabled,
      show_skeleton_overlay: merged.show_skeleton_overlay,
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Settings Header card */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 leading-none">Diagnostic Thresholds</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mt-1">Configure real-time posture sensitivity metrics and system alert cooldowns.</p>
        </div>
        <button
          onClick={() => {
            resetSettings();
            sendSettings({
              alert_cooldown_sec:    DEFAULT_SETTINGS.alert_cooldown_sec,
              sound_alerts_enabled:  DEFAULT_SETTINGS.sound_alerts_enabled,
              show_skeleton_overlay: DEFAULT_SETTINGS.show_skeleton_overlay,
            });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all duration-300 active:scale-95 hover:text-slate-900 dark:hover:text-white"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category 1: Alerts & Overlay Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Bell className="w-5 h-5 text-teal-500 dark:text-teal-400" />
            Alerts & Display Preferences
          </h3>

          <div className="space-y-4">
            <Toggle
              label="Sound Alerts"
              description="Play sound notification in real-time when posture or distance violations exceed cooldown."
              checked={settings.sound_alerts_enabled}
              onChange={(val) => update({ sound_alerts_enabled: val })}
            />

            <Toggle
              label="Draw Skeleton Overlay"
              description="Render MediaPipe wireframe overlay coordinates on the webcam stream."
              checked={settings.show_skeleton_overlay}
              onChange={(val) => update({ show_skeleton_overlay: val })}
            />

            <Slider
              label="Alert Cooldown Delay"
              description="Minimum seconds to wait between triggering subsequent posture beep alerts."
              value={settings.alert_cooldown_sec}
              min={1}
              max={30}
              unit="s"
              onChange={(val) => update({ alert_cooldown_sec: val })}
            />
          </div>
        </div>

        {/* Category 2: Ergonomic Sensitivity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Shield className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            Ergonomic Sensitivities
          </h3>

          <div className="space-y-4">
            <Slider
              label="Forward Pitch Threshold"
              description="Head forward tilt angle in degrees before triggering a slouching alert. Lower = more sensitive."
              value={settings.pitch_threshold_deg}
              min={35}
              max={50}
              unit="°"
              onChange={(val) => {
                update({ pitch_threshold_deg: val });
                sendSettings({ ...settings, pitch_threshold_deg: val });
              }}
            />

            <Slider
              label="Head Lean Threshold"
              description="Side head tilt angle in degrees before triggering a leaning alert. Lower = more sensitive."
              value={settings.roll_threshold_deg}
              min={5}
              max={50}
              unit="°"
              onChange={(val) => {
                update({ roll_threshold_deg: val });
                sendSettings({ ...settings, roll_threshold_deg: val });
              }}
            />
          </div>
        </div>

        {/* Category 3: Eye Strain & Screen Distance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 md:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Eye className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
            Eye Strain & Vision Health
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Slider
              label="EAR Blink Threshold"
              description="Eye Aspect Ratio threshold. Below this value represents closed eyes for blink detection."
              value={settings.ear_threshold}
              min={0.1}
              max={0.4}
              step={0.01}
              unit=""
              onChange={(val) => {
                update({ ear_threshold: val });
                sendSettings({ ...settings, ear_threshold: val });
              }}
            />

            <Slider
              label="Screen Proximity Limit"
              description="Face width ratio limit. Higher = more lenient, lower = alerts you sooner when too close."
              value={settings.distance_threshold_ratio}
              min={0.2}
              max={0.6}
              step={0.01}
              unit=""
              onChange={(val) => {
                update({ distance_threshold_ratio: val });
                sendSettings({ ...settings, distance_threshold_ratio: val });
              }}
            />

            <Slider
              label="Break Reminder Delay"
              description="How often to be reminded to take a break. Based on the 20-20-20 rule."
              value={settings.break_interval_min}
              min={5}
              max={60}
              unit="m"
              onChange={(val) => {
                update({ break_interval_min: val });
                sendSettings({ ...settings, break_interval_min: val });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
