import type { PointValue } from '@/lib/types';

/**
 * Game Management Center — settings types.
 *
 * Every setting is structured so it can later be synchronized with a real
 * database (Supabase) by replacing the store module's internals. The React
 * context above the store exposes a stable update API so the UI never changes.
 *
 * All settings persist locally to localStorage for now (see settings-store.ts).
 */

/** Game-wide defaults shown across the app. */
export interface GameDefaultsSettings {
  defaultGameName: string;
  defaultSubtitle: string;
  defaultNumberOfCategories: number;
  /** Enabled point tiers on the board (subset of 250/500/750). */
  defaultPoints: PointValue[];
}

/** Timer presets + custom presets the host can choose from. */
export interface TimerSettingsData {
  /** Built-in presets, always available. */
  presets: number[];
  /** User-created custom presets (seconds). */
  customPresets: number[];
  /** Which preset is selected by default when a match starts. */
  defaultPreset: number;
}

/** Team configuration. */
export interface TeamsSettingsData {
  defaultTeamNames: [string, string];
  /** Ids of TEAM_COLORS that are enabled for selection. */
  availableColors: string[];
  /** Maximum number of teams (future — currently 2). */
  maxTeams: number;
}

/** Per-category display state: order, enabled, hidden. */
export interface CategoriesDisplaySettings {
  /** Category ids in the display order chosen by the admin. */
  order: string[];
  /** Disabled category ids (not selectable for a match). */
  disabled: string[];
  /** Hidden category ids (not shown in the category picker at all). */
  hidden: string[];
}

/** QR settings for the future "ولا كلمة" category. Isolated module. */
export interface QRSettingsData {
  /** QR expiration time in minutes. */
  expirationTime: number;
  /** Visual style of the generated QR code. */
  style: 'standard' | 'rounded' | 'dots';
  /** QR rendering size in pixels. */
  size: number;
  /** Whether each QR code can only be scanned once. */
  singleUse: boolean;
}

/** Security settings for the admin panel. */
export interface SecuritySettingsData {
  /** Admin password (stored locally; future: hashed in DB). */
  adminPassword: string;
  /** Session timeout in minutes before auto-logout. */
  sessionTimeout: number;
  /** Whether auto-logout on inactivity is enabled. */
  autoLogout: boolean;
}

/** AI provider configuration. Managed by the AI Provider Manager. */
export interface AISettingsData {
  /** Whether AI is enabled globally. */
  enabled: boolean;
  /** The active provider id. */
  provider: 'gemini' | 'openrouter' | 'groq' | 'mock';
  /** API key for the active provider (stored locally). */
  apiKey: string;
  /** Model identifier. */
  model: string;
  /** Sampling temperature 0–1. */
  temperature: number;
  /** Maximum output tokens. */
  maxTokens: number;
}

/** The complete settings blob, persisted as one localStorage entry. */
export interface AllSettings {
  game: GameDefaultsSettings;
  timer: TimerSettingsData;
  teams: TeamsSettingsData;
  categories: CategoriesDisplaySettings;
  qr: QRSettingsData;
  security: SecuritySettingsData;
  ai: AISettingsData;
}

/** Human-readable Arabic labels for QR styles. */
export const QR_STYLE_LABELS: Record<QRSettingsData['style'], string> = {
  standard: 'قياسي',
  rounded: 'زوايا دائرية',
  dots: 'نقاط',
};
