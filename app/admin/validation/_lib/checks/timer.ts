import type { CheckResult, ValidationContext } from '../types';

/**
 * Check: Timer values are valid.
 *
 * Validates that timer presets exist, are all positive, and the default
 * preset is among the available presets. Offers a one-click fix to reset.
 */
export function checkTimer(ctx: ValidationContext): CheckResult {
  const { settings } = ctx;
  const timer = settings.timer;
  const details: CheckResult['details'] = [];
  let hasFail = false;

  const allPresets = [...timer.presets, ...timer.customPresets];

  if (allPresets.length === 0) {
    hasFail = true;
    details.push({
      message: 'لا توجد قيم مؤقت متاحة',
      severity: 'error',
    });
  }

  if (allPresets.some((p) => typeof p !== 'number' || p <= 0)) {
    hasFail = true;
    details.push({
      message: 'بعض قيم المؤقت غير صالحة (يجب أن تكون أرقاماً موجبة)',
      severity: 'error',
    });
  }

  if (timer.defaultPreset <= 0) {
    hasFail = true;
    details.push({
      message: 'المؤقت الافتراضي غير صالح',
      severity: 'error',
    });
  }

  if (allPresets.length > 0 && !allPresets.includes(timer.defaultPreset)) {
    hasFail = true;
    details.push({
      message: 'المؤقت الافتراضي ليس ضمن القيم المتاحة',
      severity: 'error',
    });
  }

  return {
    id: 'timer',
    title: 'قيم المؤقت صالحة',
    description: 'التحقق من صحة قيم المؤقت والقيمة الافتراضية',
    status: hasFail ? 'fail' : 'pass',
    weight: 5,
    details,
    fix: hasFail
      ? {
          id: 'reset-timer',
          label: 'إعادة الضبط',
          description: 'إعادة إعدادات المؤقت إلى القيم الافتراضية',
        }
      : undefined,
  };
}
