import type { QRSession, QRSessionStatus } from './types';
import {
  genId,
  loadQRSessions,
  saveQRSessions,
} from './store';

/**
 * QR Session Manager — orchestrates secure one-time QR sessions for private
 * content delivery. All local, no external APIs.
 *
 * Lifecycle:
 *   waiting → connected → consumed (single-use) / timeout
 *   waiting → expired (timer ran out)
 *
 * The laptop/game screen NEVER reveals the secret content — only the player
 * who scans the QR and opens the mobile page sees it. This manager issues
 * session tokens; the mobile page validates the token to reveal content.
 */

let sessions: Record<string, QRSession> = {};

/** Initialize from localStorage. Call once on mount. */
export function initSessions(): void {
  sessions = loadQRSessions();
  // Clean up any already-expired sessions on load.
  const now = Date.now();
  let changed = false;
  for (const id of Object.keys(sessions)) {
    const s = sessions[id];
    if (s.status === 'waiting') {
      const elapsed = (now - s.createdAt) / 1000;
      if (elapsed >= s.expirationSeconds) {
        sessions[id] = { ...s, status: 'expired' };
        changed = true;
      }
    } else if (s.status === 'connected' && s.connectedAt) {
      const elapsed = (now - s.connectedAt) / 1000;
      if (elapsed >= s.connectionTimeoutSeconds) {
        sessions[id] = { ...s, status: 'timeout' };
        changed = true;
      }
    }
  }
  if (changed) saveQRSessions(sessions);
}

/** Create a new QR session for a category. Returns the session. */
export function createSession(input: {
  categoryId: string;
  secretContent: string;
  singleUse: boolean;
  expirationSeconds: number;
  connectionTimeoutSeconds: number;
}): QRSession {
  const session: QRSession = {
    id: genId('qr'),
    categoryId: input.categoryId,
    secretContent: input.secretContent,
    singleUse: input.singleUse,
    expirationSeconds: input.expirationSeconds,
    connectionTimeoutSeconds: input.connectionTimeoutSeconds,
    status: 'waiting',
    createdAt: Date.now(),
  };
  sessions[session.id] = session;
  saveQRSessions(sessions);
  return session;
}

/** Get a session by id. */
export function getSession(id: string): QRSession | undefined {
  return sessions[id];
}

/** Regenerate: create a fresh session for the same category, retire the old. */
export function regenerateSession(oldId: string): QRSession | null {
  const old = sessions[oldId];
  if (!old) return null;
  const next = createSession({
    categoryId: old.categoryId,
    secretContent: old.secretContent,
    singleUse: old.singleUse,
    expirationSeconds: old.expirationSeconds,
    connectionTimeoutSeconds: old.connectionTimeoutSeconds,
  });
  // Retire the old one.
  delete sessions[oldId];
  saveQRSessions(sessions);
  return next;
}

/** A player scanned the QR and is connecting. Validate + reveal content. */
export function connectSession(id: string): { ok: boolean; session?: QRSession; reason?: string } {
  const s = sessions[id];
  if (!s) return { ok: false, reason: 'not-found' };
  // Expire waiting sessions whose timer ran out.
  if (s.status === 'waiting') {
    const elapsed = (Date.now() - s.createdAt) / 1000;
    if (elapsed >= s.expirationSeconds) {
      sessions[id] = { ...s, status: 'expired' };
      saveQRSessions(sessions);
      return { ok: false, reason: 'expired' };
    }
  }
  if (s.status === 'expired') return { ok: false, reason: 'expired' };
  if (s.status === 'consumed') return { ok: false, reason: 'consumed' };
  if (s.status === 'timeout') return { ok: false, reason: 'timeout' };
  if (s.status === 'connected') {
    // Already connected — allow re-view within connection timeout.
    return { ok: true, session: s };
  }
  // waiting → connected
  const updated: QRSession = { ...s, status: 'connected', connectedAt: Date.now() };
  sessions[id] = updated;
  saveQRSessions(sessions);
  return { ok: true, session: updated };
}

/** Reveal the secret content for a connected session. Validates state. */
export function revealSecret(id: string): { ok: boolean; content?: string; reason?: string } {
  const s = sessions[id];
  if (!s) return { ok: false, reason: 'not-found' };
  if (s.status === 'expired') return { ok: false, reason: 'expired' };
  if (s.status === 'consumed') return { ok: false, reason: 'consumed' };
  if (s.status === 'timeout') return { ok: false, reason: 'timeout' };
  // If waiting, the player must connect first.
  if (s.status === 'waiting') {
    const elapsed = (Date.now() - s.createdAt) / 1000;
    if (elapsed >= s.expirationSeconds) {
      sessions[id] = { ...s, status: 'expired' };
      saveQRSessions(sessions);
      return { ok: false, reason: 'expired' };
    }
    // Auto-connect on reveal (mobile page calls connect then reveal).
    sessions[id] = { ...s, status: 'connected', connectedAt: Date.now() };
  }
  // Check connection timeout.
  const connectedAt = sessions[id].connectedAt ?? Date.now();
  const elapsed = (Date.now() - connectedAt) / 1000;
  if (sessions[id].status === 'connected' && elapsed >= sessions[id].connectionTimeoutSeconds) {
    sessions[id] = { ...sessions[id], status: 'timeout' };
    saveQRSessions(sessions);
    return { ok: false, reason: 'timeout' };
  }
  // Mark consumed if single-use.
  if (sessions[id].singleUse) {
    sessions[id] = { ...sessions[id], status: 'consumed' };
  }
  saveQRSessions(sessions);
  return { ok: true, content: sessions[id].secretContent };
}

/** Tick: update session statuses based on elapsed time. Returns changed ids. */
export function tickSessions(): string[] {
  const now = Date.now();
  const changed: string[] = [];
  for (const id of Object.keys(sessions)) {
    const s = sessions[id];
    if (s.status === 'waiting') {
      const elapsed = (now - s.createdAt) / 1000;
      if (elapsed >= s.expirationSeconds) {
        sessions[id] = { ...s, status: 'expired' };
        changed.push(id);
      }
    } else if (s.status === 'connected' && s.connectedAt) {
      const elapsed = (now - s.connectedAt) / 1000;
      if (elapsed >= s.connectionTimeoutSeconds) {
        sessions[id] = { ...s, status: 'timeout' };
        changed.push(id);
      }
    }
  }
  if (changed.length) saveQRSessions(sessions);
  return changed;
}

/** Get all sessions. */
export function getAllSessions(): QRSession[] {
  return Object.values(sessions);
}

/** Get sessions for a category. */
export function sessionsForCategory(categoryId: string): QRSession[] {
  return Object.values(sessions).filter((s) => s.categoryId === categoryId);
}

/** Delete a session. */
export function deleteSession(id: string): void {
  delete sessions[id];
  saveQRSessions(sessions);
}

/** Arabic label for a session status. */
export function statusLabel(status: QRSessionStatus): string {
  const labels: Record<QRSessionStatus, string> = {
    waiting: 'بانتظار المسح',
    connected: 'متصل',
    expired: 'منتهي',
    consumed: 'مُستخدم',
    timeout: 'انتهى الاتصال',
  };
  return labels[status];
}
