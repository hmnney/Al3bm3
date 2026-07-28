import { normalizeArabic } from '../../../import/_lib/pipeline';
import type { CheckResult, ValidationContext } from '../types';

/**
 * Check: Smart Import pipeline is healthy.
 *
 * Runs a smoke test against the import pipeline's pure functions to verify
 * the modules are loadable and functional at runtime. Fail only if a pipeline
 * function throws unexpectedly.
 */
export function checkImportPipeline(ctx: ValidationContext): CheckResult {
  const details: CheckResult['details'] = [];
  const _ = ctx;

  try {
    const result = normalizeArabic('اختبار النظام');
    if (typeof result !== 'string' || result.length === 0) {
      throw new Error('normalizeArabic returned invalid output');
    }
    details.push({
      message: 'خط الاستيراد يعمل بشكل صحيح',
      severity: 'info',
    });
    return {
      id: 'import-pipeline',
      title: 'خط الاستيراد الذكي سليم',
      description: 'التحقق من سلامة وحدات الاستيراد الذكي',
      status: 'pass',
      weight: 5,
      details,
    };
  } catch (err) {
    details.push({
      message: `خطأ في خط الاستيراد: ${(err as Error).message || 'غير معروف'}`,
      severity: 'error',
    });
    return {
      id: 'import-pipeline',
      title: 'خط الاستيراد الذكي سليم',
      description: 'التحقق من سلامة وحدات الاستيراد الذكي',
      status: 'fail',
      weight: 5,
      details,
    };
  }
}
