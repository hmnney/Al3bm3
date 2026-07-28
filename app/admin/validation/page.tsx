'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '../_lib/admin-context';
import { useSettings } from '../_lib/settings-context';
import { useInteractive } from '../interactive/_lib';
import { AdminPageHeader } from '../_components/admin-page-header';
import {
  runValidation,
  applyFix,
  type ValidationReport,
  type ValidationContext,
  type CheckResult,
} from './_lib';
import { cn } from '@/lib/utils';

export default function ValidationPage() {
  const { data, deleteQuestion } = useAdmin();
  const { settings, update } = useSettings();
  const {
    categories: interactiveCategories,
    sessions,
    updateCategory: updateInteractiveCategory,
    createSession,
  } = useInteractive();
  const { toast } = useToast();

  const [report, setReport] = useState<ValidationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [applyingFixId, setApplyingFixId] = useState<string | null>(null);

  const ctx: ValidationContext = useMemo(
    () => ({
      categories: data.categories,
      questions: data.questions,
      settings,
      interactiveCategories,
      sessions,
    }),
    [data.categories, data.questions, settings, interactiveCategories, sessions]
  );

  const handleRun = useCallback(async () => {
    setRunning(true);
    setReport(null);
    try {
      const result = await runValidation(ctx);
      setReport(result);
    } catch (err) {
      toast({
        title: 'تعذّر التحقق',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  }, [ctx, toast]);

  const handleFix = useCallback(
    async (check: CheckResult) => {
      if (!check.fix) return;
      if (check.fix.navigates && check.fix.href) {
        window.location.href = check.fix.href;
        return;
      }
      setApplyingFixId(check.fix.id);
      try {
        const result = await applyFix(check.fix.id, ctx, {
          deleteQuestions: (ids) => ids.forEach((id) => deleteQuestion(id)),
          updateSettings: update,
          updateInteractiveCategory,
          createQRSession: (input) => createSession(input),
        });
        toast({
          title: result.applied ? 'تم الإصلاح' : 'لا حاجة للإصلاح',
          description: result.message,
        });
        // Re-run validation after fix.
        await handleRun();
      } catch (err) {
        toast({
          title: 'تعذّر الإصلاح',
          description: (err as Error).message,
          variant: 'destructive',
        });
      } finally {
        setApplyingFixId(null);
      }
    },
    [ctx, deleteQuestion, update, updateInteractiveCategory, createSession, toast, handleRun]
  );

  const passedChecks = report?.checks.filter((c) => c.status === 'pass') ?? [];
  const failedChecks = report?.checks.filter((c) => c.status === 'fail') ?? [];
  const warningChecks = report?.checks.filter((c) => c.status === 'warning') ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="التحقق من اللعبة"
        subtitle="افحص جاهزية اللعبة قبل النشر — كل التصنيفات والإعدادات والأنظمة"
        actions={
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition-all',
              running
                ? 'cursor-not-allowed bg-muted/30 text-muted-foreground'
                : 'bg-brand-gradient text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]'
            )}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {report ? 'إعادة الفحص' : 'بدء الفحص'}
          </button>
        }
      />

      {/* ---- Idle state ---- */}
      {!report && !running && (
        <div className="animate-fade-in flex flex-col items-center gap-6 rounded-2xl border-2 border-dashed border-border/50 bg-card/30 p-16 text-center backdrop-blur">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-primary">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              جاهز للفحص
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              سيتم فحص التصنيفات والأسئلة والإعدادات والأنظمة التفاعلية والذكاء
              الاصطناعي. اضغط "بدء الفحص" لبدء التحقق الشامل.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRun}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-8 py-3.5 text-base font-black text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShieldCheck className="h-5 w-5" />
            بدء الفحص الشامل
          </button>
        </div>
      )}

      {/* ---- Running state ---- */}
      {running && (
        <div className="animate-fade-in flex flex-col items-center gap-6 rounded-2xl border-2 border-border/50 bg-card/40 p-16 text-center backdrop-blur">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-gradient text-white shadow-lg glow-primary">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-black text-foreground sm:text-2xl">
            يجري فحص اللعبة…
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            يتم التحقق من جميع الأنظمة بالترتيب. قد يستغرق الاتصال بمزود الذكاء
            الاصطناعي لحظات.
          </p>
        </div>
      )}

      {/* ---- Report ---- */}
      {report && !running && (
        <div className="animate-fade-in space-y-6">
          {/* Readiness score */}
          <ReadinessScore report={report} />

          {/* Summary counts */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              icon={CheckCircle2}
              label="ناجح"
              count={report.passed}
              tone="success"
            />
            <SummaryCard
              icon={XCircle}
              label="فاشل"
              count={report.failed}
              tone="error"
            />
            <SummaryCard
              icon={AlertTriangle}
              label="تحذير"
              count={report.warnings}
              tone="warning"
            />
          </div>

          {/* Failed checks */}
          {failedChecks.length > 0 && (
            <CheckSection
              title="فحوصات فاشلة"
              icon={XCircle}
              tone="error"
              checks={failedChecks}
              onFix={handleFix}
              applyingFixId={applyingFixId}
            />
          )}

          {/* Warnings */}
          {warningChecks.length > 0 && (
            <CheckSection
              title="تحذيرات"
              icon={AlertTriangle}
              tone="warning"
              checks={warningChecks}
              onFix={handleFix}
              applyingFixId={applyingFixId}
            />
          )}

          {/* Passed checks */}
          {passedChecks.length > 0 && (
            <CheckSection
              title="فحوصات ناجحة"
              icon={CheckCircle2}
              tone="success"
              checks={passedChecks}
              onFix={handleFix}
              applyingFixId={applyingFixId}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function ReadinessScore({ report }: { report: ValidationReport }) {
  const config = {
    green: {
      icon: ShieldCheck,
      label: 'اللعبة جاهزة',
      ring: 'from-emerald-500 to-green-600',
      text: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
    },
    yellow: {
      icon: ShieldAlert,
      label: 'اللعبة شبه جاهزة',
      ring: 'from-amber-500 to-orange-600',
      text: 'text-amber-600',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
    },
    red: {
      icon: ShieldX,
      label: 'اللعبة غير جاهزة',
      ring: 'from-rose-500 to-red-600',
      text: 'text-rose-600',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
    },
  }[report.level];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 p-8 backdrop-blur',
        config.bg,
        config.border
      )}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        {/* Circular score */}
        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
          <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="10"
              className="stroke-muted/30"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(report.score / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
              className={cn(
                'transition-all duration-700',
                report.level === 'green' && 'stroke-emerald-500',
                report.level === 'yellow' && 'stroke-amber-500',
                report.level === 'red' && 'stroke-rose-500'
              )}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={cn('text-4xl font-black tabular-nums', config.text)}>
              {report.score}
            </span>
            <span className="text-xs font-bold text-muted-foreground">%</span>
          </div>
        </div>

        {/* Label + status */}
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-7 w-7', config.text)} />
            <h2 className="text-2xl font-black text-foreground sm:text-3xl">
              {config.label}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {report.passed} ناجح · {report.warnings} تحذير · {report.failed} فاشل
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">
              جاهزية اللعبة:
            </span>
            <span className={cn('text-lg font-black', config.text)}>
              {report.score}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  tone: 'success' | 'error' | 'warning';
}) {
  const toneClasses = {
    success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    error: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  }[tone];

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-4 backdrop-blur', toneClasses)}>
      <Icon className="h-6 w-6 shrink-0" />
      <div className="flex flex-col">
        <span className="text-2xl font-black tabular-nums">{count}</span>
        <span className="text-xs font-bold opacity-80">{label}</span>
      </div>
    </div>
  );
}

function CheckSection({
  title,
  icon: Icon,
  tone,
  checks,
  onFix,
  applyingFixId,
}: {
  title: string;
  icon: React.ElementType;
  tone: 'success' | 'error' | 'warning';
  checks: CheckResult[];
  onFix: (check: CheckResult) => void;
  applyingFixId: string | null;
}) {
  const toneClasses = {
    success: 'text-emerald-600',
    error: 'text-rose-600',
    warning: 'text-amber-600',
  }[tone];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-5 w-5', toneClasses)} />
        <h3 className="text-base font-black text-foreground">{title}</h3>
        <span className="text-xs font-bold text-muted-foreground">({checks.length})</span>
      </div>
      <div className="space-y-2">
        {checks.map((check) => (
          <CheckCard
            key={check.id}
            check={check}
            onFix={onFix}
            applyingFixId={applyingFixId}
          />
        ))}
      </div>
    </div>
  );
}

function CheckCard({
  check,
  onFix,
  applyingFixId,
}: {
  check: CheckResult;
  onFix: (check: CheckResult) => void;
  applyingFixId: string | null;
}) {
  const statusConfig = {
    pass: {
      icon: CheckCircle2,
      border: 'border-emerald-500/20',
      iconColor: 'text-emerald-600',
      bg: 'bg-emerald-500/5',
    },
    fail: {
      icon: XCircle,
      border: 'border-rose-500/20',
      iconColor: 'text-rose-600',
      bg: 'bg-rose-500/5',
    },
    warning: {
      icon: AlertTriangle,
      border: 'border-amber-500/20',
      iconColor: 'text-amber-600',
      bg: 'bg-amber-500/5',
    },
  }[check.status];

  const Icon = statusConfig.icon;
  const isFixing = check.fix ? applyingFixId === check.fix.id : false;

  return (
    <div className={cn('rounded-xl border-2 p-4 backdrop-blur', statusConfig.border, statusConfig.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', statusConfig.iconColor)} />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-black text-foreground">{check.title}</span>
            <span className="text-xs text-muted-foreground">{check.description}</span>
          </div>
        </div>
        {check.fix && (
          <button
            type="button"
            onClick={() => onFix(check)}
            disabled={isFixing}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all',
              check.fix.navigates
                ? 'border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-brand-gradient text-white hover:brightness-110',
              isFixing && 'cursor-not-allowed opacity-60'
            )}
          >
            {isFixing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : check.fix.navigates ? (
              <ArrowLeft className="h-3.5 w-3.5" />
            ) : (
              <Wrench className="h-3.5 w-3.5" />
            )}
            {check.fix.label}
          </button>
        )}
      </div>
      {check.details.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border/30 pt-3">
          {check.details.map((d, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {d.severity === 'error' ? (
                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
              ) : d.severity === 'warning' ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              ) : (
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">{d.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
