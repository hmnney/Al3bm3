import type { CheckResult, ValidationContext } from '../types';

/**
 * Check: QR categories can generate sessions.
 *
 * Verifies that every enabled interactive category with interactionType 'qr'
 * has valid configuration to create a QR session: non-empty secret content,
 * positive expiration, and positive connection timeout. Warning if invalid.
 * Offers a one-click fix to create a test session.
 */
export function checkQRSessions(ctx: ValidationContext): CheckResult {
  const { interactiveCategories } = ctx;
  const details: CheckResult['details'] = [];
  let hasWarning = false;

  const qrCats = interactiveCategories.filter(
    (c) => c.enabled && c.interactionType === 'qr'
  );

  if (qrCats.length === 0) {
    details.push({
      message: 'لا توجد تصنيفات QR مفعّلة',
      severity: 'info',
    });
    return {
      id: 'qr-sessions',
      title: 'تصنيفات QR قادرة على توليد جلسات',
      description: 'كل تصنيف QR يجب أن يكون قادراً على إنشاء جلسة صالحة',
      status: 'pass',
      weight: 5,
      details,
    };
  }

  for (const cat of qrCats) {
    const content = String(cat.config.secretContent ?? '').trim();
    const expiration = Number(cat.config.expirationSeconds ?? 0);
    const timeout = Number(cat.config.connectionTimeoutSeconds ?? 0);

    if (!content) {
      hasWarning = true;
      details.push({
        message: `تصنيف "${cat.name}": المحتوى السري فارغ`,
        severity: 'warning',
        categoryId: cat.id,
        categoryName: cat.name,
      });
    }
    if (expiration <= 0) {
      hasWarning = true;
      details.push({
        message: `تصنيف "${cat.name}": وقت الانتهاء غير صالح`,
        severity: 'warning',
        categoryId: cat.id,
        categoryName: cat.name,
      });
    }
    if (timeout <= 0) {
      hasWarning = true;
      details.push({
        message: `تصنيف "${cat.name}": مهلة الاتصال غير صالحة`,
        severity: 'warning',
        categoryId: cat.id,
        categoryName: cat.name,
      });
    }
  }

  return {
    id: 'qr-sessions',
    title: 'تصنيفات QR قادرة على توليد جلسات',
    description: 'كل تصنيف QR يجب أن يكون قادراً على إنشاء جلسة صالحة',
    status: hasWarning ? 'warning' : 'pass',
    weight: 5,
    details,
    fix: hasWarning
      ? {
          id: 'create-test-qr-session',
          label: 'إنشاء جلسة تجريبية',
          description: 'إنشاء جلسة QR تجريبية للتصنيفات غير الصالحة',
        }
      : undefined,
  };
}
