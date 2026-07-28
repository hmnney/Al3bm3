import type { CheckResult, ValidationContext } from '../types';
import { THRESHOLDS } from '../types';

/**
 * Check: No empty answers.
 *
 * Detects questions with missing or very short answers. Fail if any found.
 * Offers a one-click fix to delete them.
 */
export function checkEmptyAnswers(ctx: ValidationContext): CheckResult {
  const { questions } = ctx;
  const details: CheckResult['details'] = [];
  const emptyIds: string[] = [];

  for (const q of questions) {
    if (!q.answer || q.answer.trim().length < THRESHOLDS.MIN_ANSWER_LENGTH) {
      emptyIds.push(q.id);
      details.push({
        message: `سؤال بدون إجابة: "${q.question.slice(0, 50)}${q.question.length > 50 ? '…' : ''}"`,
        severity: 'error',
      });
    }
  }

  return {
    id: 'empty-answers',
    title: 'لا توجد إجابات فارغة',
    description: 'كل سؤال يجب أن يكون له إجابة صحيحة',
    status: emptyIds.length > 0 ? 'fail' : 'pass',
    weight: 10,
    details,
    fix: emptyIds.length > 0
      ? {
          id: 'delete-empty-answers',
          label: 'حذف الأسئلة بلا إجابة',
          description: `حذف ${emptyIds.length} سؤالاً بدون إجابة`,
        }
      : undefined,
  };
}

/** Returns ids of questions with empty/missing answers. */
export function getEmptyAnswerQuestionIds(ctx: ValidationContext): string[] {
  const { questions } = ctx;
  return questions
    .filter((q) => !q.answer || q.answer.trim().length < THRESHOLDS.MIN_ANSWER_LENGTH)
    .map((q) => q.id);
}
