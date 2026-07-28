import type { CheckResult, ValidationContext } from '../types';
import { POINT_VALUES } from '@/lib/constants';

/**
 * Check: Every category has questions at all three point levels (250/500/750).
 *
 * Fail if any category is missing one or more point tiers.
 */
export function checkPointCoverage(ctx: ValidationContext): CheckResult {
  const { categories, questions } = ctx;
  const details: CheckResult['details'] = [];
  let hasFail = false;

  for (const cat of categories) {
    const catQuestions = questions.filter((q) => q.categoryId === cat.id);
    const missing = POINT_VALUES.filter(
      (pv) => catQuestions.filter((q) => q.points === pv).length === 0
    );
    if (missing.length > 0) {
      hasFail = true;
      details.push({
        message: `تصنيف "${cat.name}" يفتقد مستويات النقاط: ${missing.map((m) => m.toString()).join('، ')}`,
        severity: 'error',
        categoryId: cat.id,
        categoryName: cat.name,
      });
    }
  }

  return {
    id: 'point-coverage',
    title: 'تغطية مستويات النقاط (250 / 500 / 750)',
    description: 'كل تصنيف يجب أن يحتوي على أسئلة في كل مستوى نقاط',
    status: hasFail ? 'fail' : 'pass',
    weight: 15,
    details,
    fix: hasFail
      ? {
          id: 'go-to-builder',
          label: 'بناء أسئلة',
          description: 'اذهب إلى بناء بنك الأسئلة لتوليد أسئلة بمستويات مختلفة',
          navigates: true,
          href: '/admin/builder',
        }
      : undefined,
  };
}
