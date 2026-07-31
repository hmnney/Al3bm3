'use client';

import { useCallback, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
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
} from 'lucide-react';
import { useAdmin } from '../_lib/admin-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../_components/admin-page-header';
import { cn } from '@/lib/utils';
import type { AdminQuestion } from '../_lib/types';
import type { PointValue } from '@/lib/types';

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

interface PendingPoster {
  id: string;
  file: File;
  previewUrl: string;
  dataUri: string | null;
  converting: boolean;
  category: PosterCategory;
  answer: string;
  points: PointValue;
  status: 'pending' | 'imported' | 'skipped' | 'failed';
  error?: string;
  questionId?: string;
}

type Summary = { imported: number; skipped: number; failed: number } | null;

function genLocalId(): string {
  return `poster-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Read a File as a compressed data URI (max ~400px wide, JPEG quality 0.8). */
function fileToCompressedDataUri(file: File, maxDim = 400, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          reject(new Error('Failed to encode image'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function PostersPage() {
  const { data, addQuestion, updateQuestion, deleteQuestion, questionsFor } = useAdmin();
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

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) {
      toast({ title: 'No images found', description: 'Please select image files.', variant: 'destructive' });
      return;
    }

    const newPosters: PendingPoster[] = arr.map((file) => ({
      id: genLocalId(),
      file,
      previewUrl: URL.createObjectURL(file),
      dataUri: null,
      converting: false,
      category: 'movie-posters',
      answer: '',
      points: 250,
      status: 'pending',
    }));
    setPending((prev) => [...prev, ...newPosters]);
    setSummary(null);

    for (const p of newPosters) {
      setPending((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, converting: true } : x))
      );
      try {
        const dataUri = await fileToCompressedDataUri(p.file);
        setPending((prev) =>
          prev.map((x) =>
            x.id === p.id ? { ...x, dataUri, converting: false } : x
          )
        );
      } catch (e) {
        setPending((prev) =>
          prev.map((x) =>
            x.id === p.id
              ? { ...x, converting: false, status: 'failed', error: e instanceof Error ? e.message : 'Conversion failed' }
              : x
          )
        );
      }
    }
  }, [toast]);

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

  const updatePending = useCallback((id: string, patch: Partial<PendingPoster>) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const importOne = useCallback(
    (poster: PendingPoster): boolean => {
      if (!poster.dataUri) {
        updatePending(poster.id, { status: 'failed', error: 'Image not ready' });
        return false;
      }
      if (!poster.answer.trim()) {
        updatePending(poster.id, { status: 'skipped', error: 'No answer provided' });
        return false;
      }
      const meta = POSTER_CATEGORIES.find((c) => c.id === poster.category)!;
      try {
        const q = addQuestion({
          categoryId: poster.category,
          difficulty: poster.points === 250 ? 'easy' : poster.points === 500 ? 'medium' : 'hard',
          points: poster.points,
          question: meta.question,
          answer: poster.answer.trim(),
          image: poster.dataUri,
          video: undefined,
          audio: undefined,
        });
        updatePending(poster.id, { status: 'imported', questionId: q.id });
        return true;
      } catch (e) {
        updatePending(poster.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Unknown error',
        });
        return false;
      }
    },
    [addQuestion, updatePending]
  );

  const importAll = useCallback(async () => {
    const ready = pending.filter((p) => p.status === 'pending' && p.dataUri && !p.converting);
    const converting = pending.some((p) => p.converting);
    if (converting) {
      toast({ title: 'Still processing images', description: 'Wait a moment for images to finish converting.', variant: 'destructive' });
      return;
    }
    if (ready.length === 0) {
      toast({ title: 'Nothing to import', description: 'Add images and fill in the answer field.', variant: 'destructive' });
      return;
    }

    setImporting(true);
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const poster of ready) {
      const ok = importOne(poster);
      if (ok) imported++;
      else if (poster.status === 'skipped') skipped++;
      else failed++;
    }

    setSummary({ imported, skipped, failed });
    setImporting(false);
    toast({
      title: `Import complete`,
      description: `${imported} imported, ${skipped} skipped, ${failed} failed`,
    });
  }, [pending, importOne, toast]);

  const clearPending = useCallback(() => {
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
    setSummary(null);
  }, [pending]);

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

  const pendingCount = pending.filter((p) => p.status === 'pending').length;

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Poster Import"
        subtitle="ارفع بوستارات الأفلام والمسلسلات والأنمي والألعاب"
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
          Supports bulk upload of hundreds of posters (JPG, PNG, WebP)
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
              Pending ({pendingCount} ready)
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((poster) => (
              <PendingCard
                key={poster.id}
                poster={poster}
                onUpdate={updatePending}
                onRemove={removePending}
                onImport={importOne}
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

function PendingCard({
  poster,
  onUpdate,
  onRemove,
  onImport,
}: {
  poster: PendingPoster;
  onUpdate: (id: string, patch: Partial<PendingPoster>) => void;
  onRemove: (id: string) => void;
  onImport: (poster: PendingPoster) => boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border-2 bg-card/50 backdrop-blur transition-all',
        poster.status === 'imported'
          ? 'border-emerald-500/40'
          : poster.status === 'failed'
          ? 'border-destructive/40'
          : poster.status === 'skipped'
          ? 'border-amber-500/40'
          : 'border-border/50'
      )}
    >
      {/* Preview */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-background/60">
        {poster.converting ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster.previewUrl}
            alt={poster.file.name}
            className="h-full w-full object-cover"
          />
        )}
        {poster.status === 'imported' && (
          <div className="absolute right-2 top-2 rounded-full bg-emerald-500 p-1 shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        )}
        {poster.status === 'failed' && (
          <div className="absolute right-2 top-2 rounded-full bg-destructive p-1 shadow-lg">
            <X className="h-4 w-4 text-white" />
          </div>
        )}
        <button
          onClick={() => onRemove(poster.id)}
          className="absolute left-2 top-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur transition-all hover:bg-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-2 p-3">
        <p className="truncate text-xs text-muted-foreground" title={poster.file.name}>
          {poster.file.name}
        </p>

        {/* Category */}
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

        {/* Answer */}
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

        {/* Difficulty */}
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

        {poster.status === 'pending' && (
          <button
            onClick={() => onImport(poster)}
            disabled={poster.converting || !poster.dataUri || !poster.answer.trim()}
            className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-bold text-white shadow transition-all hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Import
          </button>
        )}
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
