// src/hooks/useSettings.ts
import { useState } from "react";
import type { PostureSettings } from "../types/posture";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../lib/localStorage";

export const useSettings = () => {
  const [settings, setSettingsState] = useState<PostureSettings>(getSettings);

  const updateSettings = (newSettings: Partial<PostureSettings>) => {
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  };

  const resetSettings = () => {
    saveSettings(DEFAULT_SETTINGS);
    setSettingsState(DEFAULT_SETTINGS);
  };

  return {
    settings,
    updateSettings,
    resetSettings
  };
};
