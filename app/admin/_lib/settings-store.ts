import type {
  AllSettings,
} from './settings-types';
import { POINT_VALUES, TEAM_COLORS, DEFAULT_TEAM_NAMES } from '@/lib/constants';

/**
 * Local-only settings store for the Game Management Center. Mirrors the
 * pattern used by the admin content store (`store.ts`): seed defaults on
 * first run, persist every mutation to localStorage.
 *
 * The module exposes a clean load/save interface so the internals can later
 * be swapped for Supabase sync without touching the React context or UI.
 */

const SETTINGS_KEY = 'admin-settings-v1';

/** Build the default settings from the existing game constants. */
export function defaultSettings(): AllSettings {
  return {
    game: {
      defaultGameName: 'عب مع شلتك',
      defaultSubtitle: 'لعبة الأصدقاء التفاعلية',
      defaultNumberOfCategories: 6,
      defaultPoints: [...POINT_VALUES],
    },
    timer: {
      presets: [30, 45, 60, 90, 120],
      customPresets: [],
      defaultPreset: 45,
    },
    teams: {
      defaultTeamNames: [...DEFAULT_TEAM_NAMES] as [string, string],
      availableColors: TEAM_COLORS.map((c) => c.id),
      maxTeams: 2,
    },
    categories: {
      order: [],
      disabled: [],
      hidden: [],
    },
    qr: {
      expirationTime: 5,
      style: 'standard',
      size: 256,
      singleUse: true,
    },
    security: {
      adminPassword: 'admin123',
      sessionTimeout: 30,
      autoLogout: false,
    },
    ai: {
      enabled: false,
      provider: 'mock',
      apiKey: '',
      model: 'mock-local',
      temperature: 0.7,
      maxTokens: 1024,
    },
  };
}

/**
 * Deep-merge persisted settings over defaults so new fields added in future
 * versions always have a value even if the saved blob predates them.
 */
function mergeSettings(saved: Partial<AllSettings>): AllSettings {
  const defaults = defaultSettings();
  return {
    game: { ...defaults.game, ...saved.game },
    timer: { ...defaults.timer, ...saved.timer },
    teams: { ...defaults.teams, ...saved.teams },
    categories: { ...defaults.categories, ...saved.categories },
    qr: { ...defaults.qr, ...saved.qr },
    security: { ...defaults.security, ...saved.security },
    ai: { ...defaults.ai, ...saved.ai },
  };
}

/** Read persisted settings, or seed + persist on first run. */
export function loadSettings(): AllSettings {
  if (typeof window === 'undefined') return defaultSettings();
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const initial = defaultSettings();
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(initial));
      return initial;
    }
    return mergeSettings(JSON.parse(raw));
  } catch {
    const fresh = defaultSettings();
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore quota errors */
    }
    return fresh;
  }
}

/** Persist settings. Silently ignores quota/access errors. */
export function saveSettings(settings: AllSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/** Wipe persisted settings and restore defaults. */
export function resetSettings(): AllSettings {
  const fresh = defaultSettings();
  saveSettings(fresh);
  return fresh;
}

/** Read ONLY the security settings synchronously (used by auth.ts). */
export function loadSecuritySettings() {
  return loadSettings().security;
}
