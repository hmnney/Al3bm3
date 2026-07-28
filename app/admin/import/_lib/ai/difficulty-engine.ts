import type { QuestionDifficulty } from '@/lib/types';
import type { DifficultyBreakdown, DifficultySuggestion } from './types';
import {
  clamp100,
  countMatches,
  hasAny,
  normalize,
  tokenList,
  tokenOverlap,
} from './text-utils';

/**
 * Advanced Difficulty Engine.
 *
 * Evaluates question difficulty from *reasoning signals* — never from length.
 * Each signal is scored 0–100 and combined into a final difficulty + confidence
 * + explanation. This is the module a future real AI model would replace the
 * internals of (or feed its own scores into); the output shape is fixed by
 * `DifficultyBreakdown` + `DifficultySuggestion`.
 *
 * Signals evaluated:
 *  - General knowledge required (broad, commonly-taught facts)
 *  - Specific knowledge required (niche / specialist facts)
 *  - Memory difficulty (exact dates, numbers, names from recall)
 *  - Number of reasoning steps (inference chains to reach the answer)
 *  - Need for deep fan knowledge (fandom-specific detail)
 *  - Ambiguity (how vague the question is)
 *  - Similarity to common trivia (cliché vs novel)
 */

/** Cues that signal a need for precise recall (memory difficulty). */
const MEMORY_CUES = [
  'سنة', 'عام', 'تاريخ', 'كم عام', 'في أي عام', 'متى', 'كم عدد', 'عدد',
  'نتيجة', 'الرقم', 'رقم', 'ترتيب', 'المركز', 'كم مرة', 'عدد مرات',
];

/** Cues that signal niche / specialist knowledge. */
const SPECIFIC_CUES = [
  'مؤلف', 'مكتشف', 'مخترع', 'مخرج', 'بطولة', 'إنجاز', 'قائد', 'مدرب',
  'بطل', 'وصيف', 'الدوري', 'كأس', 'نسخة', 'موسم', 'حلقة', 'جزء',
  'أول', 'آخر', 'الوحيد', 'نادر',
];

/** Cues that signal broad general knowledge. */
const GENERAL_CUES = [
  'عاصمة', 'بلد', 'دولة', 'قارة', 'مدينة', 'عالم', 'فنان', 'لاعب',
  'فريق', 'ناد', 'فيلم', 'مسلسل', 'أنمي', 'لعبة', 'مغني', 'رئيس',
];

/** Cues that signal deep fan knowledge. */
const FAN_CUES = [
  'اسم حقيقي', 'الاسم الحقيقي', 'قبل', 'بعد', 'لماذا', 'كيف', 'مقابل',
  'ضد', 'نتيجة', 'تفاصيل', 'دور', 'شخصية', 'حلقة', 'موسم', 'جزء',
  'البطولة', 'التأهل', 'الهدف', 'أهداف', 'أسطور',
];

/** Cues that signal multiple reasoning steps. */
const REASONING_CUES = [
  'لماذا', 'كيف', 'ما السبب', 'ما الحل', 'رتّب', 'رتب', 'التسلسل',
  'النتيجة', 'الفرق', 'اربط', 'استنتج', 'حدد', 'قارن', 'اجمع',
];

/** Cues that signal ambiguity (vague phrasing). */
const AMBIGUITY_CUES = [
  'شيء', 'واحد', 'ماذا', 'إلخ', 'إلى آخره', 'ربما', 'تقريبا', 'حوالي',
  'نوعا ما', 'شكل من',
];

/** Very common trivia patterns the question may be a cliché of. */
const COMMON_TRIVIA = [
  'عاصمة', 'كم لاعب', 'كم عدد', 'ما لون', 'ما اسم عاصمة',
];

/** Weak question openers that usually mean vague / incomplete phrasing. */
const VAGUE_OPENERS = ['من هو', 'ما هو', 'ماذا', 'اختر', 'اي'];

/** Stopwords excluded when estimating reasoning step count. */
const STOPWORDS = new Set([
  'من', 'ما', 'ماذا', 'كم', 'أين', 'متى', 'لماذا', 'كيف', 'هل', 'في',
  'على', 'عن', 'مع', 'و', 'أو', 'ثم', 'ال', 'هو', 'هي', 'هذا', 'هذه',
  'ذلك', 'تلك', 'التي', 'الذي', 'اسم', 'عدد', 'سنة', 'عام', 'وفي',
]);

/**
 * Estimate the number of reasoning steps a question demands. Rough heuristic:
 * count distinct content clauses (split on conjunctions / question marks) and
 * add weight for relational cues (compare, sequence, cause/effect).
 */
function estimateReasoningSteps(question: string): number {
  const q = normalize(question);
  if (!q) return 0;
  // Split on Arabic + Latin conjunctions and punctuation into clauses.
  const clauses = q
    .split(/و|ثم|أو|،|,|;|؛|\?|؟|\./)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let steps = Math.max(1, clauses.length);
  if (hasAny(question, ['رتّب', 'رتب', 'التسلسل', 'قارن', 'اربط'])) steps += 2;
  if (hasAny(question, ['لماذا', 'كيف', 'استنتج'])) steps += 1;
  return Math.min(steps, 6);
}

/** Count non-stopword meaningful tokens (a content-density proxy). */
function contentTokens(question: string): string[] {
  return tokenList(question).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

/**
 * Core engine: compute the full difficulty breakdown for one question.
 * Pure function, no I/O — easy to unit-test and to swap behind the interface.
 */
export function analyzeDifficulty(question: string): DifficultyBreakdown {
  const q = question;
  if (!q.trim()) {
    return {
      generalKnowledgeScore: 0,
      specificKnowledgeScore: 0,
      reasoningScore: 0,
      memoryScore: 0,
      fanKnowledgeScore: 0,
      ambiguityScore: 0,
      triviaSimilarityScore: 0,
      reasoningSteps: 0,
    };
  }

  const memoryHits = countMatches(q, MEMORY_CUES);
  const specificHits = countMatches(q, SPECIFIC_CUES);
  const generalHits = countMatches(q, GENERAL_CUES);
  const fanHits = countMatches(q, FAN_CUES);
  const reasoningHits = countMatches(q, REASONING_CUES);
  const ambiguityHits = countMatches(q, AMBIGUITY_CUES);
  const triviaHits = countMatches(q, COMMON_TRIVIA);
  const reasoningSteps = estimateReasoningSteps(q);

  const generalKnowledgeScore = clamp100(
    30 + generalHits * 22 - specificHits * 8
  );
  const specificKnowledgeScore = clamp100(
    20 + specificHits * 26 + fanHits * 10
  );
  const reasoningScore = clamp100(15 + reasoningHits * 30 + reasoningSteps * 12);
  const memoryScore = clamp100(25 + memoryHits * 28);
  const fanKnowledgeScore = clamp100(15 + fanHits * 30 + specificHits * 6);
  const ambiguityScore = clamp100(
    10 + ambiguityHits * 30 + (hasAny(q, VAGUE_OPENERS) ? 12 : 0)
  );
  const triviaSimilarityScore = clamp100(20 + triviaHits * 30);

  return {
    generalKnowledgeScore,
    specificKnowledgeScore,
    reasoningScore,
    memoryScore,
    fanKnowledgeScore,
    ambiguityScore,
    triviaSimilarityScore,
    reasoningSteps,
  };
}

/**
 * Convert a breakdown into a final difficulty + confidence + explanation.
 * The weighted blend intentionally down-weights "general knowledge" (which
 * tends to map to easy) and up-weights specific knowledge, memory, reasoning,
 * and fan knowledge.
 */
export function decideDifficulty(
  question: string,
  breakdown: DifficultyBreakdown
): DifficultySuggestion {
  if (!question.trim()) {
    return {
      difficulty: 'easy',
      confidence: 0,
      reason: 'صف فارغ',
      breakdown,
      explanation: 'لا يوجد نص سؤال لتحليله.',
    };
  }

  const hardWeight =
    breakdown.specificKnowledgeScore * 0.28 +
    breakdown.memoryScore * 0.22 +
    breakdown.fanKnowledgeScore * 0.2 +
    breakdown.reasoningScore * 0.18;
  const easyWeight =
    breakdown.generalKnowledgeScore * 0.35 +
    (100 - breakdown.memoryScore) * 0.15 +
    (100 - breakdown.specificKnowledgeScore) * 0.1;
  // Ambiguity lowers confidence regardless of difficulty.
  const ambiguityPenalty = breakdown.ambiguityScore * 0.3;
  // Cliché trivia is easier (known to many).
  const triviaEase = breakdown.triviaSimilarityScore * 0.12;

  const hardSignal = hardWeight - triviaEase;
  const easySignal = easyWeight + triviaEase;

  let difficulty: QuestionDifficulty;
  let confidence: number;

  if (hardSignal >= 58) {
    difficulty = 'hard';
    confidence = 60 + (hardSignal - 58) * 0.9;
  } else if (hardSignal >= 38 && easySignal < 55) {
    difficulty = 'medium';
    confidence = 55 + Math.abs(hardSignal - easySignal) * 0.4;
  } else if (easySignal >= 55) {
    difficulty = 'easy';
    confidence = 60 + (easySignal - 55) * 0.9;
  } else {
    // Weak / conflicting signals — default to medium with lower confidence.
    difficulty = 'medium';
    confidence = 45;
  }

  confidence = clamp100(confidence - ambiguityPenalty);
  // Low reasoning-steps + high ambiguity → even less confident.
  if (breakdown.reasoningSteps <= 1 && breakdown.ambiguityScore > 50) {
    confidence = Math.min(confidence, 42);
  }

  const reason = shortReason(difficulty, breakdown);
  const explanation = fullExplanation(difficulty, confidence, breakdown);

  return {
    difficulty,
    confidence,
    reason,
    breakdown,
    explanation,
  };
}

/** One-line Arabic reason for the review screen (existing UI field). */
function shortReason(
  difficulty: QuestionDifficulty,
  b: DifficultyBreakdown
): string {
  if (difficulty === 'hard') {
    if (b.fanKnowledgeScore >= 60) return 'يتطلب معرفة جماهيرية عميقة';
    if (b.memoryScore >= 60) return 'يتطلب استدعاء معرفة دقيقة من الذاكرة';
    if (b.reasoningScore >= 60) return 'يتطلب عدة خطوات استنتاج';
    return 'يتطلب معرفة متخصصة محددة';
  }
  if (difficulty === 'easy') {
    if (b.triviaSimilarityScore >= 60) return 'سؤال شائع ومألوف للكثيرين';
    if (b.generalKnowledgeScore >= 60) return 'يعتمد على معرفة عامة بسيطة';
    return 'يعتمد على التعرف المباشر';
  }
  return 'يتطلب معرفة عامة بدرجة متوسطة';
}

/** Full Arabic explanation of why this difficulty was chosen. */
function fullExplanation(
  difficulty: QuestionDifficulty,
  confidence: number,
  b: DifficultyBreakdown
): string {
  const parts: string[] = [];
  parts.push(
    `الصعوبة المختارة: ${labelOf(difficulty)} بثقة ${confidence}%.`
  );
  parts.push(
    `معرفة عامة: ${b.generalKnowledgeScore}/100، ` +
      `معرفة متخصصة: ${b.specificKnowledgeScore}/100، ` +
      `ذاكرة: ${b.memoryScore}/100.`
  );
  parts.push(
    `خطوات استنتاج مقدّرة: ${b.reasoningSteps}، ` +
      `معرفة جماهيرية: ${b.fanKnowledgeScore}/100، ` +
      `غموض: ${b.ambiguityScore}/100.`
  );
  if (b.triviaSimilarityScore >= 60) {
    parts.push('السؤال قريب من أسئلة معروفة شائعة مما يخفّف صعوبته.');
  }
  if (b.ambiguityScore >= 55) {
    parts.push('صياغة السؤال غامضة نسبياً، مما يخفّض الثقة.');
  }
  if (confidence < 50) {
    parts.push('الثقة منخفضة — يُنصح بمراجعة يدوية.');
  }
  return parts.join(' ');
}

function labelOf(d: QuestionDifficulty): string {
  return d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : 'صعب';
}

/**
 * Check whether the question text is similar to common trivia patterns,
 * using token overlap against a small set of cliché templates. Kept here so
 * the quality analyzer can reuse the same notion of "trivial".
 */
export function triviaSimilarity(question: string): number {
  let best = 0;
  COMMON_TRIVIA.forEach((tpl) => {
    best = Math.max(best, tokenOverlap(question, tpl));
  });
  return Math.round(best * 100);
}

/** Re-exported so callers needing content density don't reach into text-utils. */
export { contentTokens };
