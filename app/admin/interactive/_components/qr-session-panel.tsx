'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  QrCode,
  RefreshCw,
  Smartphone,
  Clock,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useInteractive, statusLabel } from '../_lib';
import type { InteractiveCategory, QRSession } from '../_lib';
import { cn } from '@/lib/utils';

/**
 * QR Session Panel — admin control for a single QR-based interactive category.
 * Lets the host generate a secure one-time QR, see connection status, and
 * regenerate. The laptop screen NEVER reveals the secret content — only the
 * player who scans sees it on their phone.
 */
export function QRSessionPanel({ category }: { category: InteractiveCategory }) {
  const { createSession, regenerateQR, sessions, ready } = useInteractive();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const activeSession = useMemo<QRSession | undefined>(() => {
    const catSessions = sessions.filter((s) => s.categoryId === category.id);
    // Most recent non-expired/non-consumed session.
    return catSessions.find(
      (s) => s.status === 'waiting' || s.status === 'connected'
    );
  }, [sessions, category.id]);

  const secretContent = String(category.config.secretContent ?? '');
  const singleUse = Boolean(category.config.singleUse ?? true);
  const expirationSeconds = Number(category.config.expirationSeconds ?? 120);
  const connectionTimeoutSeconds = Number(category.config.connectionTimeoutSeconds ?? 60);

  // The mobile join URL — points to the lightweight mobile page.
  const joinUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const s = activeSession;
    if (!s) return '';
    return `${window.location.origin}/join/${s.id}`;
  }, [activeSession]);

  // Generate QR data URL when the join URL changes.
  useEffect(() => {
    if (!joinUrl) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(joinUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#7c3aed', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  const handleGenerate = async () => {
    setGenerating(true);
    createSession({
      categoryId: category.id,
      secretContent,
      singleUse,
      expirationSeconds,
      connectionTimeoutSeconds,
    });
    setTimeout(() => setGenerating(false), 300);
  };

  const handleRegenerate = () => {
    if (!activeSession) return;
    regenerateQR(activeSession.id);
  };

  if (!ready) return null;

  const status = activeSession?.status;

  return (
    <div className="rounded-2xl border-2 border-border/50 bg-card/50 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <QrCode className="h-5 w-5 text-primary" />
        <h3 className="text-base font-black text-foreground">لوحة تحكم QR</h3>
      </div>

      {!activeSession ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            لا يوجد رمز QR نشط — أنشئ رمزاً جديداً ليتمكن اللاعب من المسح
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating || !secretContent}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            توليد QR
          </button>
          {!secretContent && (
            <span className="text-xs text-destructive">أضف محتوى سرياً في إعدادات الإضافة أولاً</span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {/* QR code */}
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-xl bg-white p-3 shadow-lg">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="h-40 w-40" />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">امسح بالهاتف للانضمام</span>
          </div>

          {/* Status */}
          <div className="flex flex-1 flex-col gap-3">
            <StatusBadge status={status ?? 'waiting'} />

            {status === 'waiting' && (
              <Countdown
                createdAt={activeSession.createdAt}
                seconds={activeSession.expirationSeconds}
                label="ينتهي خلال"
              />
            )}
            {status === 'connected' && activeSession.connectedAt && (
              <Countdown
                createdAt={activeSession.connectedAt}
                seconds={activeSession.connectionTimeoutSeconds}
                label="ينتهي اتصال اللاعب خلال"
              />
            )}

            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" />
                المحتوى السري يظهر على هاتف اللاعب فقط
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                استخدام مرة واحدة: {activeSession.singleUse ? 'نعم' : 'لا'}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs font-bold text-foreground transition-all hover:border-primary/50 hover:bg-primary/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                إعادة توليد
              </button>
              <button
                onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20"
              >
                <QrCode className="h-3.5 w-3.5" />
                رمز جديد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: QRSession['status'] }) {
  const styles: Record<string, { bg: string; text: string; icon: typeof Check }> = {
    waiting: { bg: 'bg-amber-500/15', text: 'text-amber-500', icon: Clock },
    connected: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', icon: Smartphone },
    expired: { bg: 'bg-destructive/15', text: 'text-destructive', icon: X },
    consumed: { bg: 'bg-primary/15', text: 'text-primary', icon: Check },
    timeout: { bg: 'bg-destructive/15', text: 'text-destructive', icon: X },
  };
  const s = styles[status] ?? styles.waiting;
  const Icon = s.icon;
  return (
    <div className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black', s.bg, s.text)}>
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </div>
  );
}

function Countdown({
  createdAt,
  seconds,
  label,
}: {
  createdAt: number;
  seconds: number;
  label: string;
}) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - createdAt) / 1000;
      setRemaining(Math.max(0, seconds - elapsed));
    };
    tick();
    const i = window.setInterval(tick, 1000);
    return () => window.clearInterval(i);
  }, [createdAt, seconds]);

  const pct = (remaining / seconds) * 100;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-background/40">
          <div
            className={cn(
              'absolute inset-y-0 right-0 rounded-full transition-all',
              pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-destructive'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 text-center text-xs font-black tabular-nums text-foreground">
          {Math.ceil(remaining)}ث
        </span>
      </div>
    </div>
  );
}
