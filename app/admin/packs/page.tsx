'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Package,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useAdmin } from '../_lib/admin-context';
import { useSettings } from '../_lib/settings-context';
import { getAIProvider } from '../ai/_lib';
import type { AIProviderConfig, GenerateRequest } from '../ai/_lib';
import type { AdminQuestion, AdminCategory } from '../_lib/types';
import { AdminPageHeader } from '../_components/admin-page-header';
import { POINT_VALUES } from '@/lib/constants';
import type { PointValue, QuestionDifficulty } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Target questions per category for "full" completion. */
const TARGET_PER_CATEGORY = 30;

/** Point distribution weights — roughly 40% easy (250), 35% medium (500), 25% hard (750). */
const POINT_WEIGHTS: Array<{ points: PointValue; weight: number }> = [
  { points: 250, weight: 0.4 },
  { points: 500, weight: 0.35 },
  { points: 750, weight: 0.25 },
];

const GENERATE_COUNTS = [10, 25, 50, 100] as const;

const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];

const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

interface CategoryStats {
  total: number;
  perPoints: Record<PointValue, number>;
  perDifficulty: Record<QuestionDifficulty, number>;
}

function computeStats(questions: AdminQuestion[]): CategoryStats {
  const perPoints: Record<PointValue, number> = { 250: 0, 500: 0, 750: 0 };
  const perDifficulty: Record<QuestionDifficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  for (const q of questions) {
    perPoints[q.points] = (perPoints[q.points] ?? 0) + 1;
    perDifficulty[q.difficulty] = (perDifficulty[q.difficulty] ?? 0) + 1;
  }
  return { total: questions.length, perPoints, perDifficulty };
}

/** Distribute N questions across point tiers using the weights. */
function distributePoints(count: number): PointValue[] {
  const result: PointValue[] = [];
  for (const { points, weight } of POINT_WEIGHTS) {
    const n = Math.round(count * weight);
    for (let i = 0; i < n; i++) result.push(points);
  }
  while (result.length < count) result.push(250);
  return result.slice(0, count);
}

/** Map a point value to a difficulty. */
function difficultyForPoints(points: PointValue): QuestionDifficulty {
  if (points === 250) return 'easy';
  if (points === 500) return 'medium';
  return 'hard';
}

export default function QuestionPacksPage() {
  const { data, addQuestion, questionsFor } = useAdmin();
  const { settings } = useSettings();

  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const statsByCategory = useMemo(() => {
    const map: Record<string, CategoryStats> = {};
    for (const cat of data.categories) {
      map[cat.id] = computeStats(questionsFor(cat.id));
    }
    return map;
  }, [data.categories, data.questions, questionsFor]);

  const handleGenerate = useCallback(
    async (category: AdminCategory, count: number) => {
      setGeneratingFor(category.id);
      setError(null);
      setSuccess(null);
      try {
        const aiConfig: AIProviderConfig = {
          provider: settings.ai.provider,
          apiKey: settings.ai.apiKey,
          model: settings.ai.model,
          temperature: settings.ai.temperature,
          maxTokens: settings.ai.maxTokens,
          enabled: settings.ai.enabled,
        };
        const provider = getAIProvider(aiConfig);

        const existingQuestions = questionsFor(category.id);
        const existingTexts = new Set(
          existingQuestions.map((q) => normalize(q.question))
        );

        const pointDistribution = distributePoints(count);
        const request: GenerateRequest = {
          topic: category.name,
          category: category.name,
          difficulty: 'medium',
          count,
        };

        const aiQuestions = await provider.generateQuestions(request, aiConfig);

        if (!aiQuestions || aiQuestions.length === 0) {
          setError('لم يُرجع المزود أي أسئلة. تحقق من الاتصال أو جرّب مرة أخرى.');
          return;
        }

        const fresh: AdminQuestion[] = [];
        let dupSkipped = 0;
        for (let i = 0; i < aiQuestions.length; i++) {
          const ai = aiQuestions[i];
          const text = ai.question?.trim();
          if (!text) continue;
          const norm = normalize(text);
          if (existingTexts.has(norm) || fresh.some((q) => normalize(q.question) === norm)) {
            dupSkipped++;
            continue;
          }
          const points = pointDistribution[i % pointDistribution.length];
          existingTexts.add(norm);
          fresh.push({
            id: `gen-${category.id}-${Date.now().toString(36)}-${i}`,
            categoryId: category.id,
            difficulty: ai.difficulty || difficultyForPoints(points),
            points,
            question: text,
            answer: ai.answer?.trim() || '',
          });
        }

        if (fresh.length === 0) {
          setError('كل الأسئلة المُولّدة مكررة — لم يُضف anything جديد.');
          return;
        }

        for (const q of fresh) addQuestion(q);

        setSuccess(
          `تمت إضافة ${fresh.length} سؤال جديد${dupSkipped > 0 ? ` (تخطّي ${dupSkipped} مكرر)` : ''}.`
        );
      } catch (e) {
        setError((e as Error).message || 'حدث خطأ أثناء التوليد.');
      } finally {
        setGeneratingFor(null);
      }
    },
    [settings.ai, questionsFor, addQuestion]
  );

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="حزم الأسئلة"
        subtitle="أنشئ حزم أسئلة كاملة لكل تصنيف، وتابع نسبة الاكتمال، واملأ اللعبة بسرعة"
      />

      {/* Global summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="التصنيفات"
          value={data.categories.length}
          icon={<Layers className="h-5 w-5" />}
        />
        <SummaryStat
          label="إجمالي الأسئلة"
          value={data.questions.length}
          icon={<Package className="h-5 w-5" />}
        />
        <SummaryStat
          label="الهدف لكل تصنيف"
          value={TARGET_PER_CATEGORY}
          icon={<Sparkles className="h-5 w-5" />}
        />
        <SummaryStat
          label="الهدف الإجمالي"
          value={data.categories.length * TARGET_PER_CATEGORY}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      {/* AI status banner */}
      {!settings.ai.enabled && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm font-bold text-amber-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          الذكاء الاصطناعي معطّل — سيُستخدم المحرك المحلي (Mock AI) لتوليد أسئلة تجريبية.
          فعّل الذكاء الاصطناعي من صفحة إعدادات AI لتوليد أسئلة حقيقية.
        </div>
      )}

      {/* Error / success messages */}
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm font-bold text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Category cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.categories.map((cat) => (
          <CategoryPackCard
            key={cat.id}
            category={cat}
            stats={statsByCategory[cat.id] ?? { total: 0, perPoints: { 250: 0, 500: 0, 750: 0 }, perDifficulty: { easy: 0, medium: 0, hard: 0 } }}
            generating={generatingFor === cat.id}
            onGenerate={(count) => handleGenerate(cat, count)}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-border/50 bg-card/40 px-4 py-3 backdrop-blur">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-black tabular-nums text-foreground">{value}</span>
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function CategoryPackCard({
  category,
  stats,
  generating,
  onGenerate,
}: {
  category: AdminCategory;
  stats: CategoryStats;
  generating: boolean;
  onGenerate: (count: number) => void;
}) {
  const pct = Math.min(100, Math.round((stats.total / TARGET_PER_CATEGORY) * 100));
  const remaining = Math.max(0, TARGET_PER_CATEGORY - stats.total);
  const isComplete = stats.total >= TARGET_PER_CATEGORY;

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border-2 bg-card/40 p-5 backdrop-blur transition-all',
        isComplete ? 'border-success/40' : 'border-border/50 hover:border-primary/40'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-2xl',
            category.gradient
          )}
        >
          {category.glyph}
        </div>
        <div className="flex flex-1 flex-col">
          <h3 className="text-lg font-black text-foreground">{category.name}</h3>
          <p className="text-xs text-muted-foreground">{category.description}</p>
        </div>
        {isComplete && (
          <div className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-black text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            مكتمل
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-muted-foreground">
            {stats.total} / {TARGET_PER_CATEGORY} سؤال
          </span>
          <span
            className={cn(
              'tabular-nums',
              isComplete ? 'text-success' : pct >= 50 ? 'text-primary' : 'text-amber-500'
            )}
          >
            {pct}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isComplete
                ? 'bg-success'
                : 'bg-gradient-to-l from-primary via-primary-glow to-secondary'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {!isComplete && (
          <span className="text-xs text-muted-foreground">
            بقي {remaining} سؤال حتى الاكتمال
          </span>
        )}
      </div>

      {/* Point distribution */}
      <div className="grid grid-cols-3 gap-2">
        {POINT_VALUES.map((p) => (
          <div
            key={p}
            className="flex flex-col items-center gap-0.5 rounded-lg border border-border/40 bg-background/40 px-2 py-2"
          >
            <span className="text-lg font-black tabular-nums text-foreground">
              {stats.perPoints[p]}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">{p} نقطة</span>
          </div>
        ))}
      </div>

      {/* Difficulty distribution */}
      <div className="grid grid-cols-3 gap-2">
        {DIFFICULTIES.map((d) => (
          <div
            key={d}
            className="flex flex-col items-center gap-0.5 rounded-lg border border-border/40 bg-background/40 px-2 py-2"
          >
            <span className="text-lg font-black tabular-nums text-foreground">
              {stats.perDifficulty[d]}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              {DIFFICULTY_LABELS[d]}
            </span>
          </div>
        ))}
      </div>

      {/* Generate buttons */}
      <div className="flex flex-wrap gap-2">
        {GENERATE_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            disabled={generating}
            onClick={() => onGenerate(count)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              generating
                ? 'cursor-not-allowed border-border/40 bg-muted/20 text-muted-foreground'
                : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:-translate-y-0.5 active:scale-95'
            )}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? 'جارٍ التوليد...' : `توليد ${count}`}
          </button>
        ))}
      </div>
    </div>
  );
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}
