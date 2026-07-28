import type { QualityAnalysis, QualityFlag } from './types';
import {
  clamp100,
  hasAny,
  normalize,
  tokenList,
  tokenOverlap,
} from './text-utils';
import { triviaSimilarity } from './difficulty-engine';

/**
 * Quality analyzer — detects content-quality issues independent of difficulty:
 *
 *  - too-easy: trivial / cliché question, or answer is obvious from the stem.
 *  - too-vague: question phrasing is too generic to have one clear answer.
 *  - multiple-answers: many valid answers fit (e.g. "اسم لاعب؟" with no
 *    qualifier) — approximated via answer-length vs question-specificity.
 *  - answer-mismatch: the answer's content words barely overlap the question's
 *    subject, suggesting a wrong/placeholder answer.
 *  - incomplete-question: question too short to be answerable.
 *  - incomplete-answer: answer too short / placeholder.
 *
 * Pure function; the analyzer composes this with the difficulty engine and
 * duplicate detector. Easy to replace with a real model that emits the same
 * `QualityAnalysis` shape.
 */

/** Answer tokens that look like placeholders rather than real answers. */
const PLACEHOLDER_ANSWERS = new Set([
  '؟', '?', '...', 'نص', 'الإجابة', 'اجابة', 'غير', 'معروف', 'لا', 'لايوجد',
  'لا يوجد', 'x', 'xx', 'xxx', '-', '—', 'todo', 'tbd', 'null',
]);

/** Phrases that make a question too open-ended (multiple possible answers). */
const OPEN_ENDED_CUES = [
  'اذكر', 'أذكر', 'مثال', 'امثلة', 'أمثلة', 'اسماء', 'أسماء', 'اكثر',
  'أكثر', 'قائمة', 'كل', 'جميع',
];

/**
 * Run quality analysis on one (question, answer) pair.
 */
export function analyzeQuality(
  question: string,
  answer: string
): QualityAnalysis {
  const flags: QualityFlag[] = [];
  const q = question.trim();
  const a = answer.trim();
  const nq = normalize(q);
  const na = normalize(a);

  // Incomplete question: too short / no content words.
  const qTokens = tokenList(q).filter((t) => t.length > 1);
  if (q.length > 0 && qTokens.length < 2) {
    flags.push('incomplete-question');
  }

  // Incomplete answer: missing, placeholder, or a single tiny token.
  const aTokens = tokenList(a).filter((t) => t.length > 1);
  if (a.length > 0 && (aTokens.length < 1 || PLACEHOLDER_ANSWERS.has(na))) {
    flags.push('incomplete-answer');
  }

  // Too vague: vague openers + no specific subject words.
  if (q.length > 0 && hasAny(q, ['شيء', 'واحد', 'ماذا عن', 'اخبرني', 'تحدث']) &&
      qTokens.length < 5) {
    flags.push('too-vague');
  }

  // Multiple possible answers: open-ended cues + short unspecific question.
  if (q.length > 0 && hasAny(q, OPEN_ENDED_CUES) && !hasAny(q, ['الوحيد', 'الأول', 'الأخير'])) {
    flags.push('multiple-answers');
  }

  // Too easy: high trivia similarity, or the answer is literally inside the
  // question text (answer obvious from the stem).
  const trivia = triviaSimilarity(q);
  const answerInQuestion =
    na.length > 2 && nq.includes(na);
  if (q.length > 0 && (trivia >= 70 || answerInQuestion)) {
    flags.push('too-easy');
  }

  // Answer mismatch: the answer shares almost no content with the question's
  // subject — a rough proxy for a wrong answer (only when both are non-empty
  // and reasonably long, to avoid false positives on short factual answers).
  if (q.length > 0 && a.length > 0 && aTokens.length >= 2 && qTokens.length >= 3) {
    const overlap = tokenOverlap(q, a);
    if (overlap < 0.05) {
      flags.push('answer-mismatch');
    }
  }

  // Overall quality score: start at 100 and deduct per flag.
  let score = 100;
  const deductions: Record<QualityFlag, number> = {
    'too-easy': 15,
    'too-vague': 20,
    'multiple-answers': 18,
    'answer-mismatch': 30,
    'incomplete-question': 25,
    'incomplete-answer': 25,
  };
  flags.forEach((f) => {
    score -= deductions[f];
  });

  return {
    flags,
    score: clamp100(score),
    notes: qualityNotes(flags),
  };
}

/** Arabic notes string summarizing the quality flags. */
function qualityNotes(flags: QualityFlag[]): string {
  if (flags.length === 0) return 'الجودة جيدة.';
  const map: Record<QualityFlag, string> = {
    'too-easy': 'السؤال سهل جداً أو مألوف',
    'too-vague': 'الصياغة غامضة',
    'multiple-answers': 'قد يكون له أكثر من إجابة صحيحة',
    'answer-mismatch': 'الإجابة لا تبدو متطابقة مع السؤال',
    'incomplete-question': 'السؤال غير مكتمل',
    'incomplete-answer': 'الإجابة غير مكتملة أو مؤقتة',
  };
  return flags.map((f) => map[f]).join(' · ');
}

/** True if a quality flag is severe enough to force needs-review. */
export function isSevereQuality(flags: QualityFlag[]): boolean {
  return (
    flags.includes('answer-mismatch') ||
    flags.includes('incomplete-question') ||
    flags.includes('incomplete-answer') ||
    flags.includes('multiple-answers')
  );
}
