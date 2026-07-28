'use client';

import { useMemo, useState } from 'react';
import {
  Wand2,
  Sparkles,
  RefreshCw,
  Check,
  X,
  Loader2,
  Brain,
  Image as ImageIcon,
  Trophy,
  AudioLines,
  Video,
  BookOpen,
  ListOrdered,
  Plus,
} from 'lucide-react';
import { useAdmin } from '../_lib/admin-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../_components/admin-page-header';
import { cn } from '@/lib/utils';
import type { PointValue, QuestionDifficulty } from '@/lib/types';
import {
  getDesigner,
  STYLE_LABELS,
  difficultyLabel,
  difficultyToPoints,
  type DesignerRequest,
  type GeneratedQuestion,
  type QuestionStyle,
} from './_lib';

const STYLE_ICONS: Record<QuestionStyle, typeof Brain> = {
  general: Brain,
  'guess-image': ImageIcon,
  'guess-player': Trophy,
  audio: AudioLines,
  video: Video,
  story: BookOpen,
  'order-events': ListOrdered,
};

const STYLES = Object.keys(STYLE_LABELS) as QuestionStyle[];
const DIFFICULTIES: { value: QuestionDifficulty; points: PointValue }[] = [
  { value: 'easy', points: 250 },
  { value: 'medium', points: 500 },
  { value: 'hard', points: 750 },
];

export default function DesignerPage() {
  const { data, ready, addQuestion } = useAdmin();
  const { toast } = useToast();
  const designer = useMemo(() => getDesigner(), []);

  const [categoryId, setCategoryId] = useState('');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [targetDifficulty, setTargetDifficulty] = useState<QuestionDifficulty>('medium');
  const [count, setCount] = useState(5);
  const [style, setStyle] = useState<QuestionStyle>('general');

  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canGenerate = ready && categoryId.trim() && topic.trim() && !generating;

  const buildRequest = (): DesignerRequest => ({
    categoryId,
    topic: topic.trim(),
    keywords: keywords.trim(),
    targetDifficulty,
    count,
    style,
  });

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const batch = await designer.generate(buildRequest());
      setQuestions(batch);
      toast({ title: 'تم التوليد', description: `توليد ${batch.length} سؤال` });
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر توليد الأسئلة', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const replaceOne = (tempId: string, next: GeneratedQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.tempId === tempId ? next : q)));
  };

  const handleRegenerate = async (q: GeneratedQuestion) => {
    setBusyId(q.tempId);
    try {
      const next = await designer.regenerate(q, buildRequest());
      replaceOne(q.tempId, next);
      toast({ title: 'إعادة توليد', description: 'تم توليد نسخة جديدة' });
    } finally {
      setBusyId(null);
    }
  };

  const handleImprove = async (q: GeneratedQuestion) => {
    setBusyId(q.tempId);
    try {
      const next = await designer.improve(q, buildRequest());
      replaceOne(q.tempId, next);
      toast({ title: 'تحسين', description: 'حُسّنت صياغة السؤال' });
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = (q: GeneratedQuestion) => {
    addQuestion({
      categoryId: q.categoryId,
      difficulty: q.difficulty,
      points: q.points,
      question: q.question,
      answer: q.answer,
    });
    setQuestions((prev) =>
      prev.map((x) => (x.tempId === q.tempId ? { ...x, status: 'accepted' } : x))
    );
    toast({ title: 'قُبل السؤال', description: 'أُضيف إلى بنك الأسئلة' });
  };

  const handleReject = (q: GeneratedQuestion) => {
    setQuestions((prev) =>
      prev.map((x) => (x.tempId === q.tempId ? { ...x, status: 'rejected' } : x))
    );
    toast({ title: 'رُفض السؤال' });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="مصمم الأسئلة الذكي"
        subtitle="ولّد أسئلة ذكية محلياً وأضفها إلى بنك الأسئلة"
      />

      <div className="flex flex-col gap-6">
        {/* Generation form */}
        <div className="rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="التصنيف">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">اختر تصنيفاً</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="الموضوع" hint="مثال: كرة القدم، أنمي ناروتو">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="اكتب الموضوع"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </Field>

            <Field label="كلمات مفتاحية (اختياري)" hint="افصل بفاصلة">
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="مثال: ميسي، كأس العالم"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </Field>

            <Field label="عدد الأسئلة">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="flex-1 accent-[hsl(var(--primary))]"
                />
                <span className="w-10 rounded-lg bg-primary/15 px-2 py-1 text-center text-sm font-black text-primary">
                  {count}
                </span>
              </div>
            </Field>
          </div>

          {/* Difficulty selector */}
          <div className="mt-5">
            <span className="mb-2 block text-sm font-bold text-foreground">
              الصعوبة المستهدفة
            </span>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setTargetDifficulty(d.value)}
                  className={cn(
                    'rounded-lg border-2 px-3 py-2 text-sm font-black transition-all',
                    targetDifficulty === d.value
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {d.points} · {difficultyLabel(d.value)}
                </button>
              ))}
            </div>
          </div>

          {/* Style selector */}
          <div className="mt-5">
            <span className="mb-2 block text-sm font-bold text-foreground">
              نمط الأسئلة
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {STYLES.map((s) => {
                const Icon = STYLE_ICONS[s];
                const active = style === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-bold transition-all',
                      active
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {STYLE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {generating ? 'جارٍ التوليد...' : 'توليد الأسئلة'}
            </button>
          </div>
        </div>

        {/* Results */}
        {questions.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-black text-foreground">
                الأسئلة المولّدة ({questions.length})
              </h2>
            </div>

            {questions.map((q) => (
              <QuestionCard
                key={q.tempId}
                question={q}
                busy={busyId === q.tempId}
                onRegenerate={() => handleRegenerate(q)}
                onImprove={() => handleImprove(q)}
                onAccept={() => handleAccept(q)}
                onReject={() => handleReject(q)}
              />
            ))}
          </div>
        )}

        {questions.length === 0 && !generating && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/40 bg-card/20 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg">
              <Plus className="h-8 w-8" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-black text-foreground">
                ابدأ بتوليد الأسئلة
              </span>
              <span className="text-sm text-muted-foreground">
                املأ النموذج واختر النمط والصعوبة ثم اضغط توليد
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function QuestionCard({
  question,
  busy,
  onRegenerate,
  onImprove,
  onAccept,
  onReject,
}: {
  question: GeneratedQuestion;
  busy: boolean;
  onRegenerate: () => void;
  onImprove: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const Icon = STYLE_ICONS[question.style];
  const accepted = question.status === 'accepted';
  const rejected = question.status === 'rejected';

  return (
    <div
      className={cn(
        'rounded-2xl border-2 p-5 backdrop-blur transition-all',
        accepted
          ? 'border-success/40 bg-success/5'
          : rejected
            ? 'border-destructive/30 bg-destructive/5 opacity-60'
            : 'border-border/50 bg-card/50 hover:border-primary/30'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-black text-primary">
              <Icon className="h-3.5 w-3.5" />
              {STYLE_LABELS[question.style]}
            </span>
            <span className="rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-black text-secondary">
              {question.points} نقطة · {difficultyLabel(question.difficulty)}
            </span>
            {accepted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-black text-success">
                <Check className="h-3.5 w-3.5" />
                مُقبول
              </span>
            )}
            {rejected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-black text-destructive">
                <X className="h-3.5 w-3.5" />
                مرفوض
              </span>
            )}
          </div>

          <p className="text-base font-bold text-foreground">{question.question}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">الإجابة: </span>
            {question.answer}
          </p>

          <div className="mt-1 rounded-lg border border-border/30 bg-background/40 p-3">
            <span className="mb-1 block text-xs font-black text-primary">
              لماذا هذه الصعوبة؟
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {question.reasoning}
            </p>
          </div>
        </div>

        {/* Actions */}
        {!accepted && !rejected && (
          <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
            <button
              onClick={onRegenerate}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs font-bold text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              إعادة
            </button>
            <button
              onClick={onImprove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/40 bg-secondary/5 px-3 py-2 text-xs font-bold text-secondary transition-all hover:bg-secondary/15 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              تحسين
            </button>
            <button
              onClick={onAccept}
              className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs font-bold text-success transition-all hover:bg-success/20"
            >
              <Check className="h-3.5 w-3.5" />
              قبول
            </button>
            <button
              onClick={onReject}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive transition-all hover:bg-destructive/15"
            >
              <X className="h-3.5 w-3.5" />
              رفض
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
