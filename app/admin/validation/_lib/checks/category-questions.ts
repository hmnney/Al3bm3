import type { CheckResult, ValidationContext } from '../types';
import { THRESHOLDS } from '../types';

/**
 * Check: Every category has enough questions.
 *
 * Fail if any category has 0 questions. Warning if any has fewer than the
 * minimum threshold. Pass when all categories meet the minimum.
 */
export function checkCategoryQuestions(ctx: ValidationContext): CheckResult {
  const { categories, questions } = ctx;
  const details: CheckResult['details'] = [];
  let hasFail = false;
  let hasWarning = false;

  for (const cat of categories) {
    const count = questions.filter((q) => q.categoryId === cat.id).length;
    if (count === 0) {
      hasFail = true;
      details.push({
        message: `لا توجد أسئلة في تصنيف "${cat.name}"`,
        severity: 'error',
        categoryId: cat.id,
        categoryName: cat.name,
      });
    } else if (count < THRESHOLDS.MIN_QUESTIONS_PER_CATEGORY) {
      hasWarning = true;
      details.push({
        message: `تصنيف "${cat.name}" يحتوي على ${count} أسئلة فقط (الحد الأدنى ${THRESHOLDS.MIN_QUESTIONS_PER_CATEGORY})`,
        severity: 'warning',
        categoryId: cat.id,
        categoryName: cat.name,
      });
    }
  }

  if (categories.length === 0) {
    hasFail = true;
    details.push({
      message: 'لا توجد تصنيفات في النظام',
      severity: 'error',
    });
  }

  const status = hasFail ? 'fail' : hasWarning ? 'warning' : 'pass';
  return {
    id: 'category-questions',
    title: 'أسئلة كافية في كل تصنيف',
    description: `كل تصنيف يجب أن يحتوي على ${THRESHOLDS.MIN_QUESTIONS_PER_CATEGORY} أسئلة على الأقل`,
    status,
    weight: 15,
    details,
    fix: hasFail || hasWarning
      ? {
          id: 'go-to-builder',
          label: 'بناء أسئلة',
          description: 'اذهب إلى بناء بنك الأسئلة لتوليد أسئلة',
          navigates: true,
          href: '/admin/builder',
        }
      : undefined,
  };
}
