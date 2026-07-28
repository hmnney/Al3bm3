import type { ReactNode } from 'react';

/**
 * Interactive Categories Engine — core type definitions.
 *
 * The engine is generic: it supports unlimited interaction types and plugins.
 * Each plugin registers itself with the engine and provides its own
 * configurable settings. "ولا كلمة" is the first plugin — not hardcoded
 * anywhere in the engine.
 *
 * To add a new interaction type or plugin, create a plugin module and register
 * it in `plugins/index.ts`. No engine changes needed.
 */

/** The six built-in interaction types. */
export type InteractionType =
  | 'normal'
  | 'qr'
  | 'audio'
  | 'video'
  | 'private-screen'
  | 'custom';

/** Arabic labels for interaction types. */
export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  normal: 'عادي',
  qr: 'QR',
  audio: 'صوت',
  video: 'فيديو',
  'private-screen': 'شاشة خاصة',
  custom: 'مخصص',
};

/** Icons (lucide names) for interaction types. */
export const INTERACTION_TYPE_ICONS: Record<InteractionType, string> = {
  normal: 'Circle',
  qr: 'QrCode',
  audio: 'AudioLines',
  video: 'Video',
  'private-screen': 'Smartphone',
  custom: 'Settings2',
};

/** A single configurable setting field for a plugin. */
export interface PluginConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'toggle' | 'select';
  default: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  hint?: string;
}

/** The schema a plugin declares — the admin UI renders fields from this. */
export type PluginConfigSchema = PluginConfigField[];

/** A plugin's config is a flat record of key → value. */
export type PluginConfig = Record<string, string | number | boolean>;

/** The status of a QR session. */
export type QRSessionStatus =
  | 'waiting' // QR shown, no scan yet
  | 'connected' // player scanned, viewing secret
  | 'expired' // timer ran out before scan
  | 'consumed' // single-use QR was used
  | 'timeout'; // player connected but connection timed out

/** A QR session for private content delivery. */
export interface QRSession {
  id: string;
  /** The interactive category this session belongs to. */
  categoryId: string;
  /** Secret content the player sees after scanning. */
  secretContent: string;
  /** Whether this QR is single-use. */
  singleUse: boolean;
  /** Expiration time in seconds from creation. */
  expirationSeconds: number;
  /** Connection timeout in seconds after the player connects. */
  connectionTimeoutSeconds: number;
  status: QRSessionStatus;
  createdAt: number;
  /** When the player connected (if connected). */
  connectedAt?: number;
}

/** An interactive category — a category bound to an interaction plugin. */
export interface InteractiveCategory {
  id: string;
  name: string;
  description: string;
  /** Which interaction type this category uses. */
  interactionType: InteractionType;
  /** Which plugin powers this category. */
  pluginId: string;
  /** The plugin-specific config. */
  config: PluginConfig;
  enabled: boolean;
}

/** The interface every plugin must implement. */
export interface InteractionPlugin {
  /** Unique plugin id, e.g. 'wordless', 'qr-base', 'audio-quiz'. */
  id: string;
  /** Arabic display name. */
  name: string;
  /** Arabic description. */
  description: string;
  /** Which interaction type this plugin provides. */
  interactionType: InteractionType;
  /** Default config values. */
  defaultConfig(): PluginConfig;
  /** Config schema — the admin UI renders editable fields from this. */
  configSchema(): PluginConfigSchema;
  /** Whether this plugin uses QR sessions. */
  usesQR?: boolean;
  /** Optional React node for plugin-specific admin UI (extra controls). */
  AdminExtra?: (props: { category: InteractiveCategory; onUpdate: (config: PluginConfig) => void }) => ReactNode;
}
