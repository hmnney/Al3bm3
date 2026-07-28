import type { CheckResult, ValidationContext } from '../types';

/**
 * Check: No duplicated questions.
 *
 * Detects questions with identical normalized text within the same category.
 * Fail if any duplicates are found. Offers a one-click fix to delete them.
 */
export function checkDuplicates(ctx: ValidationContext): CheckResult {
  const { questions } = ctx;
  const details: CheckResult['details'] = [];
  const seen = new Map<string, string[]>();

  for (const q of questions) {
    const key = q.question.trim().toLowerCase();
    if (!key) continue;
    const existing = seen.get(key);
    if (existing) {
      existing.push(q.id);
    } else {
      seen.set(key, [q.id]);
    }
  }

  const duplicateGroups = Array.from(seen.values()).filter((ids) => ids.length > 1);
  const duplicateIds = duplicateGroups.flatMap((ids) => ids.slice(1));

  for (const group of duplicateGroups) {
    const q = questions.find((qq) => qq.id === group[0]);
    details.push({
      message: `سؤال مكرر (${group.length} نسخ): "${q?.question ?? 'غير معروف'}"`,
      severity: 'error',
    });
  }

  return {
    id: 'duplicates',
    title: 'لا توجد أسئلة مكررة',
    description: 'كل سؤال يجب أن يكون فريداً داخل تصنيفه',
    status: duplicateIds.length > 0 ? 'fail' : 'pass',
    weight: 10,
    details,
    fix: duplicateIds.length > 0
      ? {
          id: 'delete-duplicates',
          label: 'حذف التكرارات',
          description: `حذف ${duplicateIds.length} سؤالاً مكرراً`,
        }
      : undefined,
  };
}

/** Returns the ids of duplicate questions to delete (keeps the first copy). */
export function getDuplicateQuestionIds(ctx: ValidationContext): string[] {
  const { questions } = ctx;
  const seen = new Map<string, string[]>();
  for (const q of questions) {
    const key = q.question.trim().toLowerCase();
    if (!key) continue;
    const existing = seen.get(key);
    if (existing) existing.push(q.id);
    else seen.set(key, [q.id]);
  }
  return Array.from(seen.values())
    .filter((ids) => ids.length > 1)
    .flatMap((ids) => ids.slice(1));
}
