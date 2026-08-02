import { CATEGORIES } from '@/lib/constants';
import type { AdminCategory, AdminData, AdminQuestion } from './types';
import { toAdminCategory } from './types';
import {
  deleteCategoryRow,
  deleteQuestionRow,
  deleteQuestionsByCategory,
  fetchAllCategories,
  fetchAllQuestions,
  upsertCategoryRow,
  upsertQuestionRow,
  upsertQuestionRows,
  type CategoryRow,
  type QuestionRow,
  type StorageResult,
  type LoadResult,
} from '@/lib/state-persistence';

/**
 * Admin data store — backed by NORMALIZED Supabase tables.
 *
 * questions table: one row per question with real columns (id, category,
 * points, difficulty, question, answer, etc.)
 * categories table: one row per category with real columns.
 *
 * Supabase is the ONLY source of truth. localStorage is not used.
 * fetchAllQuestions() paginates to bypass the default 1000-row limit.
 */

function seed(): AdminData {
  const categories: AdminCategory[] = CATEGORIES.map(toAdminCategory);
  return { categories, questions: [] };
}

// ─── Row mappers ─────────────────────────────────────────────────────

function questionToRow(q: AdminQuestion): QuestionRow {
  return {
    id: q.id,
    category: q.categoryId,
    points: q.points,
    difficulty: q.difficulty,
    question: q.question,
    question_type: q.questionType ?? 'normal',
    option_a: q.optionA ?? null,
    option_b: q.optionB ?? null,
    option_c: q.optionC ?? null,
    option_d: q.optionD ?? null,
    answer: q.answer,
    image: q.image ?? null,
    audio: q.audio ?? null,
    video: q.video ?? null,
    tmdb_id: q.tmdb_id ?? null,
    tmdb_media: q.tmdb_media ?? null,
  };
}

function rowToQuestion(r: QuestionRow): AdminQuestion {
  return {
    id: r.id,
    categoryId: r.category,
    points: r.points as 250 | 500 | 750,
    difficulty: r.difficulty as AdminQuestion['difficulty'],
    question: r.question,
    answer: r.answer,
    image: r.image ?? undefined,
    audio: r.audio ?? undefined,
    video: r.video ?? undefined,
    tmdb_id: r.tmdb_id ?? undefined,
    tmdb_media: (r.tmdb_media as 'movie' | 'tv') ?? undefined,
    questionType: (r.question_type as 'normal' | 'multiple_choice') ?? 'normal',
    optionA: r.option_a ?? undefined,
    optionB: r.option_b ?? undefined,
    optionC: r.option_c ?? undefined,
    optionD: r.option_d ?? undefined,
  };
}

function categoryToRow(c: AdminCategory): CategoryRow {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    glyph: c.glyph,
    gradient: c.gradient,
    image: c.image ?? null,
  };
}

function rowToCategory(r: CategoryRow): AdminCategory {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    glyph: r.glyph,
    gradient: r.gradient,
    image: r.image ?? undefined,
  };
}

// ─── Load (from Supabase — the only source of truth) ──────────────────

export async function loadAdminDataRemote(): Promise<LoadResult<AdminData>> {
  const [qRes, catRes] = await Promise.all([
    fetchAllQuestions(),
    fetchAllCategories(),
  ]);
  if (qRes.status === 'error' || catRes.status === 'error') {
    return { status: 'error', data: null, error: qRes.error ?? catRes.error };
  }
  const questions = (qRes.data ?? []).map(rowToQuestion);
  const categories = (catRes.data ?? []).map(rowToCategory);
  if (categories.length === 0 && questions.length === 0) {
    return { status: 'notfound', data: null };
  }
  const finalCategories = categories.length > 0 ? categories : CATEGORIES.map(toAdminCategory);
  return { status: 'found', data: { categories: finalCategories, questions } };
}

// ─── Per-row remote operations ──────────────────────────────────────

export async function saveQuestionRemote(question: AdminQuestion): Promise<StorageResult> {
  return upsertQuestionRow(questionToRow(question));
}

export async function saveQuestionsRemote(questions: AdminQuestion[]): Promise<StorageResult> {
  return upsertQuestionRows(questions.map(questionToRow));
}

export async function deleteQuestionRemote(id: string): Promise<StorageResult> {
  return deleteQuestionRow(id);
}

export async function saveCategoryRemote(category: AdminCategory): Promise<StorageResult> {
  return upsertCategoryRow(categoryToRow(category));
}

export async function deleteCategoryRemote(id: string): Promise<StorageResult> {
  await deleteQuestionsByCategory(id);
  return deleteCategoryRow(id);
}

/** Wipe both tables and reseed the category catalog. */
export function resetAdminData(): AdminData {
  return seed();
}

/** Generate a unique id for a newly created category or question. */
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
