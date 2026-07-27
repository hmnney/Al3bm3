'use client';

import type { GameSettings } from '@/lib/types';
import { createDefaultState } from '@/lib/game';

const STORAGE_KEY = 'play-with-friends.settings';

const DEFAULT_SETTINGS: GameSettings = createDefaultState().settings;

/** Read persisted settings from localStorage (client-only, SSR-safe). */
export function readStoredSettings(): GameSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return null;
  }
}

/** Persist settings to localStorage (client-only, fails silently). */
export function writeStoredSettings(settings: GameSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / privacy errors
  }
}
