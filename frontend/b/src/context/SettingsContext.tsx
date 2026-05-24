// src/context/SettingsContext.tsx
// Single shared settings context so ALL pages read/write the same state.
import React, { createContext, useContext, useState, useCallback } from "react";
import type { PostureSettings } from "../types/posture";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../lib/localStorage";

interface SettingsContextType {
  settings: PostureSettings;
  updateSettings: (patch: Partial<PostureSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PostureSettings>(getSettings);

  const updateSettings = useCallback((patch: Partial<PostureSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within SettingsProvider");
  return ctx;
};
