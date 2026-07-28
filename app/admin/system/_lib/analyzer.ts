import type { QuestionDifficulty } from '@/lib/types';
import type { AdminCategory, AdminQuestion } from '../../_lib/types';
import type {
  DiagnosticIssue,
  DiagnosticSuggestion,
  DiagnosticsResult,
  DiagnosticsStats,
  HealthScore,
} from './types';
import {
  classifyPair,
} from '../../import/_lib/ai/duplicate-detector';
import { normalize } from '../../import/_lib/ai/text-utils';

/**
 * Diagnostics analyzer — pure functions that compute the full health report
 * from the admin store + settings. Consumes existing data only; never mutates.
 *
 * Duplicate detection reuses the existing analyzer's `classifyPair` so logic is
 * never duplicated. All scoring is local and deterministic.
 */

/** Compute the raw statistics block. */
export function computeStats(
  categories: AdminCategory[],
  questions: AdminQuestion[],
  hiddenIds: string[],
  disabledIds: string[]
): DiagnosticsStats {
  const questionsPerCategory = categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    count: questions.filter((q) => q.categoryId === c.id).length,
  }));

  const questionsPerDifficulty: Record<QuestionDifficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  questions.forEach((q) => {
    questionsPerDifficulty[q.difficulty] += 1;
  });

  const imagesCount = questions.filter((q) => Boolean(q.image)).length;
  const audioCount = questions.filter((q) => Boolean(q.audio)).length;
  const videoCount = questions.filter((q) => Boolean(q.video)).length;

  // "Missing" media = questions whose category implies media (by id) but the
  // field is absent. We treat image-style categories as needing images, audio
  // categories as needing audio, etc., based on the category id.
  const imageCategoryIds = new Set([
    'movie-posters',
    'anime-posters',
    'game-posters',
    'guess-image',
    'who-celebrity',
    'guess-celebration',
  ]);
  const audioCategoryIds = new Set(['guess-voice']);
  const videoCategoryIds = new Set<string>();

  const missingImages = questions.filter(
    (q) => imageCategoryIds.has(q.categoryId) && !q.image
  ).length;
  const missingAudio = questions.filter(
    (q) => audioCategoryIds.has(q.categoryId) && !q.audio
  ).length;
  const missingVideo = questions.filter(
    (q) => videoCategoryIds.has(q.categoryId) && !q.video
  ).length;

  const questionsWithoutAnswers = questions.filter(
    (q) => !q.answer || !q.answer.trim()
  ).length;

  const duplicateQuestions = countDuplicates(questions);

  return {
    totalCategories: categories.length,
    totalQuestions: questions.length,
    questionsPerCategory,
    questionsPerDifficulty,
    imagesCount,
    audioCount,
    videoCount,
    missingImages,
    missingAudio,
    missingVideo,
    questionsWithoutAnswers,
    duplicateQuestions,
    hiddenCategories: hiddenIds.length,
    disabledCategories: disabledIds.length,
  };
}

/** Count duplicate questions using the existing duplicate detector. */
function countDuplicates(questions: AdminQuestion[]): number {
  const earlier: Array<{ question: string; rowIndex: number }> = [];
  let dupes = 0;
  questions.forEach((q, i) => {
    if (!q.question.trim()) return;
    const verdict = findDuplicateAmong(q.question, earlier);
    if (verdict) dupes++;
    earlier.push({ question: q.question, rowIndex: i });
  });
  return dupes;
}

function findDuplicateAmong(
  current: string,
  earlier: Array<{ question: string; rowIndex: number }>
): { kind: string | null; score: number } | null {
  let best: { kind: string | null; score: number } | null = null;
  for (let i = 0; i < earlier.length; i++) {
    const prev = earlier[i];
    if (!prev.question.trim()) continue;
    const verdict = classifyPair(current, prev.question, prev.rowIndex);
    if (!verdict.kind) continue;
    if (verdict.kind === 'exact') return verdict;
    if (!best || verdict.score > best.score) best = verdict;
  }
  return best;
}

/** Compute the 0–100 health score with a per-factor breakdown. */
export function computeHealth(
  stats: DiagnosticsStats,
  questions: AdminQuestion[]
): HealthScore {
  const total = stats.totalQuestions || 1;

  // Duplicates: 0 duplicates = 100, 20% duplicates = 0.
  const dupRatio = stats.duplicateQuestions / total;
  const duplicates = clampScore(100 - dupRatio * 500);

  // Missing answers: 0 missing = 100, 10% missing = 0.
  const ansRatio = stats.questionsWithoutAnswers / total;
  const answers = clampScore(100 - ansRatio * 1000);

  // Missing media: weighted by how much expected media is missing.
  const missingMediaTotal =
    stats.missingImages + stats.missingAudio + stats.missingVideo;
  const mediaExpected = Math.max(
    1,
    stats.imagesCount + stats.missingImages + stats.audioCount + stats.missingAudio
  );
  const media = clampScore(100 - (missingMediaTotal / mediaExpected) * 100);

  // Category balance: penalize categories with very few questions.
  const counts = stats.questionsPerCategory.map((c) => c.count);
  const avg = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
  const variance =
    counts.reduce((a, c) => a + Math.pow(c - avg, 2), 0) / (counts.length || 1);
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
  const categoryBalance = clampScore(100 - cv * 100);

  // Difficulty balance: ideal ~40/35/25 easy/medium/hard.
  const d = stats.questionsPerDifficulty;
  const idealEasy = 0.4;
  const idealMed = 0.35;
  const idealHard = 0.25;
  const easyDev = Math.abs(d.easy / total - idealEasy);
  const medDev = Math.abs(d.medium / total - idealMed);
  const hardDev = Math.abs(d.hard / total - idealHard);
  const difficultyBalance = clampScore(100 - (easyDev + medDev + hardDev) * 100);

  // Question quality: penalize short questions + missing answers.
  const shortQuestions = questions.filter(
    (q) => q.question.trim().length < 12
  ).length;
  const quality = clampScore(
    100 - (shortQuestions / total) * 100 - (stats.questionsWithoutAnswers / total) * 50
  );

  const breakdown = {
    duplicates,
    answers,
    media,
    categoryBalance,
    difficultyBalance,
    quality,
  };

  const weights = {
    duplicates: 0.2,
    answers: 0.25,
    media: 0.15,
    categoryBalance: 0.15,
    difficultyBalance: 0.15,
    quality: 0.1,
  };

  const score = Math.round(
    duplicates * weights.duplicates +
      answers * weights.answers +
      media * weights.media +
      categoryBalance * weights.categoryBalance +
      difficultyBalance * weights.difficultyBalance +
      quality * weights.quality
  );

  return { score: clampScore(score), breakdown };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Generate human-readable issues from the stats. */
export function buildIssues(
  stats: DiagnosticsStats,
  _questions: AdminQuestion[]
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];

  // Per-category low count.
  stats.questionsPerCategory.forEach((c) => {
    if (c.count < 5) {
      issues.push({
        severity: 'warning',
        message: `الفئة "${c.name}" تحتوي على عدد قليل من الأسئلة (${c.count}).`,
      });
    }
  });

  // Per-category missing hard questions.
  stats.questionsPerCategory.forEach((c) => {
    // We don't have per-category difficulty here; approximate via global check.
    void c;
  });
  if (stats.questionsPerDifficulty.hard === 0) {
    issues.push({
      severity: 'warning',
      message: 'لا توجد أسئلة صعبة (750 نقطة) في أي تصنيف.',
    });
  }

  // Missing answers.
  if (stats.questionsWithoutAnswers > 0) {
    issues.push({
      severity: 'critical',
      message: `يوجد ${stats.questionsWithoutAnswers} سؤالاً بدون إجابة.`,
    });
  }

  // Missing media.
  if (stats.missingImages > 0) {
    issues.push({
      severity: 'warning',
      message: `يوجد ${stats.missingImages} صورة مفقودة.`,
    });
  }
  if (stats.missingAudio > 0) {
    issues.push({
      severity: 'warning',
      message: `يوجد ${stats.missingAudio} ملف صوتي مفقود.`,
    });
  }
  if (stats.missingVideo > 0) {
    issues.push({
      severity: 'info',
      message: `يوجد ${stats.missingVideo} ملف فيديو مفقود.`,
    });
  }

  // Duplicates.
  if (stats.duplicateQuestions > 0) {
    issues.push({
      severity: 'critical',
      message: `يوجد ${stats.duplicateQuestions} سؤال مكرر.`,
    });
  }

  // Hidden / disabled categories.
  if (stats.hiddenCategories > 0) {
    issues.push({
      severity: 'info',
      message: `يوجد ${stats.hiddenCategories} تصنيف مخفي.`,
    });
  }
  if (stats.disabledCategories > 0) {
    issues.push({
      severity: 'info',
      message: `يوجد ${stats.disabledCategories} تصنيف معطّل.`,
    });
  }

  return issues;
}

/** Generate actionable suggestions from the stats. */
export function buildSuggestions(
  stats: DiagnosticsStats,
  questions: AdminQuestion[]
): DiagnosticSuggestion[] {
  const suggestions: DiagnosticSuggestion[] = [];

  // Low-count categories.
  stats.questionsPerCategory.forEach((c) => {
    if (c.count < 5) {
      suggestions.push({
        priority: 'high',
        message: `أضف أسئلة أكثر إلى تصنيف "${c.name}".`,
      });
    }
  });

  // No hard questions.
  if (stats.questionsPerDifficulty.hard === 0) {
    suggestions.push({
      priority: 'high',
      message: 'أضف أسئلة صعبة (750 نقطة) لتنويع مستوى التحدي.',
    });
  }

  // Missing media per category.
  const imageCatNames = stats.questionsPerCategory.filter((c) =>
    ['movie-posters', 'anime-posters', 'game-posters', 'guess-image', 'who-celebrity', 'guess-celebration'].includes(
      c.categoryId
    )
  );
  imageCatNames.forEach((c) => {
    const missing = questions.filter(
      (q) => q.categoryId === c.categoryId && !q.image
    ).length;
    if (missing > 0) {
      suggestions.push({
        priority: 'medium',
        message: `أضف صوراً لتصنيف "${c.name}" (${missing} سؤال بدون صورة).`,
      });
    }
  });

  const audioCatNames = stats.questionsPerCategory.filter((c) =>
    c.categoryId === 'guess-voice'
  );
  audioCatNames.forEach((c) => {
    const missing = questions.filter(
      (q) => q.categoryId === c.categoryId && !q.audio
    ).length;
    if (missing > 0) {
      suggestions.push({
        priority: 'medium',
        message: `أضف أسئلة صوتية لتصنيف "${c.name}" (${missing} سؤال بدون صوت).`,
      });
    }
  });

  // Missing answers.
  if (stats.questionsWithoutAnswers > 0) {
    suggestions.push({
      priority: 'high',
      message: `أكمل الإجابات لـ ${stats.questionsWithoutAnswers} سؤال بدون إجابة.`,
    });
  }

  // Duplicates.
  if (stats.duplicateQuestions > 0) {
    suggestions.push({
      priority: 'high',
      message: `راجع واحذف ${stats.duplicateQuestions} سؤال مكرر.`,
    });
  }

  // Difficulty imbalance.
  const d = stats.questionsPerDifficulty;
  if (d.medium === 0) {
    suggestions.push({
      priority: 'medium',
      message: 'أضف أسئلة متوسطة (500 نقطة) لتحقيق توازن الصعوبة.',
    });
  }
  if (d.easy === 0) {
    suggestions.push({
      priority: 'medium',
      message: 'أضف أسئلة سهلة (250 نقطة) لتحقيق توازن الصعوبة.',
    });
  }

  return suggestions;
}

/** Assemble the full diagnostics result. */
export function analyze(
  categories: AdminCategory[],
  questions: AdminQuestion[],
  hiddenIds: string[],
  disabledIds: string[]
): DiagnosticsResult {
  const stats = computeStats(categories, questions, hiddenIds, disabledIds);
  const health = computeHealth(stats, questions);
  const issues = buildIssues(stats, questions);
  const suggestions = buildSuggestions(stats, questions);
  return { stats, health, issues, suggestions };
}

// Keep normalize import used (re-exported for potential future AI hooks).
export { normalize };
