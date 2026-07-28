'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FolderTree,
  Database,
  ImageIcon,
  AudioLines,
  Video,
  ImageOff,
  AudioWaveform,
  VideoOff,
  HelpCircle,
  Copy,
  EyeOff,
  Power,
  Activity,
  AlertTriangle,
  Lightbulb,
  Loader2,
  TrendingUp,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { useAdmin } from '../_lib/admin-context';
import { useSettings } from '../_lib/settings-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../_components/admin-page-header';
import { StatCard } from '../_components/stat-card';
import { cn } from '@/lib/utils';
import { getDiagnostics } from './_lib';
import type {
  DiagnosticsResult,
  DiagnosticIssue,
  DiagnosticSuggestion,
} from './_lib';

export default function SystemDiagnosticsPage() {
  const { data, ready } = useAdmin();
  const { settings } = useSettings();
  const { toast } = useToast();
  const engine = useMemo(() => getDiagnostics(), []);

  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const r = await engine.analyze(
        data.categories,
        data.questions,
        settings.categories.hidden,
        settings.categories.disabled
      );
      setResult(r);
      toast({ title: 'اكتمل التشخيص', description: `نتيجة الصحة: ${r.health.score}/100` });
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر تشغيل التشخيص', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run on first hydration and whenever the underlying data changes.
  useEffect(() => {
    if (ready && !loading) runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data.categories, data.questions, settings.categories.hidden, settings.categories.disabled]);

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="تشخيص النظام"
        subtitle="تحليل شامل لصحة محتوى اللعبة"
        actions={
          <button
            onClick={runDiagnostics}
            disabled={loading || !ready}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            {loading ? 'جارٍ التحليل...' : 'إعادة التشخيص'}
          </button>
        }
      />

      {!ready || loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border-2 border-border/40 bg-card/30"
            />
          ))}
        </div>
      ) : result ? (
        <DiagnosticsView result={result} />
      ) : null}
    </div>
  );
}

function DiagnosticsView({ result }: { result: DiagnosticsResult }) {
  const { stats, health, issues, suggestions } = result;

  return (
    <div className="flex flex-col gap-8">
      {/* Health score */}
      <HealthScoreCard health={health} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي التصنيفات" value={stats.totalCategories} icon={FolderTree} gradient="from-purple-500 to-violet-600" />
        <StatCard label="إجمالي الأسئلة" value={stats.totalQuestions} icon={Database} gradient="from-blue-500 to-indigo-600" />
        <StatCard label="أسئلة بصور" value={stats.imagesCount} icon={ImageIcon} gradient="from-cyan-500 to-sky-600" />
        <StatCard label="أسئلة بصوت" value={stats.audioCount} icon={AudioLines} gradient="from-emerald-500 to-green-600" />
        <StatCard label="أسئلة بفيديو" value={stats.videoCount} icon={Video} gradient="from-rose-500 to-pink-600" />
        <StatCard label="صور مفقودة" value={stats.missingImages} icon={ImageOff} gradient="from-amber-500 to-orange-600" />
        <StatCard label="أصوات مفقودة" value={stats.missingAudio} icon={AudioWaveform} gradient="from-orange-500 to-red-600" />
        <StatCard label="فيديو مفقود" value={stats.missingVideo} icon={VideoOff} gradient="from-red-500 to-rose-600" />
        <StatCard label="بدون إجابة" value={stats.questionsWithoutAnswers} icon={HelpCircle} gradient="from-yellow-500 to-amber-600" />
        <StatCard label="أسئلة مكررة" value={stats.duplicateQuestions} icon={Copy} gradient="from-fuchsia-500 to-purple-600" />
        <StatCard label="تصنيفات مخفية" value={stats.hiddenCategories} icon={EyeOff} gradient="from-slate-500 to-gray-600" />
        <StatCard label="تصنيفات معطّلة" value={stats.disabledCategories} icon={Power} gradient="from-zinc-500 to-slate-600" />
      </div>

      {/* Per-category + per-difficulty breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BreakdownCard
          title="الأسئلة لكل تصنيف"
          icon={FolderTree}
          rows={stats.questionsPerCategory.map((c) => ({
            label: c.name,
            value: c.count,
          }))}
        />
        <BreakdownCard
          title="الأسئلة لكل صعوبة"
          icon={Scale}
          rows={[
            { label: 'سهل (250)', value: stats.questionsPerDifficulty.easy },
            { label: 'متوسط (500)', value: stats.questionsPerDifficulty.medium },
            { label: 'صعب (750)', value: stats.questionsPerDifficulty.hard },
          ]}
        />
      </div>

      {/* Issues + Suggestions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <IssuesCard issues={issues} />
        <SuggestionsCard suggestions={suggestions} />
      </div>
    </div>
  );
}

function HealthScoreCard({ health }: { health: DiagnosticsResult['health'] }) {
  const { score, breakdown } = health;
  const color =
    score >= 80
      ? 'from-emerald-500 to-green-600'
      : score >= 50
        ? 'from-amber-500 to-orange-600'
        : 'from-rose-500 to-red-600';
  const label =
    score >= 80 ? 'ممتاز' : score >= 50 ? 'يحتاج تحسين' : 'حرج';

  const factors: Array<{ key: keyof typeof breakdown; label: string; icon: typeof Activity }> = [
    { key: 'duplicates', label: 'التكرار', icon: Copy },
    { key: 'answers', label: 'الإجابات', icon: HelpCircle },
    { key: 'media', label: 'الوسائط', icon: ImageIcon },
    { key: 'categoryBalance', label: 'توازن التصنيفات', icon: FolderTree },
    { key: 'difficultyBalance', label: 'توازن الصعوبة', icon: Scale },
    { key: 'quality', label: 'جودة الأسئلة', icon: TrendingUp },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Score ring */}
        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="url(#healthGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 327} 327`}
            />
            <defs>
              <linearGradient id="healthGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e'} />
                <stop offset="100%" stopColor={score >= 80 ? '#22c55e' : score >= 50 ? '#f97316' : '#ef4444'} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-black tabular-nums text-foreground">{score}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className={cn('rounded-full bg-gradient-to-l px-3 py-1 text-sm font-black text-white', color)}>
              {label}
            </span>
            <span className="text-sm text-muted-foreground">درجة صحة النظام</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {factors.map((f) => {
              const v = breakdown[f.key];
              return (
                <div key={f.key} className="flex items-center gap-2 rounded-lg border border-border/30 bg-background/40 px-2.5 py-1.5">
                  <span className="flex h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: scoreColor(v) }} />
                  <span className="text-xs font-bold text-foreground">{v}</span>
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function scoreColor(v: number): string {
  return v >= 80 ? '#10b981' : v >= 50 ? '#f59e0b' : '#f43f5e';
}

function BreakdownCard({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Activity;
  rows: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-black text-foreground">{title}</h2>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm font-bold text-foreground">
              {r.label}
            </span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-background/40">
              <div
                className="absolute inset-y-0 right-0 rounded-lg bg-brand-gradient transition-all"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-center text-sm font-black tabular-nums text-primary">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssuesCard({ issues }: { issues: DiagnosticIssue[] }) {
  return (
    <div className="rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-black text-foreground">المشكلات ({issues.length})</h2>
      </div>
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-3 text-sm font-bold text-success">
          <CheckCircle2 className="h-4 w-4" />
          لا توجد مشكلات — النظام بحالة جيدة.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: DiagnosticIssue }) {
  const styles: Record<string, { border: string; bg: string; text: string; icon: typeof AlertTriangle }> = {
    critical: { border: 'border-destructive/40', bg: 'bg-destructive/5', text: 'text-destructive', icon: AlertTriangle },
    warning: { border: 'border-amber-500/40', bg: 'bg-amber-500/5', text: 'text-amber-500', icon: AlertTriangle },
    info: { border: 'border-sky-500/40', bg: 'bg-sky-500/5', text: 'text-sky-500', icon: Lightbulb },
  };
  const s = styles[issue.severity];
  const Icon = s.icon;
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5', s.border, s.bg)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.text)} />
      <span className="text-sm text-foreground">{issue.message}</span>
    </div>
  );
}

function SuggestionsCard({ suggestions }: { suggestions: DiagnosticSuggestion[] }) {
  const priorityLabel: Record<string, string> = {
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
  };
  const priorityColor: Record<string, string> = {
    high: 'text-destructive',
    medium: 'text-amber-500',
    low: 'text-sky-500',
  };
  return (
    <div className="rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-black text-foreground">اقتراحات ({suggestions.length})</h2>
      </div>
      {suggestions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-3 text-sm font-bold text-success">
          <CheckCircle2 className="h-4 w-4" />
          لا توجد اقتراحات حالياً.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map((sug, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-border/30 bg-background/40 px-3 py-2.5"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm text-foreground">{sug.message}</span>
              <span className={cn('shrink-0 text-xs font-black', priorityColor[sug.priority])}>
                {priorityLabel[sug.priority]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
