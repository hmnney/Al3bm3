'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Smartphone,
  Eye,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mobile Join Page — the lightweight page a player opens by scanning a QR code.
 *
 * This page is intentionally OUTSIDE the /admin tree and uses NO admin context.
 * It talks directly to the QR session manager (local, in-memory + localStorage)
 * to validate the session token and reveal the secret content.
 *
 * CRITICAL: the laptop/game screen NEVER reveals this content. Only this page
 * (on the player's phone) shows it, and only after the session is validated.
 */

// We import the session manager directly — it's a pure local module with no
// admin dependencies, so the mobile page stays fully isolated.
import {
  initSessions,
  getSession,
  revealSecret,
  statusLabel,
} from '../../admin/interactive/_lib/qr-session-manager';
import type { QRSession } from '../../admin/interactive/_lib/types';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'expired' }
  | { kind: 'consumed' }
  | { kind: 'timeout' }
  | { kind: 'ready'; session: QRSession }
  | { kind: 'revealed'; content: string };

export default function JoinPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? '';
  const [view, setView] = useState<ViewState>({ kind: 'loading' });

  // Initialize sessions + validate the token on mount.
  useEffect(() => {
    initSessions();
    const session = getSession(sessionId);
    if (!session) {
      setView({ kind: 'not-found' });
      return;
    }
    if (session.status === 'expired') {
      setView({ kind: 'expired' });
      return;
    }
    if (session.status === 'consumed') {
      setView({ kind: 'consumed' });
      return;
    }
    if (session.status === 'timeout') {
      setView({ kind: 'timeout' });
      return;
    }
    setView({ kind: 'ready', session });
  }, [sessionId]);

  const handleReveal = () => {
    const result = revealSecret(sessionId);
    if (result.ok && result.content) {
      setView({ kind: 'revealed', content: result.content });
    } else if (result.reason === 'expired') {
      setView({ kind: 'expired' });
    } else if (result.reason === 'consumed') {
      setView({ kind: 'consumed' });
    } else if (result.reason === 'timeout') {
      setView({ kind: 'timeout' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[hsl(250_33%_7%)] to-[hsl(250_30%_10%)] p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg">
            <Smartphone className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-black text-foreground">صفحة اللاعب</h1>
          <p className="text-sm text-muted-foreground">
            المحتوى السري يظهر هنا فقط — لا يظهر على شاشة اللعبة
          </p>
        </div>

        {view.kind === 'loading' && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border/50 bg-card/50 p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">جارٍ التحقق...</span>
          </div>
        )}

        {view.kind === 'not-found' && (
          <ErrorCard
            icon={AlertCircle}
            title="رمز غير صالح"
            message="هذا الرمز غير موجود أو تم حذفه. اطلب من المضيف توليد رمز جديد."
          />
        )}

        {view.kind === 'expired' && (
          <ErrorCard
            icon={Clock}
            title="انتهت صلاحية الرمز"
            message="انتهى وقت الرمز. اطلب من المضيف توليد رمز جديد."
          />
        )}

        {view.kind === 'consumed' && (
          <ErrorCard
            icon={CheckCircle2}
            title="تم استخدام الرمز"
            message="هذا الرمز للاستخدام مرة واحدة وقد استُخدم بالفعل."
          />
        )}

        {view.kind === 'timeout' && (
          <ErrorCard
            icon={Clock}
            title="انتهى وقت الاتصال"
            message="انتهى الوقت المسموح به لعرض المحتوى."
          />
        )}

        {view.kind === 'ready' && (
          <div className="flex flex-col gap-4 rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-black text-amber-500">
                <Clock className="h-3.5 w-3.5" />
                {statusLabel(view.session.status)}
              </span>
              {view.session.singleUse && (
                <span className="text-xs font-bold text-muted-foreground">استخدام مرة واحدة</span>
              )}
            </div>

            <p className="text-center text-sm text-muted-foreground">
              اضغط لعرض المحتوى السري — لن يظهر على شاشة اللعبة
            </p>
            <button
              onClick={handleReveal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:opacity-90"
            >
              <Eye className="h-5 w-5" />
              عرض المحتوى السري
            </button>
          </div>
        )}

        {view.kind === 'revealed' && (
          <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/40 bg-card/50 p-6 backdrop-blur">
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="text-xs font-bold text-emerald-500">المحتوى السري:</span>
              <div className="w-full rounded-xl border-2 border-primary/40 bg-primary/10 p-4 text-center">
                <p className="text-lg font-black leading-relaxed text-foreground">
                  {view.content}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorCard({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof AlertCircle;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-8 text-center">
      <Icon className="h-10 w-10 text-destructive" />
      <h2 className="text-lg font-black text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
