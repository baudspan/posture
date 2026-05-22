import type { PostureSettings, UserSession, SessionHistoryItem } from "../types/posture";

const SETTINGS_KEY = "posture_settings";
const USER_KEY = "posture_user";
const SESSIONS_KEY = "posture_sessions";

export const DEFAULT_SETTINGS: PostureSettings = {
  pitch_threshold_deg: 30,
  distance_threshold_ratio: 0.4,
  ear_threshold: 0.3,
  head_offset_threshold: 0.06,
  shoulder_offset: -10,
  hunch_offset: -5,
  neck_offset: -10,
  alert_cooldown_sec: 5,
  break_interval_min: 20,
  sound_alerts_enabled: true,
  show_skeleton_overlay: true,
  screen_distance_threshold_px: 350
};

export const getSettings = (): PostureSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: PostureSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getUser = (): UserSession | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveUser = (user: UserSession): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearUser = (): void => {
  localStorage.removeItem(USER_KEY);
};

export const getSessions = (): SessionHistoryItem[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveSession = (session: SessionHistoryItem): void => {
  const sessions = getSessions();
  sessions.unshift(session); // Add to the top
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
};

export const deleteSession = (id: string): void => {
  const sessions = getSessions();
  const filtered = sessions.filter(s => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
};
