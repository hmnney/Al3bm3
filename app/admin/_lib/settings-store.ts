import type { AllSettings } from './settings-types';
import { POINT_VALUES, TEAM_COLORS, DEFAULT_TEAM_NAMES } from '@/lib/constants';
import {
  getState,
  putState,
  readCache,
  writeCache,
  type StorageResult,
} from '@/lib/state-persistence';

/**
 * Settings store for the Game Management Center. localStorage is the fast
 * cache; Supabase Storage is the durable source of truth so settings survive
 * project restarts.
 */

const STORAGE_KEY = 'admin-settings-v1';
const REMOTE_KEY = 'admin-settings';

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
      model: '',
      temperature: 0.7,
      maxTokens: 1024,
    },
  };
}

/** Deep-merge persisted settings over defaults so new fields always have a value. */
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

/** Synchronous load from localStorage cache (instant hydration). */
export function loadSettings(): AllSettings {
  if (typeof window === 'undefined') return defaultSettings();
  const cached = readCache<AllSettings>(STORAGE_KEY);
  if (cached) return mergeSettings(cached);
  const initial = defaultSettings();
  writeCache(STORAGE_KEY, initial);
  return initial;
}

/** Async load from Supabase Storage (durable source of truth). */
export async function loadSettingsRemote(): Promise<AllSettings> {
  const remote = await getState<AllSettings>(REMOTE_KEY);
  if (remote) {
    const merged = mergeSettings(remote);
    writeCache(STORAGE_KEY, merged);
    return merged;
  }
  // No remote data (or network error) — return local WITHOUT uploading.
  // Uploading here could overwrite another device's settings on a transient
  // network failure. The remote will be populated when the user makes
  // actual changes (settings context's debounced save handles that).
  return loadSettings();
}

/** Persist to localStorage cache (synchronous). */
export function saveSettings(settings: AllSettings): void {
  writeCache(STORAGE_KEY, settings);
}

/** Persist to Supabase Storage (durable). Returns detailed result. */
export async function saveSettingsRemote(settings: AllSettings): Promise<StorageResult> {
  return putState(REMOTE_KEY, settings);
}

/** Wipe persisted settings and restore defaults. */
export function resetSettings(): AllSettings {
  const fresh = defaultSettings();
  saveSettings(fresh);
  void saveSettingsRemote(fresh);
  return fresh;
}

/** Read ONLY the security settings synchronously (used by auth.ts). */
export function loadSecuritySettings() {
  return loadSettings().security;
}
