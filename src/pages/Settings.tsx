// src/pages/Settings.tsx
import React from "react";
import { useSettings } from "../hooks/useSettings";
import { Slider } from "../components/ui/Slider";
import { Toggle } from "../components/ui/Toggle";
import { Bell, Shield, Eye, RotateCcw } from "lucide-react";

export const Settings: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSettings();

  return (
    <div className="space-y-6 select-none">
      {/* Settings Header card */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 leading-none">Diagnostic Thresholds</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mt-1">Configure real-time posture sensitivity metrics and system alert cooldowns.</p>
        </div>
        <button
          onClick={resetSettings}
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
              onChange={(val) => updateSettings({ sound_alerts_enabled: val })}
            />

            <Toggle
              label="Draw Skeleton Overlay"
              description="Render MediaPipe wireframe overlay coordinates on the webcam stream."
              checked={settings.show_skeleton_overlay}
              onChange={(val) => updateSettings({ show_skeleton_overlay: val })}
            />

            <Slider
              label="Alert Cooldown Delay"
              description="Minimum seconds to wait between triggering subsequent posture beep alerts."
              value={settings.alert_cooldown_sec}
              min={1}
              max={30}
              unit="s"
              onChange={(val) => updateSettings({ alert_cooldown_sec: val })}
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
              label="Forward Pitch Limit"
              description="Head forward tilt angle threshold in degrees before triggering a slouching alert."
              value={settings.pitch_threshold_deg}
              min={15}
              max={45}
              unit="°"
              onChange={(val) => updateSettings({ pitch_threshold_deg: val })}
            />

            <Slider
              label="Head Lean Threshold"
              description="Normalised left/right head offset threshold. Lower is more sensitive."
              value={settings.head_offset_threshold}
              min={0.02}
              max={0.15}
              step={0.01}
              unit=""
              onChange={(val) => updateSettings({ head_offset_threshold: val })}
            />

            <Slider
              label="Shoulder Sensitivity Offset"
              description="Calibration scale adjustments for shoulder level alignment calculations."
              value={settings.shoulder_offset}
              min={-20}
              max={0}
              unit="px"
              onChange={(val) => updateSettings({ shoulder_offset: val })}
            />

            <Slider
              label="Spine Hunch Sensitivity Offset"
              description="Calibration scale adjustment for spine curvature hunch detection."
              value={settings.hunch_offset}
              min={-15}
              max={0}
              unit="px"
              onChange={(val) => updateSettings({ hunch_offset: val })}
            />

            <Slider
              label="Neck Strain Sensitivity Offset"
              description="Calibration scale adjustment for cervical neck strain detection."
              value={settings.neck_offset}
              min={-20}
              max={0}
              unit="px"
              onChange={(val) => updateSettings({ neck_offset: val })}
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
              description="Eye Aspect Ratio threshold. Below this represents closed eyes."
              value={settings.ear_threshold}
              min={0.15}
              max={0.35}
              step={0.01}
              unit=""
              onChange={(val) => updateSettings({ ear_threshold: val })}
            />

            <Slider
              label="Face Width Ratio Limit"
              description="Normalised ratio limit representing physical proximity to screen."
              value={settings.distance_threshold_ratio}
              min={0.20}
              max={0.50}
              step={0.01}
              unit=""
              onChange={(val) => updateSettings({ distance_threshold_ratio: val })}
            />

            <Slider
              label="Screen Distance (Baseline)"
              description="Physical screen distance sensor limit in millimeters."
              value={settings.screen_distance_threshold_px}
              min={250}
              max={500}
              step={10}
              unit="mm"
              onChange={(val) => updateSettings({ screen_distance_threshold_px: val })}
            />

            <Slider
              label="Break Reminder Delay"
              description="20-20-20 rule timer alert trigger in minutes."
              value={settings.break_interval_min}
              min={5}
              max={60}
              unit="m"
              onChange={(val) => updateSettings({ break_interval_min: val })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
