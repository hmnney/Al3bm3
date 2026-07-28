'use client';

import { loadSecuritySettings } from './settings-store';

/**
 * Minimal admin auth gate. The admin panel is "protected" by a password that
 * is now configurable from the Security settings page (persisted locally).
 *
 * This is NOT real security — it is a lightweight client-side gate to keep the
 * panel out of casual reach. Future work can swap this for Supabase auth
 * without touching the panel UI.
 *
 * Session timeout + auto-logout are driven by the Security settings and
 * enforced here via an inactivity timer.
 */

const AUTH_KEY = 'admin-auth-v1';
const LAST_ACTIVE_KEY = 'admin-auth-last-active-v1';

/** Backwards-compatible default password (matches the original constant). */
export const ADMIN_PASSWORD = 'admin123';

/** Read the configured admin password from settings, with a safe fallback. */
export function getConfiguredPassword(): string {
  try {
    return loadSecuritySettings().adminPassword || ADMIN_PASSWORD;
  } catch {
    return ADMIN_PASSWORD;
  }
}

export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(AUTH_KEY) === 'true';
}

export function authenticateAdmin(password: string): boolean {
  if (typeof window === 'undefined') return false;
  if (password === getConfiguredPassword()) {
    window.localStorage.setItem(AUTH_KEY, 'true');
    window.localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
    return true;
  }
  return false;
}

export function logoutAdmin(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem(LAST_ACTIVE_KEY);
}

/** Record the current time as the last activity moment. */
export function touchSession(): void {
  if (typeof window === 'undefined') return;
  if (!isAdminAuthenticated()) return;
  window.localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

/**
 * If auto-logout is enabled and the inactivity window has elapsed, clear the
 * session and return true so callers can redirect to the login page.
 * Returns false otherwise.
 */
export function checkSessionExpiry(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isAdminAuthenticated()) return false;
  try {
    const sec = loadSecuritySettings();
    if (!sec.autoLogout || sec.sessionTimeout <= 0) return false;
    const last = Number(window.localStorage.getItem(LAST_ACTIVE_KEY) || 0);
    if (!last) return false;
    const elapsedMin = (Date.now() - last) / 60000;
    if (elapsedMin >= sec.sessionTimeout) {
      logoutAdmin();
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
