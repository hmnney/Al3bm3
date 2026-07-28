import { TEAM_COLORS } from '@/lib/constants';
import type { CheckResult, ValidationContext } from '../types';

/**
 * Check: Teams configuration is valid.
 *
 * Validates that there are exactly 2 default team names (both non-empty), at
 * least 2 available colors, and maxTeams >= 2. Offers a one-click fix to
 * reset to defaults.
 */
export function checkTeams(ctx: ValidationContext): CheckResult {
  const { settings } = ctx;
  const teams = settings.teams;
  const details: CheckResult['details'] = [];
  let hasFail = false;

  if (!teams.defaultTeamNames || teams.defaultTeamNames.length !== 2) {
    hasFail = true;
    details.push({
      message: 'أسماء الفرق الافتراضية غير مكتملة (مطلوب فريقان)',
      severity: 'error',
    });
  } else {
    if (!teams.defaultTeamNames[0].trim() || !teams.defaultTeamNames[1].trim()) {
      hasFail = true;
      details.push({
        message: 'أحد أسماء الفرق الافتراضية فارغ',
        severity: 'error',
      });
    }
  }

  if (teams.availableColors.length < 2) {
    hasFail = true;
    details.push({
      message: `ألوان الفرق المتاحة غير كافية (${teams.availableColors.length} من ${TEAM_COLORS.length})`,
      severity: 'error',
    });
  }

  if (teams.maxTeams < 2) {
    hasFail = true;
    details.push({
      message: 'الحد الأقصى للفرق يجب أن يكون 2 على الأقل',
      severity: 'error',
    });
  }

  return {
    id: 'teams',
    title: 'إعدادات الفرق صالحة',
    description: 'التحقق من صحة إعدادات الفرق والألوان',
    status: hasFail ? 'fail' : 'pass',
    weight: 10,
    details,
    fix: hasFail
      ? {
          id: 'reset-teams',
          label: 'إعادة الضبط',
          description: 'إعادة إعدادات الفرق إلى القيم الافتراضية',
        }
      : undefined,
  };
}
