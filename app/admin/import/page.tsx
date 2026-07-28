'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  XCircle,
  Copy,
  HelpCircle,
  MinusCircle,
  AlertTriangle,
  Brain,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '../_lib/admin-context';
import { AdminPageHeader } from '../_components/admin-page-header';
import { Stepper } from './_components/stepper';
import { UploadZone } from './_components/upload-zone';
import { SummaryStat } from './_components/summary-stat';
import { AnalysisStatusBadge } from './_components/status-badge';
import { DifficultyBadge } from '../_components/badges';
import { parseFile } from './_lib/parse';
import { getAnalyzer } from './_lib/ai/analyzer';
import { buildSummary } from './_lib/ai/summary';
import type {
  ImportedRow,
  ReviewedRow,
  RowAnalysis,
} from './_lib/ai/types';
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
import { cn } from '@/lib/utils';

const STEPS = [
  'رفع الملف',
  'معاينة البيانات',
  'تحليل ذكي',
  'مراجعة وتعديل',
  'ملخص الاستيراد',
];

type Step = 0 | 1 | 2 | 3 | 4;

export default function AdminImportPage() {
  const { data, addQuestion } = useAdmin();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(0);
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [analyses, setAnalyses] = useState<RowAnalysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [imported, setImported] = useState(false);

  // Editable overrides the admin applies on the review screen, keyed by rowIndex.
  // Overrides carry the final accepted difficulty + an override of the status.
  const [overrides, setOverrides] = useState<
    Record<
      number,
      { difficulty: QuestionDifficulty; accepted: boolean }
    >
  >({});

  const validCategoryIds = useMemo(
    () => data.categories.map((c) => c.id),
    [data.categories]
  );

  const reviewed: ReviewedRow[] = useMemo(
    () => rows.map((row, i) => ({ row, analysis: analyses[i] })),
    [rows, analyses]
  );

  const summary = useMemo(
    () => buildSummary(analyses),
    [analyses]
  );

  // ---- Step transitions ----

  const handleFile = useCallback(async (file: File) => {
    try {
      const parsed = await parseFile(file);
      setRows(parsed);
      setAnalyses([]);
      setOverrides({});
      setImported(false);
      setStep(1);
    } catch {
      toast({
        title: 'تعذّر قراءة الملف',
        description: 'تأكد من أن الملف ملف Excel أو CSV صالح',
      });
    }
  }, [toast]);

  const runAnalysis = useCallback(async () => {
    setStep(2);
    setAnalyzing(true);
    try {
      const analyzer = getAnalyzer();
      const result = await analyzer.analyze(rows, validCategoryIds);
      setAnalyses(result);
      // Seed overrides from the analyzer's suggestions.
      const seed: Record<
        number,
        { difficulty: QuestionDifficulty; accepted: boolean }
      > = {};
      result.forEach((a) => {
        seed[a.rowIndex] = {
          difficulty: a.difficultySuggestion.difficulty,
          // Accept everything except rejected/empty rows by default.
          accepted: a.status !== 'rejected' && a.status !== 'duplicate',
        };
      });
      setOverrides(seed);
      setStep(3);
    } catch {
      toast({
        title: 'تعذّر التحليل',
        description: 'حدث خطأ أثناء تحليل الأسئلة',
      });
    } finally {
      setAnalyzing(false);
    }
  }, [rows, validCategoryIds, toast]);

  const doImport = useCallback(() => {
    let count = 0;
    rows.forEach((row, i) => {
      const analysis = analyses[i];
      const override = overrides[row.rowIndex];
      if (!analysis || !override || !override.accepted) return;
      const cat = row.category.trim();
      if (!validCategoryIds.includes(cat)) return;
      addQuestion({
        categoryId: cat,
        difficulty: override.difficulty,
        points: difficultyToPoints(override.difficulty),
        question: row.question.trim(),
        answer: row.answer.trim(),
        image: undefined,
        audio: undefined,
        video: undefined,
      });
      count++;
    });
    setImported(true);
    setStep(4);
    toast({
      title: 'تم الاستيراد',
      description: `أُضيف ${count.toLocaleString('ar-EG')} سؤالاً إلى بنك الأسئلة`,
    });
  }, [rows, analyses, overrides, validCategoryIds, addQuestion, toast]);

  const reset = useCallback(() => {
    setStep(0);
    setRows([]);
    setAnalyses([]);
    setOverrides({});
    setImported(false);
  }, []);

  // ---- Derived counts for review header ----
  const reviewCounts = useMemo(() => {
    let accepted = 0;
    let rejected = 0;
    rows.forEach((row) => {
      const ov = overrides[row.rowIndex];
      if (ov?.accepted) accepted++;
      else rejected++;
    });
    return { accepted, rejected };
  }, [rows, overrides]);

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="استيراد بنك الأسئلة"
        subtitle="ارفع ملف Excel أو CSV، يحلّله النظام الذكي ويراجعه قبل الحفظ"
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

      {/* Stepper */}
      <div className="mb-8 rounded-2xl border-2 border-border/50 bg-card/40 p-4 backdrop-blur sm:p-6">
        <Stepper steps={STEPS} current={step} />
      </div>

      {/* ---- STEP 0: Upload ---- */}
      {step === 0 && (
        <div className="animate-fade-in rounded-2xl border-2 border-border/50 bg-card/40 p-6 backdrop-blur sm:p-10">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg glow-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              ابدأ برفع ملف الأسئلة
            </h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              يجب أن يحتوي الملف على أعمدة: السؤال، الإجابة، التصنيف. وعمود
              الصعوبة اختياري.
            </p>
          </div>
          <UploadZone onFile={handleFile} />
        </div>
      )}

      {/* ---- STEP 1: Preview ---- */}
      {step === 1 && (
        <div className="animate-fade-in space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-border/50 bg-card/40 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black text-foreground">
                  {rows.length.toLocaleString('ar-EG')} صف
                </span>
                <span className="text-xs text-muted-foreground">
                  معاينة البيانات قبل التحليل
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-5 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
              >
                <ArrowRight className="h-4 w-4" />
                رجوع
              </button>
              <button
                type="button"
                onClick={runAnalysis}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" />
                تشغيل التحليل الذكي
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-border/50 bg-card/40 backdrop-blur">
            <div className="max-h-[55vh] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">#</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">السؤال</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الإجابة</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">التصنيف</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الصعوبة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.rowIndex} className="border-border/40 text-sm">
                      <TableCell className="text-xs font-bold tabular-nums text-muted-foreground">
                        {r.rowIndex + 1}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-semibold text-foreground">
                        {r.question || <span className="text-muted-foreground/60">—</span>}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {r.answer || <span className="text-muted-foreground/60">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.category || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.difficulty || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ---- STEP 2: Analyzing ---- */}
      {step === 2 && (
        <div className="animate-fade-in flex flex-col items-center justify-center gap-6 rounded-2xl border-2 border-border/50 bg-card/40 p-16 text-center backdrop-blur">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-gradient text-white shadow-lg glow-primary">
              <Brain className="h-10 w-10" />
            </div>
            <div className="absolute inset-0 -z-10 animate-pulse-glow rounded-3xl bg-primary/30 blur-2xl" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              يجري التحليل الذكي…
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              يحدد النظام صعوبة كل سؤال بناءً على المعرفة المطلوبة، ويكشف
              المكررات والصفوف الفارغة والتصنيفات غير الصحيحة.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            {getAnalyzer().name}
          </div>
        </div>
      )}

      {/* ---- STEP 3: Review ---- */}
      {step === 3 && (
        <div className="animate-fade-in space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-border/50 bg-card/40 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black text-foreground">
                  مراجعة وتعديل
                </span>
                <span className="text-xs text-muted-foreground">
                  {reviewCounts.accepted.toLocaleString('ar-EG')} مقبول ·{' '}
                  {reviewCounts.rejected.toLocaleString('ar-EG')} مرفوض
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-5 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
              >
                <ArrowRight className="h-4 w-4" />
                رجوع
              </button>
              <button
                type="button"
                onClick={doImport}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check className="h-4 w-4" />
                استيراد المقبول
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-border/50 bg-card/40 backdrop-blur">
            <div className="max-h-[60vh] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">السؤال</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الإجابة</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الصعوبة المقترحة</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الثقة</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الحالة</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">تكرار</TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase text-muted-foreground">قبول</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewed.map(({ row, analysis }) => {
                    if (!analysis) return null;
                    const ov = overrides[row.rowIndex];
                    const dup =
                      analysis.flags.includes('duplicate') ||
                      analysis.flags.includes('similar');
                    return (
                      <TableRow
                        key={row.rowIndex}
                        className={cn(
                          'border-border/40 text-sm align-top',
                          ov?.accepted
                            ? 'bg-success/[0.03]'
                            : 'bg-destructive/[0.03]'
                        )}
                      >
                        <TableCell className="max-w-xs font-semibold text-foreground">
                          {row.question || (
                            <span className="text-destructive">صف فارغ</span>
                          )}
                          {analysis.difficultySuggestion.reason && (
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              {analysis.difficultySuggestion.reason}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs text-muted-foreground">
                          {row.answer || (
                            <span className="text-warning">إجابة مفقودة</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ov?.difficulty ?? 'medium'}
                            onValueChange={(v) =>
                              setOverrides((prev) => ({
                                ...prev,
                                [row.rowIndex]: {
                                  difficulty: v as QuestionDifficulty,
                                  accepted: prev[row.rowIndex]?.accepted ?? true,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="h-9 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">سهل</SelectItem>
                              <SelectItem value="medium">متوسط</SelectItem>
                              <SelectItem value="hard">صعب</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-brand-gradient"
                                style={{
                                  width: `${analysis.difficultySuggestion.confidence}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-bold tabular-nums text-muted-foreground">
                              {analysis.difficultySuggestion.confidence}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <AnalysisStatusBadge status={analysis.status} />
                        </TableCell>
                        <TableCell>
                          {dup ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning">
                              <Copy className="h-3 w-3" />
                              {analysis.similarity
                                ? `${analysis.similarity}%`
                                : 'مكرر'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <label className="flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={ov?.accepted ?? false}
                              onChange={(e) =>
                                setOverrides((prev) => ({
                                  ...prev,
                                  [row.rowIndex]: {
                                    difficulty:
                                      ov?.difficulty ??
                                      analysis.difficultySuggestion.difficulty,
                                    accepted: e.target.checked,
                                  },
                                }))
                              }
                              className="h-5 w-5 cursor-pointer rounded border-border accent-primary"
                            />
                          </label>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ---- STEP 4: Summary ---- */}
      {step === 4 && (
        <div className="animate-fade-in space-y-6">
          {/* Success banner */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-success/30 bg-success/5 p-8 text-center backdrop-blur">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-foreground">
              {imported ? 'اكتمل الاستيراد' : 'ملخص الاستيراد'}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {imported
                ? 'أُضيفت الأسئلة المقبولة إلى بنك الأسئلة'
                : 'هذه نتيجة التحليل قبل الحفظ'}
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <SummaryStat
              label="إجمالي الأسئلة"
              value={summary.total}
              icon={Database}
              gradient="from-blue-500 to-indigo-600"
            />
            <SummaryStat
              label="مقبول"
              value={summary.accepted}
              icon={CheckCircle2}
              gradient="from-emerald-500 to-green-600"
            />
            <SummaryStat
              label="مرفوض"
              value={summary.rejected}
              icon={XCircle}
              gradient="from-rose-500 to-pink-600"
            />
            <SummaryStat
              label="مكررات"
              value={summary.duplicates}
              icon={Copy}
              gradient="from-amber-500 to-orange-600"
            />
            <SummaryStat
              label="إجابات مفقودة"
              value={summary.missingAnswers}
              icon={HelpCircle}
              gradient="from-purple-500 to-violet-600"
            />
            <SummaryStat
              label="صفوف فارغة"
              value={summary.emptyRows}
              icon={MinusCircle}
              gradient="from-slate-500 to-gray-600"
            />
            <SummaryStat
              label="تصنيفات غير صحيحة"
              value={summary.invalidCategories}
              icon={AlertTriangle}
              gradient="from-red-500 to-rose-600"
            />
            <SummaryStat
              label="مراجعة يدوية"
              value={reviewCounts.accepted}
              icon={Sparkles}
              gradient="from-cyan-500 to-sky-600"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              استيراد ملف جديد
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

/** Map a difficulty to the board's point value (easy=250, medium=500, hard=750). */
function difficultyToPoints(d: QuestionDifficulty): 250 | 500 | 750 {
  return d === 'easy' ? 250 : d === 'medium' ? 500 : 750;
}
