import type { CheckResult, ValidationContext } from '../types';

/**
 * Check: Game settings are valid.
 *
 * Validates the game defaults: non-empty name, positive category count, and
 * at least one enabled point tier. Offers a one-click fix to reset to
 * defaults.
 */
export function checkGameSettings(ctx: ValidationContext): CheckResult {
  const { settings } = ctx;
  const game = settings.game;
  const details: CheckResult['details'] = [];
  let hasFail = false;

  if (!game.defaultGameName.trim()) {
    hasFail = true;
    details.push({
      message: 'اسم اللعبة فارغ',
      severity: 'error',
    });
  }
  if (game.defaultNumberOfCategories < 1) {
    hasFail = true;
    details.push({
      message: 'عدد التصنيفات الافتراضي غير صالح',
      severity: 'error',
    });
  }
  if (!game.defaultPoints || game.defaultPoints.length === 0) {
    hasFail = true;
    details.push({
      message: 'لا توجد مستويات نقاط مفعّلة',
      severity: 'error',
    });
  }

  return {
    id: 'game-settings',
    title: 'إعدادات اللعبة صالحة',
    description: 'التحقق من صحة إعدادات اللعبة العامة',
    status: hasFail ? 'fail' : 'pass',
    weight: 10,
    details,
    fix: hasFail
      ? {
          id: 'reset-game-settings',
          label: 'إعادة الضبط',
          description: 'إعادة إعدادات اللعبة إلى القيم الافتراضية',
        }
      : undefined,
  };
}
