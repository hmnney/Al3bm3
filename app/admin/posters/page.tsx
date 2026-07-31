'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  ImagePlus,
  UploadCloud,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Tv,
  Sparkles,
  Gamepad2,
  Eye,
  ScanText,
} from 'lucide-react';
import { useAdmin } from '../_lib/admin-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../_components/admin-page-header';
import { cn } from '@/lib/utils';
import type { AdminQuestion } from '../_lib/types';
import type { PointValue } from '@/lib/types';
import {
  detectText,
  pickTitleRegions,
  applyRedactions,
  suggestAnswer,
  fileToDataUri,
  type RedactRect,
  type DetectedText,
} from '@/lib/poster-ocr';
import { uploadPosterImage, type UploadResult } from '@/lib/poster-storage';
import { RedactionEditor } from '@/components/game/redaction-editor';

type PosterCategory = 'movie-posters' | 'tv-posters' | 'anime-posters' | 'game-posters';

interface PosterCategoryMeta {
  id: PosterCategory;
  label: string;
  question: string;
  icon: React.ElementType;
  gradient: string;
}

const POSTER_CATEGORIES: PosterCategoryMeta[] = [
  { id: 'movie-posters', label: 'Movie Posters', question: 'What is the name of this movie?', icon: Clapperboard, gradient: 'from-rose-500 to-red-600' },
  { id: 'tv-posters', label: 'TV Posters', question: 'What is the name of this TV series?', icon: Tv, gradient: 'from-sky-500 to-blue-600' },
  { id: 'anime-posters', label: 'Anime Posters', question: 'What is the name of this anime?', icon: Sparkles, gradient: 'from-pink-500 to-fuchsia-600' },
  { id: 'game-posters', label: 'Game Posters', question: 'What is the name of this game?', icon: Gamepad2, gradient: 'from-violet-500 to-purple-600' },
];

const DIFFICULTY_POINTS: { points: PointValue; label: string }[] = [
  { points: 250, label: '250' },
  { points: 500, label: '500' },
  { points: 750, label: '750' },
];

type PosterStatus =
  | 'reading'
  | 'ocr-running'
  | 'ocr-done'
  | 'redacting'
  | 'ready'
  | 'imported'
  | 'skipped'
  | 'failed';

interface PendingPoster {
  id: string;
  file: File;
  originalDataUri: string;
  editedDataUri: string | null;
  rects: RedactRect[];
  autoRects: Set<number>;
  ocrWords: DetectedText[];
  ocrText: string;
  ocrError?: string;
  category: PosterCategory;
  answer: string;
  points: PointValue;
  status: PosterStatus;
  error?: string;
  questionId?: string;
  uploadMethod?: 'storage' | 'data-uri';
  /** When true, skip OCR + redaction and use the image as-is. */
  alreadyPrepared: boolean;
}

type Summary = { imported: number; skipped: number; failed: number } | null;

function genLocalId(): string {
  return `poster-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function PostersPage() {
  const { data, addQuestion, updateQuestion, deleteQuestion } = useAdmin();
  const { toast } = useToast();

  const [pending, setPending] = useState<PendingPoster[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<Summary>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [editCategory, setEditCategory] = useState<PosterCategory>('movie-posters');
  const [editPoints, setEditPoints] = useState<PointValue>(250);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const posterQuestions = useMemo(() => {
    const ids = new Set<string>(POSTER_CATEGORIES.map((c) => c.id));
    return data.questions.filter((q) => ids.has(q.categoryId));
  }, [data.questions]);

  const updatePending = useCallback((id: string, patch: Partial<PendingPoster>) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const processPoster = useCallback(
    async (poster: PendingPoster) => {
      // 1. Read file → data URI
      let dataUri: string;
      try {
        dataUri = await fileToDataUri(poster.file);
        updatePending(poster.id, { originalDataUri: dataUri });
      } catch (e) {
        updatePending(poster.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Failed to read file',
        });
        return;
      }

      // If the image is already prepared, skip OCR + redaction entirely
      if (poster.alreadyPrepared) {
        updatePending(poster.id, {
          editedDataUri: dataUri,
          status: 'ready',
          rects: [],
          autoRects: new Set<number>(),
          ocrWords: [],
          ocrText: '',
          ocrError: undefined,
        });
        return;
      }

      // 2. Run OCR
      updatePending(poster.id, { status: 'ocr-running' });
      let words: DetectedText[] = [];
      let fullText = '';
      let ocrError: string | undefined;
      try {
        const ocr = await detectText(dataUri);
        words = ocr.words;
        fullText = ocr.fullText;
      } catch (e) {
        ocrError = e instanceof Error ? e.message : 'OCR failed';
      }

      // 3. Auto-detect title regions
      const img = new Image();
      img.src = dataUri;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });

      let rects: RedactRect[] = [];
      let suggestedAnswer = '';
      if (words.length > 0) {
        rects = pickTitleRegions(words, img.naturalWidth, img.naturalHeight);
        suggestedAnswer = suggestAnswer(words, img.naturalWidth);
      }

      const autoIdx = new Set(rects.map((_, i) => i));

      updatePending(poster.id, {
        ocrWords: words,
        ocrText: fullText,
        ocrError,
        rects,
        autoRects: autoIdx,
        answer: suggestedAnswer,
        status: 'ocr-done',
      });

      // 4. Auto-redact immediately
      if (rects.length > 0) {
        try {
          const edited = await applyRedactions(dataUri, rects);
          updatePending(poster.id, { editedDataUri: edited, status: 'ready' });
        } catch (e) {
          updatePending(poster.id, {
            status: 'ready',
            error: 'Auto-redaction failed — draw rectangles manually.',
          });
        }
      } else {
        updatePending(poster.id, { status: 'ready' });
      }
    },
    [updatePending]
  );

  /** Toggle the "already prepared" flag and re-process the image accordingly. */
  const toggleAlreadyPrepared = useCallback(
    async (poster: PendingPoster, value: boolean) => {
      if (value) {
        // Skip OCR + redaction — use the original image as-is
        updatePending(poster.id, {
          alreadyPrepared: true,
          editedDataUri: poster.originalDataUri || null,
          rects: [],
          autoRects: new Set<number>(),
          ocrWords: [],
          ocrText: '',
          ocrError: undefined,
          error: undefined,
          status: poster.originalDataUri ? 'ready' : 'reading',
        });
      } else {
        // Re-enable OCR + redaction workflow
        updatePending(poster.id, {
          alreadyPrepared: false,
          status: 'reading',
          editedDataUri: null,
          rects: [],
          autoRects: new Set<number>(),
        });
        await processPoster({ ...poster, alreadyPrepared: false });
      }
    },
    [updatePending, processPoster]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (arr.length === 0) {
        toast({ title: 'No images found', description: 'Please select image files.', variant: 'destructive' });
        return;
      }

      const newPosters: PendingPoster[] = arr.map((file) => ({
        id: genLocalId(),
        file,
        originalDataUri: '',
        editedDataUri: null,
        rects: [],
        autoRects: new Set<number>(),
        ocrWords: [],
        ocrText: '',
        category: 'movie-posters',
        answer: '',
        points: 250,
        status: 'reading',
        alreadyPrepared: false,
      }));
      setPending((prev) => [...prev, ...newPosters]);
      setSummary(null);

      // Process sequentially so OCR workers don't thrash on bulk upload
      for (const poster of newPosters) {
        await processPoster(poster);
      }
    },
    [toast, processPoster]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const onFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void handleFiles(e.target.files);
      }
      e.target.value = '';
    },
    [handleFiles]
  );

  const reapplyRedactions = useCallback(
    async (poster: PendingPoster) => {
      if (poster.rects.length === 0) {
        updatePending(poster.id, { editedDataUri: poster.originalDataUri });
        return;
      }
      updatePending(poster.id, { status: 'redacting' });
      try {
        const edited = await applyRedactions(poster.originalDataUri, poster.rects);
        updatePending(poster.id, { editedDataUri: edited, status: 'ready' });
      } catch (e) {
        updatePending(poster.id, {
          status: 'ready',
          error: e instanceof Error ? e.message : 'Redaction failed',
        });
      }
    },
    [updatePending]
  );

  const importOne = useCallback(
    async (poster: PendingPoster): Promise<'imported' | 'skipped' | 'failed'> => {
      if (!poster.editedDataUri) {
        updatePending(poster.id, { status: 'failed', error: 'Edited image not ready' });
        return 'failed';
      }
      if (!poster.answer.trim()) {
        updatePending(poster.id, { status: 'skipped', error: 'No answer provided' });
        return 'skipped';
      }

      updatePending(poster.id, { status: 'redacting' });

      // Upload edited image to Storage (falls back to data URI)
      let upload: UploadResult;
      try {
        upload = await uploadPosterImage(poster.editedDataUri);
      } catch (e) {
        updatePending(poster.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Upload failed',
        });
        return 'failed';
      }

      const meta = POSTER_CATEGORIES.find((c) => c.id === poster.category)!;
      try {
        const q = addQuestion({
          categoryId: poster.category,
          difficulty: poster.points === 250 ? 'easy' : poster.points === 500 ? 'medium' : 'hard',
          points: poster.points,
          question: meta.question,
          answer: poster.answer.trim(),
          image: upload.url,
          video: undefined,
          audio: undefined,
        });
        updatePending(poster.id, {
          status: 'imported',
          questionId: q.id,
          uploadMethod: upload.method,
        });
        return 'imported';
      } catch (e) {
        updatePending(poster.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Save failed',
        });
        return 'failed';
      }
    },
    [addQuestion, updatePending]
  );

  const importAll = useCallback(async () => {
    const ready = pending.filter((p) => p.status === 'ready' && p.editedDataUri);
    if (ready.length === 0) {
      toast({ title: 'Nothing to import', description: 'Wait for OCR to finish and fill in answers.', variant: 'destructive' });
      return;
    }

    setImporting(true);
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const poster of ready) {
      if (!poster.answer.trim()) {
        updatePending(poster.id, { status: 'skipped', error: 'No answer provided' });
        skipped++;
        continue;
      }
      const result = await importOne(poster);
      if (result === 'imported') imported++;
      else if (result === 'skipped') skipped++;
      else failed++;
    }

    setSummary({ imported, skipped, failed });
    setImporting(false);
    toast({
      title: 'Import complete',
      description: `${imported} imported, ${skipped} skipped, ${failed} failed`,
    });
  }, [pending, importOne, updatePending, toast]);

  const clearPending = useCallback(() => {
    setPending([]);
    setSummary(null);
  }, []);

  const startEdit = useCallback((q: AdminQuestion) => {
    setEditingId(q.id);
    setEditAnswer(q.answer);
    setEditCategory(q.categoryId as PosterCategory);
    setEditPoints(q.points);
  }, []);

  const saveEdit = useCallback(
    (id: string) => {
      const meta = POSTER_CATEGORIES.find((c) => c.id === editCategory)!;
      updateQuestion(id, {
        answer: editAnswer.trim(),
        categoryId: editCategory,
        points: editPoints,
        difficulty: editPoints === 250 ? 'easy' : editPoints === 500 ? 'medium' : 'hard',
        question: meta.question,
      });
      setEditingId(null);
      toast({ title: 'Poster updated' });
    },
    [editAnswer, editCategory, editPoints, updateQuestion, toast]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteQuestion(id);
      toast({ title: 'Poster deleted' });
    },
    [deleteQuestion, toast]
  );

  const pendingCount = pending.filter((p) => p.status === 'ready').length;
  const processingCount = pending.filter(
    (p) => p.status === 'reading' || p.status === 'ocr-running' || p.status === 'redacting'
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Poster Import"
        subtitle="ارفع البوسترات — يخفي النظام العنوان تلقائيًا قبل الحفظ"
        actions={
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
          >
            <ImagePlus className="h-4 w-4" />
            Add Images
          </button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileSelect}
      />

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'mb-6 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border/50 bg-card/30 hover:border-primary/40 hover:bg-card/50'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className={cn('mb-3 h-10 w-10', dragging ? 'text-primary' : 'text-muted-foreground')} />
        <p className="text-base font-bold text-foreground">
          {dragging ? 'Drop images here' : 'Drag & drop images, or click to browse'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          OCR auto-detects the title and hides it before saving. Bulk upload supported.
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <SummaryCard label="Imported" value={summary.imported} icon={CheckCircle2} tone="success" />
          <SummaryCard label="Skipped" value={summary.skipped} icon={AlertCircle} tone="warning" />
          <SummaryCard label="Failed" value={summary.failed} icon={X} tone="error" />
        </div>
      )}

      {/* Pending posters */}
      {pending.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-foreground">
              Pending ({pendingCount} ready{processingCount > 0 ? `, ${processingCount} processing` : ''})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={clearPending}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-destructive/40 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
              <button
                onClick={importAll}
                disabled={importing || pendingCount === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Import All ({pendingCount})
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {pending.map((poster) => (
              <PendingCard
                key={poster.id}
                poster={poster}
                onUpdate={updatePending}
                onRemove={removePending}
                onReapply={reapplyRedactions}
                onImport={importOne}
                onTogglePrepared={toggleAlreadyPrepared}
              />
            ))}
          </div>
        </div>
      )}

      {/* Imported posters library */}
      <div>
        <h2 className="mb-4 text-lg font-black text-foreground">
          Imported Posters ({posterQuestions.length})
        </h2>
        {posterQuestions.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/50 bg-card/30 p-8 text-center">
            <ImagePlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No posters imported yet. Upload images above to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posterQuestions.map((q) => (
              <ImportedCard
                key={q.id}
                question={q}
                editing={editingId === q.id}
                editAnswer={editAnswer}
                editCategory={editCategory}
                editPoints={editPoints}
                onEditStart={startEdit}
                onEditCancel={() => setEditingId(null)}
                onEditSave={saveEdit}
                onDelete={handleDelete}
                onSetEditAnswer={setEditAnswer}
                onSetEditCategory={setEditCategory}
                onSetEditPoints={setEditPoints}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: 'success' | 'warning' | 'error';
}) {
  const colors = {
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    error: 'bg-destructive/15 text-destructive',
  };
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border-2 border-border/40 p-4', colors[tone])}>
      <Icon className="h-6 w-6 shrink-0" />
      <div className="flex flex-col">
        <span className="text-2xl font-black leading-none">{value}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<PosterStatus, string> = {
  reading: 'Reading image…',
  'ocr-running': 'Running OCR…',
  'ocr-done': 'OCR complete',
  redacting: 'Applying redactions…',
  ready: 'Ready to import',
  imported: 'Imported',
  skipped: 'Skipped',
  failed: 'Failed',
};

function PendingCard({
  poster,
  onUpdate,
  onRemove,
  onReapply,
  onImport,
  onTogglePrepared,
}: {
  poster: PendingPoster;
  onUpdate: (id: string, patch: Partial<PendingPoster>) => void;
  onRemove: (id: string) => void;
  onReapply: (poster: PendingPoster) => void;
  onImport: (poster: PendingPoster) => Promise<'imported' | 'skipped' | 'failed'>;
  onTogglePrepared: (poster: PendingPoster, value: boolean) => void;
}) {
  const isBusy =
    poster.status === 'reading' ||
    poster.status === 'ocr-running' ||
    poster.status === 'redacting';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-2 bg-card/50 backdrop-blur transition-all',
        poster.status === 'imported'
          ? 'border-emerald-500/40'
          : poster.status === 'failed'
          ? 'border-destructive/40'
          : poster.status === 'skipped'
          ? 'border-amber-500/40'
          : 'border-border/50'
      )}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between border-b border-border/40 bg-background/40 px-4 py-2">
        <div className="flex items-center gap-2">
          {isBusy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {poster.status === 'imported' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {poster.status === 'failed' && <X className="h-4 w-4 text-destructive" />}
          {poster.status === 'skipped' && <AlertCircle className="h-4 w-4 text-amber-500" />}
          <span className="text-xs font-bold text-foreground">{STATUS_LABELS[poster.status]}</span>
        </div>
        <button
          onClick={() => onRemove(poster.id)}
          className="rounded-full p-1 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        {/* Original + Redaction Editor OR raw preview when already prepared */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <ScanText className="h-3.5 w-3.5" />
            {poster.alreadyPrepared ? 'Original Image (no processing)' : 'Original + Redaction Editor'}
          </div>
          {poster.alreadyPrepared ? (
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-background/60">
              {poster.originalDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster.originalDataUri}
                  alt="Original poster"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          ) : poster.originalDataUri ? (
            <>
              <RedactionEditor
                imageSrc={poster.originalDataUri}
                rects={poster.rects}
                autoRects={poster.autoRects}
                onChange={(rects) => {
                  onUpdate(poster.id, { rects, autoRects: new Set() });
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Red rects = auto-detected by OCR. Click a rect to delete it. Drag to draw a new one.
              </p>
              <button
                onClick={() => onReapply(poster)}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/40 disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                Re-apply Redactions
              </button>
              {poster.ocrError && (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  OCR failed: {poster.ocrError}. Draw rectangles manually above.
                </p>
              )}
              {!poster.ocrError && poster.ocrText && (
                <p className="text-[11px] text-muted-foreground">
                  Detected text: &quot;{poster.ocrText.slice(0, 80)}{poster.ocrText.length > 80 ? '…' : ''}&quot;
                </p>
              )}
            </>
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center rounded-xl bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Edited preview + Form */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            Edited Preview (saved)
          </div>
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-background/60">
            {poster.editedDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster.editedDataUri}
                alt="Edited poster"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                {isBusy ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <p className="px-4 text-center text-xs text-muted-foreground">
                    No redactions applied yet. Draw rectangles on the left to hide the title.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Form */}
          <div className="flex flex-col gap-2">
            <p className="truncate text-xs text-muted-foreground" title={poster.file.name}>
              {poster.file.name}
            </p>

            {/* Image already prepared toggle */}
            <label
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all',
                poster.alreadyPrepared
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40',
                poster.status === 'imported' && 'opacity-60'
              )}
            >
              <input
                type="checkbox"
                checked={poster.alreadyPrepared}
                onChange={(e) => onTogglePrepared(poster, e.target.checked)}
                disabled={poster.status === 'imported' || isBusy}
                className="h-4 w-4 rounded border-border accent-emerald-500"
              />
              <span>Image already prepared</span>
              <span className="ml-auto text-[10px] font-normal opacity-70">
                {poster.alreadyPrepared ? 'Skips OCR & masking' : 'OCR & auto-mask on'}
              </span>
            </label>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Category
              </label>
              <select
                value={poster.category}
                onChange={(e) => onUpdate(poster.id, { category: e.target.value as PosterCategory })}
                disabled={poster.status === 'imported'}
                className="w-full rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                {POSTER_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Correct Answer
              </label>
              <input
                type="text"
                value={poster.answer}
                onChange={(e) => onUpdate(poster.id, { answer: e.target.value })}
                disabled={poster.status === 'imported'}
                placeholder="Enter the title…"
                className="w-full rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Difficulty
              </label>
              <div className="flex gap-1">
                {DIFFICULTY_POINTS.map((d) => (
                  <button
                    key={d.points}
                    onClick={() => onUpdate(poster.id, { points: d.points })}
                    disabled={poster.status === 'imported'}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-1 text-xs font-black transition-all disabled:opacity-60',
                      poster.points === d.points
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {poster.error && poster.status !== 'imported' && (
              <p className="text-[11px] font-semibold text-destructive">{poster.error}</p>
            )}

            {poster.status === 'ready' && (
              <button
                onClick={() => void onImport(poster)}
                disabled={!poster.editedDataUri || !poster.answer.trim()}
                className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-bold text-white shadow transition-all hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Import This Poster
              </button>
            )}
            {poster.uploadMethod && poster.status === 'imported' && (
              <p className="text-[11px] text-muted-foreground">
                Saved via {poster.uploadMethod === 'storage' ? 'Supabase Storage' : 'database (data URI)'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportedCard({
  question,
  editing,
  editAnswer,
  editCategory,
  editPoints,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDelete,
  onSetEditAnswer,
  onSetEditCategory,
  onSetEditPoints,
}: {
  question: AdminQuestion;
  editing: boolean;
  editAnswer: string;
  editCategory: PosterCategory;
  editPoints: PointValue;
  onEditStart: (q: AdminQuestion) => void;
  onEditCancel: () => void;
  onEditSave: (id: string) => void;
  onDelete: (id: string) => void;
  onSetEditAnswer: (v: string) => void;
  onSetEditCategory: (v: PosterCategory) => void;
  onSetEditPoints: (v: PointValue) => void;
}) {
  const meta = POSTER_CATEGORIES.find((c) => c.id === question.categoryId) ?? POSTER_CATEGORIES[0];

  if (!editing) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur transition-all hover:border-primary/40">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-background/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={question.image || ''}
            alt={question.answer}
            className="h-full w-full object-cover"
          />
          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur">
            {question.points}
          </div>
        </div>
        <div className="flex flex-col gap-1 p-3">
          <div className="flex items-center gap-1.5">
            <meta.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground">{meta.label}</span>
          </div>
          <p className="text-sm font-black text-foreground">{question.answer}</p>
          <p className="text-[11px] text-muted-foreground">{question.question}</p>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={() => onEditStart(question)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/40"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={() => onDelete(question.id)}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs font-semibold text-destructive transition-all hover:border-destructive/40 hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-primary/50 bg-card/50 backdrop-blur">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-background/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={question.image || ''} alt={editAnswer} className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <select
          value={editCategory}
          onChange={(e) => onSetEditCategory(e.target.value as PosterCategory)}
          className="w-full rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-xs font-semibold text-foreground"
        >
          {POSTER_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={editAnswer}
          onChange={(e) => onSetEditAnswer(e.target.value)}
          className="w-full rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-xs font-semibold text-foreground"
        />
        <div className="flex gap-1">
          {DIFFICULTY_POINTS.map((d) => (
            <button
              key={d.points}
              onClick={() => onSetEditPoints(d.points)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-1 text-xs font-black transition-all',
                editPoints === d.points
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border/60 bg-background/40 text-muted-foreground'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5">
          <button
            onClick={() => onEditSave(question.id)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-gradient px-2 py-1.5 text-xs font-bold text-white shadow"
          >
            <Check className="h-3 w-3" />
            Save
          </button>
          <button
            onClick={onEditCancel}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs font-semibold text-muted-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
