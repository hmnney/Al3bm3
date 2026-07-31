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
  Search,
  EyeOff,
  Film,
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
import {
  searchMovies,
  popularMovies,
  searchTv,
  tmdbPosterUrl,
  downloadPosterAsDataUri,
  TMDB_CONFIGURED,
  type TmdbMovie,
} from '@/lib/tmdb';

type PosterCategory = 'movie-posters' | 'tv-posters' | 'anime-posters' | 'game-posters';

interface PosterCategoryMeta {
  id: PosterCategory;
  label: string;
  question: string;
  icon: React.ElementType;
}

const POSTER_CATEGORIES: PosterCategoryMeta[] = [
  { id: 'movie-posters', label: 'Movie Posters', question: 'What is the name of this movie?', icon: Clapperboard },
  { id: 'tv-posters', label: 'TV Posters', question: 'What is the name of this TV series?', icon: Tv },
  { id: 'anime-posters', label: 'Anime Posters', question: 'What is the name of this anime?', icon: Sparkles },
  { id: 'game-posters', label: 'Game Posters', question: 'What is the name of this game?', icon: Gamepad2 },
];

const DIFFICULTY_POINTS: { points: PointValue; label: string }[] = [
  { points: 250, label: '250' },
  { points: 500, label: '500' },
  { points: 750, label: '750' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  alreadyPrepared: boolean;
}

type BlindStatus = 'idle' | 'processing' | 'imported' | 'failed';

interface BlindCard {
  id: string;
  /** The real TMDB movie — NEVER rendered to the user. */
  movie: TmdbMovie;
  label: string;
  status: BlindStatus;
  error?: string;
}

type Summary = { imported: number; skipped: number; failed: number } | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genLocalId(): string {
  return `poster-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PostersPage() {
  const { data, addQuestion, updateQuestion, deleteQuestion } = useAdmin();
  const { toast } = useToast();

  // Shared controls
  const [blindMode, setBlindMode] = useState(false);
  const [globalCategory, setGlobalCategory] = useState<PosterCategory>('movie-posters');
  const [globalPoints, setGlobalPoints] = useState<PointValue>(250);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Blind mode state
  const [blindCards, setBlindCards] = useState<BlindCard[]>([]);

  // Upload mode state
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

  // -------------------------------------------------------------------------
  // Blind mode: TMDB search + import
  // -------------------------------------------------------------------------

  const runSearch = useCallback(async () => {
    if (!TMDB_CONFIGURED) {
      toast({ title: 'تعذر الاتصال بـ TMDB', description: 'API key not configured.', variant: 'destructive' });
      return;
    }
    setSearching(true);
    setBlindCards([]);
    try {
      let results: TmdbMovie[];
      const isTv = globalCategory === 'tv-posters' || globalCategory === 'anime-posters';
      if (searchQuery.trim()) {
        const res = isTv
          ? await searchTv(searchQuery.trim())
          : await searchMovies(searchQuery.trim());
        results = res.results.filter((m) => m.poster_path);
      } else {
        const res = await popularMovies();
        results = res.results.filter((m) => m.poster_path);
      }
      const cards: BlindCard[] = results.slice(0, 20).map((movie, i) => ({
        id: genLocalId(),
        movie,
        label: `Movie #${pad3(i + 1)}`,
        status: 'idle',
      }));
      setBlindCards(cards);
      if (cards.length === 0) {
        toast({ title: 'No results', description: 'TMDB returned no movies with posters.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'تعذر الاتصال بـ TMDB', description: 'Search failed.', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  }, [globalCategory, searchQuery, toast]);

  const updateBlindCard = useCallback((id: string, patch: Partial<BlindCard>) => {
    setBlindCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  /**
   * Blind import: runs the entire pipeline internally without ever showing
   * the poster, title, or OCR output to the user.
   */
  const blindImport = useCallback(
    async (card: BlindCard) => {
      updateBlindCard(card.id, { status: 'processing' });
      const meta = POSTER_CATEGORIES.find((c) => c.id === globalCategory)!;

      try {
        // 1. Download poster from TMDB → data URI
        const posterDataUri = await downloadPosterAsDataUri(card.movie.poster_path!, 'w500');

        // 2. Run OCR
        let rects: RedactRect[] = [];
        try {
          const ocr = await detectText(posterDataUri);
          if (ocr.words.length > 0) {
            const img = new Image();
            img.src = posterDataUri;
            await new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            });
            rects = pickTitleRegions(ocr.words, img.naturalWidth, img.naturalHeight);
          }
        } catch {
          // OCR failure is non-fatal — we still save with whatever redactions we can
        }

        // 3. Apply redactions
        let editedDataUri = posterDataUri;
        if (rects.length > 0) {
          try {
            editedDataUri = await applyRedactions(posterDataUri, rects);
          } catch {
            // Use original if redaction fails
          }
        }

        // 4. Upload to Supabase Storage
        const upload = await uploadPosterImage(editedDataUri);

        // 5. Save question with TMDB title as answer
        addQuestion({
          categoryId: globalCategory,
          difficulty: globalPoints === 250 ? 'easy' : globalPoints === 500 ? 'medium' : 'hard',
          points: globalPoints,
          question: meta.question,
          answer: card.movie.title,
          image: upload.url,
          video: undefined,
          audio: undefined,
        });

        updateBlindCard(card.id, { status: 'imported' });
      } catch (e) {
        updateBlindCard(card.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Import failed',
        });
        toast({ title: 'Import failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
      }
    },
    [globalCategory, globalPoints, addQuestion, updateBlindCard, toast]
  );

  const blindImportAll = useCallback(async () => {
    const idle = blindCards.filter((c) => c.status === 'idle');
    if (idle.length === 0) return;
    for (const card of idle) {
      await blindImport(card);
    }
    toast({ title: 'Blind import complete' });
  }, [blindCards, blindImport, toast]);

  // -------------------------------------------------------------------------
  // Upload mode: existing drag & drop workflow
  // -------------------------------------------------------------------------

  const updatePending = useCallback((id: string, patch: Partial<PendingPoster>) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const processPoster = useCallback(
    async (poster: PendingPoster) => {
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

      if (rects.length > 0) {
        try {
          const edited = await applyRedactions(dataUri, rects);
          updatePending(poster.id, { editedDataUri: edited, status: 'ready' });
        } catch {
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

  const toggleAlreadyPrepared = useCallback(
    async (poster: PendingPoster, value: boolean) => {
      if (value) {
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
        category: globalCategory,
        answer: '',
        points: globalPoints,
        status: 'reading',
        alreadyPrepared: false,
      }));
      setPending((prev) => [...prev, ...newPosters]);
      setSummary(null);
      for (const poster of newPosters) {
        await processPoster(poster);
      }
    },
    [toast, processPoster, globalCategory, globalPoints]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files);
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
      let upload: UploadResult;
      try {
        upload = await uploadPosterImage(poster.editedDataUri);
      } catch (e) {
        updatePending(poster.id, { status: 'failed', error: e instanceof Error ? e.message : 'Upload failed' });
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
        updatePending(poster.id, { status: 'imported', questionId: q.id, uploadMethod: upload.method });
        return 'imported';
      } catch (e) {
        updatePending(poster.id, { status: 'failed', error: e instanceof Error ? e.message : 'Save failed' });
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
    let imported = 0, skipped = 0, failed = 0;
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
    toast({ title: 'Import complete', description: `${imported} imported, ${skipped} skipped, ${failed} failed` });
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

  const blindImportedCount = blindCards.filter((c) => c.status === 'imported').length;
  const blindProcessingCount = blindCards.filter((c) => c.status === 'processing').length;
  const blindIdleCount = blindCards.filter((c) => c.status === 'idle').length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Poster Import"
        subtitle="استيراد البوسترات — الوضع الأعمى يخفي كل شيء"
        actions={
          !blindMode ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
            >
              <ImagePlus className="h-4 w-4" />
              Add Images
            </button>
          ) : undefined
        }
      />

      {/* Shared controls */}
      <div className="mb-6 rounded-2xl border-2 border-border/40 bg-card/40 p-4 backdrop-blur">
        <div className="flex flex-col gap-4">
          {/* Top row: Blind Import switch */}
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={blindMode}
                onClick={() => {
                  setBlindMode(!blindMode);
                  setBlindCards([]);
                }}
                className={cn(
                  'relative h-7 w-12 rounded-full transition-colors',
                  blindMode ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    blindMode ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
              <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                {blindMode ? <EyeOff className="h-4 w-4 text-primary" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                Blind Import {blindMode ? 'ON' : 'OFF'}
              </span>
            </label>
            {blindMode && (
              <span className="text-xs font-semibold text-muted-foreground">
                {blindImportedCount} imported · {blindProcessingCount} processing · {blindIdleCount} ready
              </span>
            )}
          </div>

          {/* Bottom row: Search + Category + Difficulty */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Search */}
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch();
                  }}
                  placeholder={blindMode ? 'Search TMDB (results hidden)...' : 'Search TMDB...'}
                  className="w-full rounded-xl border border-border/60 bg-background/60 py-2 pl-10 pr-4 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
              </div>
              <button
                onClick={() => void runSearch()}
                disabled={searching || !TMDB_CONFIGURED}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Category
              </label>
              <select
                value={globalCategory}
                onChange={(e) => setGlobalCategory(e.target.value as PosterCategory)}
                className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm font-semibold text-foreground"
              >
                {POSTER_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
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
                    onClick={() => setGlobalPoints(d.points)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-black transition-all',
                      globalPoints === d.points
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!TMDB_CONFIGURED && blindMode && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          TMDB API key not configured. Add NEXT_PUBLIC_TMDB_API_KEY to .env
        </div>
      )}

      {/* Hidden file input for upload mode */}
      {!blindMode && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFileSelect}
        />
      )}

      {/* ============================================================= */}
      {/* BLIND MODE                                                    */}
      {/* ============================================================= */}
      {blindMode ? (
        <div>
          {/* Blind cards */}
          {blindCards.length > 0 && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-foreground">
                  Blind Results ({blindCards.length})
                </h2>
                <button
                  onClick={() => void blindImportAll()}
                  disabled={blindIdleCount === 0 || blindProcessingCount > 0}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Import All ({blindIdleCount})
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {blindCards.map((card) => (
                  <BlindCardItem
                    key={card.id}
                    card={card}
                    onImport={() => void blindImport(card)}
                  />
                ))}
              </div>
            </>
          )}

          {searching && blindCards.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold text-muted-foreground">Searching TMDB...</p>
            </div>
          )}

          {!searching && blindCards.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-border/50 bg-card/30 p-8 text-center">
              <Film className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Search TMDB above. Results appear as blind cards — you will never see posters or titles.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ============================================================= */
        /* UPLOAD MODE (existing workflow)                                */
        /* ============================================================= */
        <div>
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function BlindCardItem({
  card,
  onImport,
}: {
  card: BlindCard;
  onImport: () => void;
}) {
  return (
    <button
      onClick={onImport}
      disabled={card.status !== 'idle'}
      className={cn(
        'flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-center transition-all',
        card.status === 'idle' && 'cursor-pointer border-border/50 bg-card/40 hover:border-primary/40 hover:bg-card/60',
        card.status === 'processing' && 'border-primary/40 bg-primary/5',
        card.status === 'imported' && 'border-emerald-500/40 bg-emerald-500/10',
        card.status === 'failed' && 'border-destructive/40 bg-destructive/5'
      )}
    >
      {card.status === 'idle' && (
        <>
          <Film className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-black text-foreground">{card.label}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">Click to import</span>
        </>
      )}
      {card.status === 'processing' && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold text-primary">Processing...</span>
        </>
      )}
      {card.status === 'imported' && (
        <>
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{card.label}</span>
          <span className="text-[10px] font-semibold text-emerald-600/70 dark:text-emerald-400/70">Imported</span>
        </>
      )}
      {card.status === 'failed' && (
        <>
          <X className="h-8 w-8 text-destructive" />
          <span className="text-xs font-bold text-destructive">Failed</span>
        </>
      )}
    </button>
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <ScanText className="h-3.5 w-3.5" />
            {poster.alreadyPrepared ? 'Original Image (no processing)' : 'Original + Redaction Editor'}
          </div>
          {poster.alreadyPrepared ? (
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-background/60">
              {poster.originalDataUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster.originalDataUri} alt="Original poster" className="h-full w-full object-cover" />
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
                onChange={(rects) => onUpdate(poster.id, { rects, autoRects: new Set() })}
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            Edited Preview (saved)
          </div>
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-background/60">
            {poster.editedDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster.editedDataUri} alt="Edited poster" className="h-full w-full object-cover" />
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

          <div className="flex flex-col gap-2">
            <p className="truncate text-xs text-muted-foreground" title={poster.file.name}>
              {poster.file.name}
            </p>

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
                  <option key={c.id} value={c.id}>{c.label}</option>
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
          <img src={question.image || ''} alt={question.answer} className="h-full w-full object-cover" />
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
            <option key={c.id} value={c.id}>{c.label}</option>
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
