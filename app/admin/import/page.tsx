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
  AlertTriangle,
  Loader2,
  Plus,
  FolderPlus,
  SkipForward,
  ArrowRightLeft,
  AlertCircle,
  Brain,
  Wand2,
  Image as ImageIcon,
  Video as VideoIcon,
  AudioLines,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '../_lib/admin-context';
import { AdminPageHeader } from '../_components/admin-page-header';
import { Stepper } from './_components/stepper';
import { UploadZone } from './_components/upload-zone';
import { SummaryStat } from './_components/summary-stat';
import {
  parseFile,
  mapRows,
  validateRows,
  runImport,
  formatReport,
  matchCategory,
  normalizeArabic,
  enrichRows,
} from './_lib/pipeline';
import type {
  ImportedRow,
  ValidatedRow,
  CategoryResolution,
  ImportProgress,
  ImportReport,
  RowStatus,
  MatchableCategory,
  RowEnrichment,
  RowOverride,
} from './_lib/pipeline';
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
  'تحليل الذكاء الاصطناعي',
  'معاينة وتحقق',
  'حل التصنيفات',
  'الاستيراد',
  'التقرير النهائي',
];

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function AdminImportPage() {
  const { data, addQuestion, addCategory, remoteSaveError, remoteSaveErrorMessage, retryRemoteSync } = useAdmin();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(0);
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [validated, setValidated] = useState<ValidatedRow[]>([]);
  const [enrichments, setEnrichments] = useState<RowEnrichment[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [overrides, setOverrides] = useState<Record<number, RowOverride>>({});
  const [resolutions, setResolutions] = useState<Record<string, CategoryResolution>>({});
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);

  const [retrying, setRetrying] = useState(false);

  const handleRetrySync = useCallback(async () => {
    setRetrying(true);
    try {
      const result = await retryRemoteSync();
      if (result.ok) {
        toast({ title: 'تمت المزامنة بنجاح', description: 'تم حفظ البيانات في السحابة' });
      } else {
        toast({
          title: 'فشلت المزامنة',
          description: result.error ?? 'خطأ غير معروف',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'فشلت المزامنة',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRetrying(false);
    }
  }, [retryRemoteSync, toast]);

  const existingCategories: MatchableCategory[] = useMemo(
    () => data.categories.map((c) => ({ id: c.id, name: c.name })),
    [data.categories]
  );

  const existingCategoryNames = useMemo(
    () => data.categories.map((c) => c.name),
    [data.categories]
  );

  // Build enrichment map for quick lookup.
  const enrichmentMap = useMemo(() => {
    const m = new Map<number, RowEnrichment>();
    enrichments.forEach((e) => m.set(e.rowIndex, e));
    return m;
  }, [enrichments]);

  // Unknown categories that need resolution.
  const unknownCategories = useMemo(() => {
    const set = new Set<string>();
    validated.forEach((v) => {
      const enrichment = enrichmentMap.get(v.row.rowIndex);
      const raw = (overrides[v.row.rowIndex]?.category ?? enrichment?.aiCategory ?? v.row.category).trim();
      if (!raw) return;
      const match = matchCategory(raw, existingCategories);
      if (!match.categoryId) set.add(raw);
    });
    return Array.from(set);
  }, [validated, existingCategories, enrichmentMap, overrides]);

  const matchedCategories = useMemo(() => {
    const map = new Map<string, string>();
    validated.forEach((v) => {
      const enrichment = enrichmentMap.get(v.row.rowIndex);
      const raw = (overrides[v.row.rowIndex]?.category ?? enrichment?.aiCategory ?? v.row.category).trim();
      if (!raw || map.has(raw)) return;
      const match = matchCategory(raw, existingCategories);
      if (match.categoryId) map.set(raw, match.categoryId);
    });
    return Array.from(map.entries()).map(([name, id]) => ({
      raw: name,
      categoryId: id,
      existing: data.categories.find((c) => c.id === id),
    }));
  }, [validated, existingCategories, data.categories, enrichmentMap, overrides]);

  // ---- Step transitions ----

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const sheet = await parseFile(file);
        const mapped = mapRows(sheet, 'questions');

        if (mapped.length === 0) {
          toast({ title: 'الملف فارغ', description: 'لم يتم العثور على أي صفوف بيانات في الملف' });
          return;
        }

        const validNames = new Set<string>();
        data.categories.forEach((c) => {
          validNames.add(c.id);
          validNames.add(c.name);
          validNames.add(normalizeArabic(c.name));
        });

        const v = validateRows(mapped, validNames);
        setRows(mapped);
        setValidated(v);
        setEnrichments([]);
        setOverrides({});
        setResolutions({});
        setProgress(null);
        setReport(null);

        // Check if any rows have empty categories → need AI enrichment.
        const needsAI = mapped.some((r) => !r.category.trim());
        if (needsAI) {
          setStep(1);
        } else {
          setStep(2);
        }
      } catch (e) {
        toast({
          title: 'تعذّر قراءة الملف',
          description: (e as Error).message || 'تأكد من أن الملف ملف Excel أو CSV صالح',
        });
      }
    },
    [toast, data.categories]
  );

  // ---- AI Enrichment ----
  const runEnrichment = useCallback(async () => {
    setEnriching(true);
    setEnrichProgress(0);
    try {
      const result = await enrichRows(rows, {
        existingCategoryNames,
        onProgress: (done, total) => setEnrichProgress(Math.round((done / total) * 100)),
      });
      setEnrichments(result);
      setStep(2);
      toast({
        title: 'اكتمل التحليل الذكي',
        description: `تم تحليل ${result.filter((r) => r.usedAI).length} سؤالاً بالذكاء الاصطناعي`,
      });
    } catch (e) {
      toast({
        title: 'تعذّر التحليل الذكي',
        description: (e as Error).message || 'استخدم المحرك المحلي كبديل',
      });
    } finally {
      setEnriching(false);
    }
  }, [rows, existingCategoryNames, toast]);

  const doImport = useCallback(async () => {
    console.log('[import] doImport START — rows:', validated.length, 'resolutions:', Object.keys(resolutions).length);
    setImporting(true);
    setStep(4);
    const importable = validated.filter((v) => v.status !== 'error');
    setProgress({
      imported: 0,
      remaining: importable.length,
      total: importable.length,
      pct: 0,
      estimatedSecondsLeft: 0,
    });

    let result: ImportReport | null = null;
    try {
      console.log('[import] before runImport — importable:', importable.length);
      result = await runImport(
        validated,
        resolutions,
        existingCategories,
        {
          createCategory: (name) => {
            const cat = addCategory({
              name,
              description: name,
              glyph: '🎯',
              gradient: 'from-indigo-500/80 to-blue-700/80',
            });
            return cat.id;
          },
          createQuestion: (q) => addQuestion(q),
          onProgress: (p) => setProgress(p),
        },
        enrichments,
        overrides
      );
      console.log('[import] after runImport — imported:', result.imported, 'skipped:', result.skipped);
    } catch (err) {
      console.error('[import] runImport THREW:', err);
      result = {
        imported: 0, skipped: importable.length, duplicates: 0, warnings: 0,
        errors: importable.length, failedRows: [], failedRowErrors: {},
        newCategories: 0, matchedCategories: 0,
        createdCategoryNames: [], matchedCategoryNames: [],
        importedImages: 0, importedVideos: 0, importedAudio: 0, skippedMedia: 0,
      };
    } finally {
      console.log('[import] finally — setting report + step 5');
      setReport(result ?? {
        imported: 0, skipped: importable.length, duplicates: 0, warnings: 0,
        errors: importable.length, failedRows: [], failedRowErrors: {},
        newCategories: 0, matchedCategories: 0,
        createdCategoryNames: [], matchedCategoryNames: [],
        importedImages: 0, importedVideos: 0, importedAudio: 0, skippedMedia: 0,
      });
      setImporting(false);
      setStep(5);
    }

    const finalReport = result ?? {
      imported: 0, skipped: 0, duplicates: 0, warnings: 0,
      errors: 0, failedRows: [], failedRowErrors: {},
      newCategories: 0, matchedCategories: 0,
      createdCategoryNames: [], matchedCategoryNames: [],
      importedImages: 0, importedVideos: 0, importedAudio: 0, skippedMedia: 0,
    } as ImportReport;
    toast({
      title: 'اكتمل الاستيراد',
      description: `أُُستورد ${finalReport.imported} سؤالاً، ${finalReport.matchedCategories} تصنيف مطابق، ${finalReport.newCategories} تصنيف جديد`,
    });
    console.log('[import] doImport END');
  }, [validated, resolutions, existingCategories, addQuestion, addCategory, toast, enrichments, overrides]);

  const goToResolution = useCallback(() => {
    if (unknownCategories.length > 0) {
      const seed: Record<string, CategoryResolution> = {};
      unknownCategories.forEach((name) => {
        seed[name] = { name, action: 'create' };
      });
      setResolutions(seed);
      setStep(3);
    } else {
      // No unknown categories — start import immediately.
      void doImport();
    }
  }, [unknownCategories, doImport]);

  const reset = useCallback(() => {
    setStep(0);
    setRows([]);
    setValidated([]);
    setEnrichments([]);
    setOverrides({});
    setResolutions({});
    setProgress(null);
    setReport(null);
  }, []);

  const counts = useMemo(() => {
    let ready = 0, warning = 0, error = 0;
    validated.forEach((v) => {
      if (v.status === 'ready') ready++;
      else if (v.status === 'warning') warning++;
      else error++;
    });
    return { ready, warning, error };
  }, [validated]);

  // Helper: get effective category for a row (for display).
  const getEffectiveCategory = (v: ValidatedRow) => {
    const enrichment = enrichmentMap.get(v.row.rowIndex);
    return (overrides[v.row.rowIndex]?.category ?? enrichment?.aiCategory ?? v.row.category).trim();
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="استيراد بنك الأسئلة"
        subtitle="ارفع ملف Excel أو CSV، يحلّله الذكاء الاصطناعي ويراجعه قبل الحفظ"
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
            <h2 className="text-xl font-black text-foreground sm:text-2xl">ابدأ برفع ملف الأسئلة</h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              يدعم ملفات Excel (.xlsx) و CSV. يتم اكتشاف الأعمدة تلقائياً (عربي أو إنجليزي) — ترتيب الأعمدة لا يهم. الصفوف ذات التصنيف الفارغ تُحلّل بالذكاء الاصطناعي.
            </p>
          </div>
          <UploadZone onFile={handleFile} />
          <div className="mt-6 rounded-xl border border-border/40 bg-background/40 p-4">
            <span className="mb-2 block text-xs font-bold text-muted-foreground">الأعمدة المدعومة (عربي / إنجليزي):</span>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['السؤال / Question', 'الإجابة / Answer', 'التصنيف / Category', 'الصعوبة / Difficulty', 'النقاط / Points', 'الصورة / Image', 'الفيديو / Video', 'الصوت / Audio'].map((h) => (
                <span key={h} className="rounded-md bg-primary/10 px-2 py-1 font-bold text-primary">{h}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- STEP 1: AI Enrichment ---- */}
      {step === 1 && (
        <div className="animate-fade-in flex flex-col items-center justify-center gap-8 rounded-2xl border-2 border-border/50 bg-card/40 p-16 text-center backdrop-blur">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-gradient text-white shadow-lg glow-primary">
              {enriching ? <Loader2 className="h-10 w-10 animate-spin" /> : <Brain className="h-10 w-10" />}
            </div>
            <div className="absolute inset-0 -z-10 animate-pulse-glow rounded-3xl bg-primary/30 blur-2xl" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              {enriching ? 'يجري تحليل الأسئلة بالذكاء الاصطناعي…' : 'تحليل الذكاء الاصطناعي'}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {enriching
                ? `يحدد التصنيف والصعوبة والنقاط للصفوف ذات التصنيف الفارغ — ${enrichProgress}%`
                : `${rows.filter((r) => !r.category.trim()).length} سؤال بحاجة إلى تحليل الذكاء الاصطناعي لتحديد التصنيف والصعوبة والنقاط.`}
            </p>
          </div>

          {enriching ? (
            <div className="w-full max-w-md">
              <div className="relative h-4 overflow-hidden rounded-full bg-muted/30">
                <div className="absolute inset-y-0 right-0 rounded-full bg-brand-gradient transition-all duration-300" style={{ width: `${enrichProgress}%` }}>
                  <div className="absolute inset-0 animate-pulse bg-white/20" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-5 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
              >
                <ArrowRight className="h-4 w-4" />
                تخطّي التحليل
              </button>
              <button
                type="button"
                onClick={runEnrichment}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Wand2 className="h-4 w-4" />
                بدء التحليل الذكي
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- STEP 2: Preview + Validation ---- */}
      {step === 2 && (
        <div className="animate-fade-in space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-border/50 bg-card/40 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black text-foreground">{rows.length.toLocaleString('ar-EG')} صف</span>
                <span className="text-xs text-muted-foreground">
                  <span className="text-success font-bold">{counts.ready} جاهز</span>
                  {' · '}
                  <span className="text-warning font-bold">{counts.warning} تحذير</span>
                  {' · '}
                  <span className="text-destructive font-bold">{counts.error} خطأ</span>
                  {enrichments.length > 0 && (
                    <>
                      {' · '}
                      <span className="text-primary font-bold">{enrichments.filter((e) => e.usedAI).length} تحليل ذكي</span>
                    </>
                  )}
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
                onClick={goToResolution}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check className="h-4 w-4" />
                متابعة
              </button>
            </div>
          </div>

          {/* Preview table with AI columns */}
          <div className="overflow-hidden rounded-2xl border-2 border-border/50 bg-card/40 backdrop-blur">
            <div className="max-h-[55vh] overflow-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">#</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">التصنيف الأصلي</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-primary">تصنيف الذكاء</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">التصنيف المطابق</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الصعوبة</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">النقاط</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الثقة %</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">السؤال</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الإجابة</TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase text-muted-foreground">الوسائط</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validated.map((v) => {
                    const enrichment = enrichmentMap.get(v.row.rowIndex);
                    const effectiveCategory = getEffectiveCategory(v);
                    const match = matchCategory(effectiveCategory, existingCategories);
                    const matchedName = match.categoryId
                      ? data.categories.find((c) => c.id === match.categoryId)?.name ?? '✅'
                      : match.ambiguous ? '⚠ متشابه' : '➕ جديد';
                    const aiCategory = enrichment?.aiCategory;
                    const aiDifficulty = overrides[v.row.rowIndex]?.difficulty ?? enrichment?.aiDifficulty;
                    const aiPoints = overrides[v.row.rowIndex]?.points ?? enrichment?.aiPoints;
                    const confidence = enrichment?.confidence;
                    return (
                      <TableRow
                        key={v.row.rowIndex}
                        className={cn(
                          'border-border/40 text-sm align-top',
                          v.status === 'error' && 'bg-destructive/[0.04]',
                          v.status === 'warning' && 'bg-warning/[0.04]'
                        )}
                      >
                        <TableCell className="text-xs font-bold tabular-nums text-muted-foreground">{v.row.rowIndex + 1}</TableCell>
                        <TableCell className="text-muted-foreground">{v.row.category || '—'}</TableCell>
                        <TableCell className="font-semibold text-primary">
                          {aiCategory && enrichment?.usedAI ? aiCategory : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {enrichment || v.row.category ? matchedName : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{aiDifficulty ?? (v.row.difficulty || '—')}</TableCell>
                        <TableCell className="text-muted-foreground">{aiPoints ?? (v.row.points || '—')}</TableCell>
                        <TableCell className="text-xs">
                          {confidence !== undefined && enrichment?.usedAI ? (
                            <span className={cn('font-bold', confidence >= 70 ? 'text-success' : confidence >= 50 ? 'text-warning' : 'text-destructive')}>
                              {confidence}%
                            </span>
                          ) : enrichment?.usedAI === false ? '—' : '—'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate font-semibold text-foreground">
                          {v.row.question || <span className="text-destructive">صف فارغ</span>}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {v.row.answer || <span className="text-warning">إجابة مفقودة</span>}
                        </TableCell>
                        <TableCell>
                          <MediaPreview image={v.row.image} video={v.row.video} audio={v.row.audio} />
                        </TableCell>
                        <TableCell><RowStatusBadge status={v.status} issues={v.issues} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ---- STEP 3: Category Resolution ---- */}
      {step === 3 && (
        <div className="animate-fade-in space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-border/50 bg-card/40 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <FolderPlus className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black text-foreground">مراجعة التصنيفات</span>
                <span className="text-xs text-muted-foreground">{matchedCategories.length} مطابق · {unknownCategories.length} جديد</span>
              </div>
            </div>
            <button
              type="button"
              onClick={doImport}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="h-4 w-4" />
              استيراد
            </button>
          </div>

          {matchedCategories.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-success">تصنيفات مطابقة لتصنيفات موجودة</h3>
              {matchedCategories.map((m) => (
                <div key={m.raw} className="flex items-center justify-between gap-3 rounded-xl border-2 border-success/30 bg-success/5 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm font-bold text-foreground">{m.raw}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">→ {m.existing?.name ?? m.categoryId}</span>
                </div>
              ))}
            </div>
          )}

          {unknownCategories.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-amber-500">تصنيفات جديدة (لا توجد تطابق) — يتطلب موافقة</h3>
              {unknownCategories.map((name) => {
                const match = matchCategory(name, existingCategories);
                const isAmbiguous = match.ambiguous;
                return (
                  <div key={name} className="flex flex-col gap-3 rounded-2xl border-2 border-border/50 bg-card/40 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-bold text-foreground">{name}</span>
                      {isAmbiguous && <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">أسماء متشابهة — اختر التصنيف</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isAmbiguous && (
                        <>
                          <ResolutionButton active={resolutions[name]?.action === 'create'} onClick={() => setResolutions((p) => ({ ...p, [name]: { name, action: 'create' } }))} icon={Plus} label="إنشاء جديد" tone="success" />
                          <ResolutionButton active={resolutions[name]?.action === 'skip'} onClick={() => setResolutions((p) => ({ ...p, [name]: { name, action: 'skip' } }))} icon={SkipForward} label="تخطّي" tone="neutral" />
                          <ResolutionButton active={resolutions[name]?.action === 'map'} onClick={() => setResolutions((p) => ({ ...p, [name]: { name, action: 'map', mapToCategoryId: data.categories[0]?.id ?? '' } }))} icon={ArrowRightLeft} label="ربط بتصنيف" tone="info" />
                        </>
                      )}
                      {(isAmbiguous || resolutions[name]?.action === 'map') && (
                        <Select value={resolutions[name]?.mapToCategoryId ?? ''} onValueChange={(val) => setResolutions((p) => ({ ...p, [name]: { name, action: 'map', mapToCategoryId: val } }))}>
                          <SelectTrigger className="h-9 w-48"><SelectValue placeholder="اختر تصنيف" /></SelectTrigger>
                          <SelectContent>
                            {data.categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {matchedCategories.length === 0 && unknownCategories.length === 0 && (
            <div className="rounded-xl border border-border/40 bg-card/30 p-6 text-center text-sm text-muted-foreground">لا توجد تصنيفات في الملف</div>
          )}
        </div>
      )}

      {/* ---- STEP 4: Importing (progress) ---- */}
      {step === 4 && (
        <div className="animate-fade-in flex flex-col items-center justify-center gap-8 rounded-2xl border-2 border-border/50 bg-card/40 p-16 text-center backdrop-blur">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-gradient text-white shadow-lg glow-primary">
              {importing ? <Loader2 className="h-10 w-10 animate-spin" /> : <CheckCircle2 className="h-10 w-10" />}
            </div>
            <div className="absolute inset-0 -z-10 animate-pulse-glow rounded-3xl bg-primary/30 blur-2xl" />
          </div>
          <h2 className="text-xl font-black text-foreground sm:text-2xl">{importing ? 'يجري الاستيراد…' : 'اكتمل الاستيراد'}</h2>
          {progress && (
            <div className="w-full max-w-md">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>{progress.imported.toLocaleString('ar-EG')} مستورد</span>
                <span>الاستيراد {progress.imported.toLocaleString('ar-EG')} / {progress.total.toLocaleString('ar-EG')}</span>
                <span>{progress.remaining.toLocaleString('ar-EG')} متبقّي</span>
              </div>
              <div className="relative h-4 overflow-hidden rounded-full bg-muted/30">
                <div className="absolute inset-y-0 right-0 rounded-full bg-brand-gradient transition-all duration-300" style={{ width: `${progress.pct}%` }}>
                  <div className="absolute inset-0 animate-pulse bg-white/20" />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress.pct)}%</span>
                {importing && progress.estimatedSecondsLeft > 0 && <span>الوقت المتبقي: ~{progress.estimatedSecondsLeft.toLocaleString('ar-EG')} ثانية</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- STEP 5: Final Report ---- */}
      {step === 5 && report && (
        <div className="animate-fade-in space-y-6">
          {remoteSaveError && (
            <div className="space-y-3 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-amber-600">
                    تم حفظ الأسئلة محلياً ولكن فشل المزامنة مع السحابة.
                  </span>
                  <span className="text-xs text-amber-700/80">
                    السبب: {remoteSaveErrorMessage ?? 'خطأ غير معروف'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    البيانات محفوظة على هذا الجهاز. يمكنك إعادة المحاولة بدون إعادة الاستيراد.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetrySync}
                disabled={retrying}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {retrying ? 'يجري المزامنة…' : 'إعادة المزامنة'}
              </button>
            </div>
          )}
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-success/30 bg-success/5 p-8 text-center backdrop-blur">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-foreground">اكتمل الاستيراد</h2>
            <p className="max-w-md text-sm text-muted-foreground">تم استيراد البيانات بنجاح إلى بنك الأسئلة</p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {formatReport(report).map((stat) => (
              <SummaryStat
                key={stat.label}
                label={stat.label}
                value={stat.value}
                icon={
                  stat.tone === 'success' ? CheckCircle2 :
                  stat.tone === 'error' ? XCircle :
                  stat.tone === 'warning' ? AlertTriangle :
                  stat.tone === 'info' ? FolderPlus :
                  Copy
                }
                gradient={
                  stat.tone === 'success' ? 'from-emerald-500 to-green-600' :
                  stat.tone === 'error' ? 'from-rose-500 to-pink-600' :
                  stat.tone === 'warning' ? 'from-amber-500 to-orange-600' :
                  stat.tone === 'info' ? 'from-blue-500 to-indigo-600' :
                  'from-slate-500 to-gray-600'
                }
              />
            ))}
          </div>

          {/* Failed rows breakdown */}
          {report.failedRows.length > 0 && (
            <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4">
              <h3 className="mb-3 text-sm font-black text-destructive">الصفوف الفاشلة ({report.failedRows.length})</h3>
              <div className="max-h-48 overflow-auto scrollbar-thin space-y-1.5">
                {report.failedRows.map((rn) => (
                  <div key={rn} className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs">
                    <span className="font-bold text-destructive">صف {rn}</span>
                    <span className="text-muted-foreground">{report.failedRowErrors[rn] ?? 'خطأ غير معروف'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {(report.createdCategoryNames.length > 0 || report.matchedCategoryNames.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {report.matchedCategoryNames.length > 0 && (
                <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-4">
                  <h3 className="mb-3 text-sm font-black text-success">التصنيفات المطابقة ({report.matchedCategoryNames.length})</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(report.matchedCategoryNames)).map((n) => (
                      <span key={n} className="rounded-md bg-success/15 px-2 py-1 text-xs font-bold text-success">{n}</span>
                    ))}
                  </div>
                </div>
              )}
              {report.createdCategoryNames.length > 0 && (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
                  <h3 className="mb-3 text-sm font-black text-primary">التصنيفات الجديدة ({report.createdCategoryNames.length})</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(report.createdCategoryNames)).map((n) => (
                      <span key={n} className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary">{n}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]">
              <Sparkles className="h-4 w-4" />
              استيراد ملف جديد
            </button>
            <Link href="/admin/questions" className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-6 py-2.5 text-sm font-bold text-muted-foreground backdrop-blur transition-all hover:border-primary/50 hover:text-foreground">
              <Database className="h-4 w-4" />
              عرض بنك الأسئلة
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function RowStatusBadge({ status, issues }: { status: RowStatus; issues: string[] }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
        <Check className="h-3 w-3" /> جاهز
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning" title={issues.join('، ')}>
        <AlertTriangle className="h-3 w-3" /> تحذير
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive" title={issues.join('، ')}>
      <XCircle className="h-3 w-3" /> خطأ
    </span>
  );
}

function ResolutionButton({ active, onClick, icon: Icon, label, tone }: {
  active: boolean;
  onClick: () => void;
  icon: typeof Plus;
  label: string;
  tone: 'success' | 'neutral' | 'info';
}) {
  const tones = {
    success: active ? 'border-success bg-success/15 text-success' : 'border-border/50 text-muted-foreground hover:border-success/40',
    neutral: active ? 'border-border bg-muted/30 text-foreground' : 'border-border/50 text-muted-foreground hover:border-border',
    info: active ? 'border-primary bg-primary/15 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/40',
  };
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition-all', tones[tone])}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function MediaPreview({ image, video, audio }: { image: string; video: string; audio: string }) {
  const hasAny = image.trim() || video.trim() || audio.trim();
  if (!hasAny) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      {image.trim() && (
        <img
          src={image.trim()}
          alt="preview"
          className="h-10 w-10 rounded-md border border-border/50 object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      {video.trim() && (
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/50 bg-primary/10 text-primary" title={video.trim()}>
          <VideoIcon className="h-4 w-4" />
        </span>
      )}
      {audio.trim() && (
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/50 bg-secondary/10 text-secondary" title={audio.trim()}>
          <AudioLines className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
