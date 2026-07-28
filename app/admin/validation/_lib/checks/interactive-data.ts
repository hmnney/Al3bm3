import type { CheckResult, ValidationContext } from '../types';
import type { PluginDataset } from '../../../interactive/_lib/types';

/**
 * Check: Interactive categories contain data (generated words, images, etc.).
 *
 * Each interactive category has a plugin-specific dataset. This check
 * verifies the dataset exists and has at least one item. Warning if any
 * interactive category is empty (the game still works, but the category is
 * unusable). Offers a one-click fix to seed mock data.
 */
export function checkInteractiveData(ctx: ValidationContext): CheckResult {
  const { interactiveCategories } = ctx;
  const details: CheckResult['details'] = [];
  let hasWarning = false;

  for (const cat of interactiveCategories) {
    if (!cat.enabled) continue;
    const ds = cat.dataset;
    if (!ds) {
      hasWarning = true;
      details.push({
        message: `تصنيف تفاعلي بدون بيانات: "${cat.name}"`,
        severity: 'warning',
        categoryId: cat.id,
        categoryName: cat.name,
      });
      continue;
    }
    const count = datasetItemCount(ds);
    if (count === 0) {
      hasWarning = true;
      details.push({
        message: `تصنيف تفاعلي ببيانات فارغة: "${cat.name}"`,
        severity: 'warning',
        categoryId: cat.id,
        categoryName: cat.name,
      });
    }
  }

  if (interactiveCategories.filter((c) => c.enabled).length === 0) {
    details.push({
      message: 'لا توجد تصنيفات تفاعلية مفعّلة',
      severity: 'info',
    });
  }

  return {
    id: 'interactive-data',
    title: 'التصنيفات التفاعلية تحتوي بيانات',
    description: 'كل تصنيف تفاعلي مفعّل يجب أن يحتوي على كلمات أو صور أو وسائط',
    status: hasWarning ? 'warning' : 'pass',
    weight: 8,
    details,
    fix: hasWarning
      ? {
          id: 'seed-interactive-data',
          label: 'تعبئة بيانات تجريبية',
          description: 'إضافة كلمات تجريبية للتصنيفات التفاعلية الفارغة',
        }
      : undefined,
  };
}

function datasetItemCount(ds: PluginDataset): number {
  switch (ds.kind) {
    case 'word-only':
      return ds.words.length;
    case 'guess-image':
      return ds.images.length;
    case 'guess-audio':
      return ds.audio.length;
    case 'guess-poster':
      return ds.posters.length;
    case 'guess-celebration':
      return ds.videos.length;
    default:
      return 0;
  }
}
