'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Wand2,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Check,
  X,
  Database,
  ChevronLeft,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '../_lib/admin-context';
import { AdminPageHeader } from '../_components/admin-page-header';
import {
  generateQuestions,
  regenerateQuestion,
  COUNT_OPTIONS,
  MODE_LABELS,
  DIFFICULTY_LABELS,
  POINTS_FOR_DIFFICULTY,
} from './_lib';
import type {
  GenerationMode,
  QuestionCount,
  BuilderQuestion,
  GenerationProgress,
} from './_lib';
import type { QuestionDifficulty } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Phase = 'config' | 'generating' | 'review' | 'saving' | 'done';

export default function BuilderPage() {
  const { data, addQuestion } = useAdmin();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('config');
  const [categoryId, setCategoryId] = useState('');
  const [count, setCount] = useState<QuestionCount>(25);
  const [mode, setMode] = useState<GenerationMode>('mixed');
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [questions, setQuestions] = useState<BuilderQuestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<BuilderQuestion | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const selectedCategory = useMemo(
    () => data.categories.find((c) => c.id === categoryId),
    [data.categories, categoryId]
  );

  const canGenerate = !!categoryId && phase === 'config';

  // ---- Generation ----
  const handleGenerate = useCallback(async () => {
    if (!selectedCategory) return;
    setPhase('generating');
    setProgress({
      done: 0,
      total: count,
      pct: 0,
      phase: 'preparing',
      message: 'يُجهّز المحرك…',
    });
    setQuestions([]);
    try {
      const result = await generateQuestions(
        {
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          count,
          mode,
        },
        { onProgress: (p) => setProgress(p) }
      );
      setQuestions(result);
      setPhase('review');
      toast({
        title: 'اكتمل التوليد',
        description: `تم توليد ${result.length} سؤالاً عن "${selectedCategory.name}"`,
      });
    } catch (err) {
      setPhase('config');
      toast({
        title: 'تعذّر التوليد',
        description:
          (err as Error).message ||
          'تعذّر توليد الأسئلة. تأكد من إعدادات الذكاء الاصطناعي.',
        variant: 'destructive',
      });
    }
  }, [selectedCategory, count, mode, toast]);

  // ---- Regenerate single ----
  const handleRegenerate = useCallback(
    async (q: BuilderQuestion) => {
      if (!selectedCategory) return;
      setRegeneratingId(q.tempId);
      try {
        const replacement = await regenerateQuestion(
          {
            categoryId: selectedCategory.id,
            categoryName: selectedCategory.name,
            count,
            mode,
          },
          q.difficulty
        );
        setQuestions((prev) =>
          prev.map((item) => (item.tempId === q.tempId ? replacement : item))
        );
        toast({ title: 'تم توليد سؤال بديل' });
      } catch (err) {
        toast({
          title: 'تعذّر توليد بديل',
          description: (err as Error).message,
          variant: 'destructive',
        });
      } finally {
        setRegeneratingId(null);
      }
    },
    [selectedCategory, count, mode, toast]
  );

  // ---- Edit ----
  const startEdit = useCallback((q: BuilderQuestion) => {
    setEditingId(q.tempId);
    setEditDraft({ ...q });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editDraft) return;
    setQuestions((prev) =>
      prev.map((q) =>
        q.tempId === editDraft.tempId
          ? {
              ...editDraft,
              points: POINTS_FOR_DIFFICULTY[editDraft.difficulty],
            }
          : q
      )
    );
    setEditingId(null);
    setEditDraft(null);
  }, [editDraft]);

  // ---- Delete ----
  const handleDelete = useCallback((tempId: string) => {
    setQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
  }, []);

  // ---- Save to Question Bank ----
  const handleSave = useCallback(() => {
    if (questions.length === 0) return;
    setPhase('saving');
    try {
      for (const q of questions) {
        addQuestion({
          categoryId: q.categoryId,
          difficulty: q.difficulty,
          points: q.points,
          question: q.question,
          answer: q.answer,
        });
      }
      setSavedCount(questions.length);
      setPhase('done');
      toast({
        title: 'تم الحفظ في بنك الأسئلة',
        description: `أُضيف ${questions.length} سؤالاً إلى تصنيف "${selectedCategory?.name}"`,
      });
    } catch (err) {
      setPhase('review');
      toast({
        title: 'تعذّر الحفظ',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  }, [questions, addQuestion, toast, selectedCategory]);

  // ---- Reset ----
  const reset = useCallback(() => {
    setPhase('config');
    setQuestions([]);
    setProgress(null);
    setEditingId(null);
    setEditDraft(null);
    setSavedCount(0);
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="بناء بنك الأسئلة"
        subtitle="ولّد أسئلة بالذكاء الاصطناعي، راجعها، ثم احفظها في بنك الأسئلة"
        actions={
          <Link
            href="/admin/questions"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur transition-all hover:border-primary/50 hover:bg-card/70 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            بنك الأسئلة
          </Link>
        }
      />

      {/* ---- CONFIG PHASE ---- */}
      {phase === 'config' && (
        <div className="animate-fade-in mx-auto max-w-3xl space-y-6">
          {/* Category */}
          <ConfigCard
            step={1}
            title="اختر التصنيف"
            icon={Database}
            description="ستُضاف الأسئلة المولّدة إلى هذا التصنيف في بنك الأسئلة"
          >
            {data.categories.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>لا توجد تصنيفات. أنشئ تصنيفاً أولاً من صفحة التصنيفات.</span>
              </div>
            ) : (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-12 w-full text-base">
                  <SelectValue placeholder="اختر تصنيفاً…" />
                </SelectTrigger>
                <SelectContent>
                  {data.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="text-base">{c.glyph} {c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </ConfigCard>

          {/* Count */}
          <ConfigCard
            step={2}
            title="عدد الأسئلة"
            icon={Sparkles}
            description="كم سؤالاً تريد توليده؟"
          >
            <div className="flex flex-wrap gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={cn(
                    'flex h-14 min-w-[4rem] items-center justify-center rounded-2xl border-2 px-4 text-lg font-black transition-all',
                    count === n
                      ? 'border-primary bg-primary/15 text-primary shadow-lg'
                      : 'border-border/50 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {n.toLocaleString('ar-EG')}
                </button>
              ))}
            </div>
          </ConfigCard>

          {/* Mode */}
          <ConfigCard
            step={3}
            title="نمط التوليد"
            icon={Wand2}
            description="حدد مستوى صعوبة الأسئلة"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['mixed', 'easy', 'medium', 'hard'] as GenerationMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-4 transition-all',
                    mode === m
                      ? 'border-primary bg-primary/15 text-primary shadow-lg'
                      : 'border-border/50 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  <span className="text-base font-black">{MODE_LABELS[m]}</span>
                  {m === 'mixed' && (
                    <span className="text-[11px] font-semibold opacity-70">سهل + متوسط + صعب</span>
                  )}
                </button>
              ))}
            </div>
          </ConfigCard>

          {/* Generate button */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={cn(
                'inline-flex items-center gap-3 rounded-full px-8 py-4 text-base font-black shadow-lg transition-all',
                canGenerate
                  ? 'bg-brand-gradient text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]'
                  : 'cursor-not-allowed bg-muted/30 text-muted-foreground'
              )}
            >
              <Wand2 className="h-5 w-5" />
              توليد الأسئلة
            </button>
          </div>
        </div>
      )}

      {/* ---- GENERATING PHASE ---- */}
      {phase === 'generating' && (
        <div className="animate-fade-in flex flex-col items-center justify-center gap-8 rounded-2xl border-2 border-border/50 bg-card/40 p-16 text-center backdrop-blur">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-gradient text-white shadow-lg glow-primary">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <div className="absolute inset-0 -z-10 animate-pulse-glow rounded-3xl bg-primary/30 blur-2xl" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              يجري توليد الأسئلة بالذكاء الاصطناعي…
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {progress?.message ?? 'يُجهّز المحرك…'}
            </p>
          </div>
          {progress && (
            <div className="w-full max-w-md">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>{progress.done.toLocaleString('ar-EG')} مولّد</span>
                <span>{progress.total.toLocaleString('ar-EG')} المجموع</span>
              </div>
              <div className="relative h-4 overflow-hidden rounded-full bg-muted/30">
                <div
                  className={cn(
                    'absolute inset-y-0 right-0 rounded-full transition-all duration-300',
                    progress.phase === 'retrying'
                      ? 'bg-warning'
                      : progress.phase === 'error'
                        ? 'bg-destructive'
                        : 'bg-brand-gradient'
                  )}
                  style={{ width: `${progress.pct}%` }}
                >
                  <div className="absolute inset-0 animate-pulse bg-white/20" />
                </div>
              </div>
              <div className="mt-2 text-center text-xs font-bold text-muted-foreground">
                {Math.round(progress.pct)}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- REVIEW PHASE ---- */}
      {phase === 'review' && (
        <div className="animate-fade-in space-y-5">
          {/* Header bar */}
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-border/50 bg-card/40 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black text-foreground">
                  {questions.length.toLocaleString('ar-EG')} سؤال جاه للمراجعة
                </span>
                <span className="text-xs text-muted-foreground">
                  التصنيف: {selectedCategory?.name} · النمط: {MODE_LABELS[mode]}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-5 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
              >
                <X className="h-4 w-4" />
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={questions.length === 0}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold shadow-lg transition-all',
                  questions.length > 0
                    ? 'bg-brand-gradient text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]'
                    : 'cursor-not-allowed bg-muted/30 text-muted-foreground'
                )}
              >
                <Save className="h-4 w-4" />
                حفظ في بنك الأسئلة
              </button>
            </div>
          </div>

          {/* Review table */}
          <div className="overflow-hidden rounded-2xl border-2 border-border/50 bg-card/40 backdrop-blur">
            <div className="max-h-[60vh] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-12 text-right text-xs font-bold uppercase text-muted-foreground">#</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">السؤال</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الإجابة</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الصعوبة</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">النقاط</TableHead>
                    <TableHead className="w-32 text-center text-xs font-bold uppercase text-muted-foreground">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q, idx) => {
                    const isEditing = editingId === q.tempId;
                    const isRegenerating = regeneratingId === q.tempId;
                    if (isEditing && editDraft) {
                      return (
                        <TableRow key={q.tempId} className="border-border/40 bg-primary/[0.04]">
                          <TableCell className="text-xs font-bold tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <Input
                              value={editDraft.question}
                              onChange={(e) => setEditDraft({ ...editDraft, question: e.target.value })}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editDraft.answer}
                              onChange={(e) => setEditDraft({ ...editDraft, answer: e.target.value })}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={editDraft.difficulty}
                              onValueChange={(val) =>
                                setEditDraft({ ...editDraft, difficulty: val as QuestionDifficulty })
                              }
                            >
                              <SelectTrigger className="h-9 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="easy">سهل</SelectItem>
                                <SelectItem value="medium">متوسط</SelectItem>
                                <SelectItem value="hard">صعب</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm font-bold text-muted-foreground">
                            {POINTS_FOR_DIFFICULTY[editDraft.difficulty]}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={saveEdit}
                                className="rounded-lg bg-success/15 p-1.5 text-success transition-colors hover:bg-success/25"
                                title="حفظ"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-lg bg-destructive/15 p-1.5 text-destructive transition-colors hover:bg-destructive/25"
                                title="إلغاء"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={q.tempId} className="border-border/40 text-sm align-top hover:bg-card/30">
                        <TableCell className="text-xs font-bold tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="max-w-md font-semibold text-foreground">{q.question}</TableCell>
                        <TableCell className="max-w-xs text-muted-foreground">{q.answer}</TableCell>
                        <TableCell>
                          <DifficultyBadge difficulty={q.difficulty} />
                        </TableCell>
                        <TableCell className="font-bold tabular-nums text-muted-foreground">{q.points}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(q)}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
                              title="تعديل"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegenerate(q)}
                              disabled={isRegenerating}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/15 hover:text-secondary disabled:opacity-50"
                              title="توليد بديل"
                            >
                              {isRegenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(q.tempId)}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {questions.length === 0 && (
            <div className="rounded-xl border border-border/40 bg-card/30 p-8 text-center text-sm text-muted-foreground">
              لا توجد أسئلة للمراجعة. أعد التوليد.
            </div>
          )}
        </div>
      )}

      {/* ---- SAVING PHASE ---- */}
      {phase === 'saving' && (
        <div className="animate-fade-in flex flex-col items-center justify-center gap-6 rounded-2xl border-2 border-border/50 bg-card/40 p-16 text-center backdrop-blur">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg glow-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <h2 className="text-xl font-black text-foreground">يجري الحفظ في بنك الأسئلة…</h2>
        </div>
      )}

      {/* ---- DONE PHASE ---- */}
      {phase === 'done' && (
        <div className="animate-fade-in space-y-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-success/30 bg-success/5 p-8 text-center backdrop-blur">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-foreground">تم الحفظ بنجاح</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              أُضيف {savedCount.toLocaleString('ar-EG')} سؤالاً إلى تصنيف "{selectedCategory?.name}" في بنك الأسئلة
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              توليد دفعة جديدة
            </button>
            <Link
              href="/admin/questions"
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-bold text-muted-foreground backdrop-blur transition-all hover:border-primary/50 hover:text-foreground"
            >
              <Database className="h-4 w-4" />
              عرض بنك الأسئلة
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function ConfigCard({
  step,
  title,
  description,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-border/50 bg-card/40 p-5 backdrop-blur sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[11px] font-black text-primary">
              {step}
            </span>
            <h3 className="text-base font-black text-foreground">{title}</h3>
          </div>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: QuestionDifficulty }) {
  const config = {
    easy: { label: 'سهل', className: 'bg-emerald-500/15 text-emerald-600' },
    medium: { label: 'متوسط', className: 'bg-amber-500/15 text-amber-600' },
    hard: { label: 'صعب', className: 'bg-rose-500/15 text-rose-600' },
  }[difficulty];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold', config.className)}>
      {config.label}
    </span>
  );
}
