import type { QuestionDifficulty } from '@/lib/types';

/**
 * Smart Import pipeline — shared types.
 *
 * The pipeline is modular: Reader → Parser → Mapper → Validator → Importer → Reporter.
 * Each module is isolated and communicates only through these types. Future import
 * kinds (words, images, videos, audio, posters, celebrations) reuse the same
 * pipeline by providing a different `ImportKind` and column mapping.
 */

/** What kind of dataset is being imported. */
export type ImportKind = 'questions' | 'words' | 'images' | 'videos' | 'audio' | 'posters' | 'celebrations';

/** A single raw row extracted from the uploaded file, before validation. */
export interface ImportedRow {
  rowIndex: number;
  question: string;
  answer: string;
  category: string;
  difficulty: string;
  points: string;
  image: string;
  video: string;
  audio: string;
}

/** Raw cell matrix from the parser — rows of strings with a separate header row. */
export interface RawSheet {
  headers: string[];
  rows: string[][];
}

/** Per-row validation status. */
export type RowStatus = 'ready' | 'warning' | 'error';

/** A row with its validation result. */
export interface ValidatedRow {
  row: ImportedRow;
  status: RowStatus;
  issues: string[];
}

/** How to handle a category that doesn't exist yet. */
export type CategoryAction = 'create' | 'skip' | 'map';

/** Resolution for one unknown category name. */
export interface CategoryResolution {
  name: string;
  action: CategoryAction;
  mapToCategoryId?: string;
}

/** Final import report. */
export interface ImportReport {
  imported: number;
  skipped: number;
  duplicates: number;
  warnings: number;
  errors: number;
  /** Row numbers (1-based) that threw an exception during import. */
  failedRows: number[];
  /** Error messages for failed rows, keyed by row number. */
  failedRowErrors: Record<number, string>;
  newCategories: number;
  /** Categories matched to existing ones (not created). */
  matchedCategories: number;
  /** Names of categories that were created. */
  createdCategoryNames: string[];
  /** Names of categories that were matched to existing ones. */
  matchedCategoryNames: string[];
  /** Media counts. */
  importedImages: number;
  importedVideos: number;
  importedAudio: number;
  /** Media URLs skipped due to invalid format/extension. */
  skippedMedia: number;
}

/** Progress callback during import. */
export interface ImportProgress {
  imported: number;
  remaining: number;
  total: number;
  pct: number;
  estimatedSecondsLeft: number;
}

/** Column mapping result from the mapper. */
export interface ColumnMapping {
  question?: number;
  answer?: number;
  category?: number;
  difficulty?: number;
  points?: number;
  image?: number;
  video?: number;
  audio?: number;
}

/** Difficulty label (Arabic + English). */
export type DifficultyRaw = string;

/** Per-row enrichment result from the AI (category/difficulty/points inference). */
export interface RowEnrichment {
  rowIndex: number;
  /** AI-suggested category name (or the original if category was present). */
  aiCategory: string;
  /** AI-suggested difficulty. */
  aiDifficulty: 'easy' | 'medium' | 'hard';
  /** AI-suggested points (derived from difficulty: 250/500/750). */
  aiPoints: 250 | 500 | 750;
  /** AI confidence 0-100. */
  confidence: number;
  /** Whether the AI was used (category was empty). */
  usedAI: boolean;
}

/** Admin override for a single row's enrichment. */
export interface RowOverride {
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: 250 | 500 | 750;
}

/** Normalize a raw difficulty string into a typed value. */
export function normalizeDifficulty(raw: string): QuestionDifficulty {
  const d = raw.trim().toLowerCase();
  if (['easy', 'سهل', '1', 'بسيط'].includes(d)) return 'easy';
  if (['hard', 'صعب', '3', 'صعبة'].includes(d)) return 'hard';
  return 'medium';
}
