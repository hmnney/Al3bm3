import type { AllSettings } from '../../_lib/settings-types';
import { defaultSettings } from '../../_lib/settings-store';
import type { InteractiveCategory, PluginDataset } from '../../interactive/_lib/types';
import type { ValidationContext } from './types';
import { getDuplicateQuestionIds } from './checks/duplicates';
import { getEmptyAnswerQuestionIds } from './checks/empty-answers';

/**
 * Game Validation Mode — one-click fixes.
 *
 * Each fix function receives the current `ValidationContext` and the relevant
 * mutation callbacks, applies the fix, and returns a short description of
 * what changed. The UI layer wires these to the admin/interactive/settings
 * contexts.
 *
 * Fixes are intentionally granular — one function per `FixAction.id`. Adding
 * a new fix means adding a function and a case in `applyFix`. No other code
 * changes.
 */

export interface FixCallbacks {
  deleteQuestions: (ids: string[]) => void;
  updateSettings: (patch: Partial<AllSettings>) => void;
  updateInteractiveCategory: (id: string, patch: Partial<InteractiveCategory>) => void;
  createQRSession: (input: {
    categoryId: string;
    secretContent: string;
    singleUse: boolean;
    expirationSeconds: number;
    connectionTimeoutSeconds: number;
  }) => void;
}

export interface FixResult {
  applied: boolean;
  message: string;
}

export async function applyFix(
  fixId: string,
  ctx: ValidationContext,
  callbacks: FixCallbacks
): Promise<FixResult> {
  switch (fixId) {
    case 'delete-duplicates': {
      const ids = getDuplicateQuestionIds(ctx);
      if (ids.length === 0) return { applied: false, message: 'لا توجد تكرارات' };
      callbacks.deleteQuestions(ids);
      return { applied: true, message: `تم حذف ${ids.length} سؤالاً مكرراً` };
    }
    case 'delete-empty-answers': {
      const ids = getEmptyAnswerQuestionIds(ctx);
      if (ids.length === 0) return { applied: false, message: 'لا توجد أسئلة بلا إجابة' };
      callbacks.deleteQuestions(ids);
      return { applied: true, message: `تم حذف ${ids.length} سؤالاً بدون إجابة` };
    }
    case 'reset-game-settings': {
      const defaults = defaultSettings();
      callbacks.updateSettings({ game: defaults.game });
      return { applied: true, message: 'تمت إعادة إعدادات اللعبة إلى الافتراضية' };
    }
    case 'reset-timer': {
      const defaults = defaultSettings();
      callbacks.updateSettings({ timer: defaults.timer });
      return { applied: true, message: 'تمت إعادة إعدادات المؤقت إلى الافتراضية' };
    }
    case 'reset-teams': {
      const defaults = defaultSettings();
      callbacks.updateSettings({ teams: defaults.teams });
      return { applied: true, message: 'تمت إعادة إعدادات الفرق إلى الافتراضية' };
    }
    case 'enable-ai-mock': {
      callbacks.updateSettings({
        ai: { ...ctx.settings.ai, enabled: true, provider: 'mock' },
      });
      return { applied: true, message: 'تم تفعيل مزود Mock AI' };
    }
    case 'seed-interactive-data': {
      let count = 0;
      for (const cat of ctx.interactiveCategories) {
        if (!cat.enabled) continue;
        if (!cat.dataset || datasetItemCount(cat.dataset) === 0) {
          const ds = seedMockDataset(cat);
          callbacks.updateInteractiveCategory(cat.id, { dataset: ds });
          count++;
        }
      }
      return {
        applied: count > 0,
        message: count > 0
          ? `تمت تعبئة ${count} تصنيف تفاعلي ببيانات تجريبية`
          : 'لا توجد تصنيفات تفاعلية فارغة',
      };
    }
    case 'create-test-qr-session': {
      let count = 0;
      for (const cat of ctx.interactiveCategories) {
        if (!cat.enabled || cat.interactionType !== 'qr') continue;
        const content = String(cat.config.secretContent ?? '').trim();
        if (!content) {
          callbacks.updateInteractiveCategory(cat.id, {
            config: { ...cat.config, secretContent: 'كلمة سرية تجريبية' },
          });
        }
        const expiration = Number(cat.config.expirationSeconds ?? 0);
        const timeout = Number(cat.config.connectionTimeoutSeconds ?? 0);
        if (expiration <= 0 || timeout <= 0) {
          callbacks.updateInteractiveCategory(cat.id, {
            config: {
              ...cat.config,
              expirationSeconds: expiration > 0 ? expiration : 120,
              connectionTimeoutSeconds: timeout > 0 ? timeout : 60,
            },
          });
        }
        callbacks.createQRSession({
          categoryId: cat.id,
          secretContent: content || 'كلمة سرية تجريبية',
          singleUse: Boolean(cat.config.singleUse),
          expirationSeconds: expiration > 0 ? expiration : 120,
          connectionTimeoutSeconds: timeout > 0 ? timeout : 60,
        });
        count++;
      }
      return {
        applied: count > 0,
        message: count > 0
          ? `تم إنشاء ${count} جلسة QR تجريبية`
          : 'لا توجد تصنيفات QR تحتاج إصلاحاً',
      };
    }
    default:
      return { applied: false, message: 'إصلاح غير معروف' };
  }
}

function datasetItemCount(ds: PluginDataset | undefined): number {
  if (!ds) return 0;
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

function seedMockDataset(cat: InteractiveCategory): PluginDataset {
  // Word-only is the only plugin with a mock dataset shape today.
  // Future plugins extend this switch.
  switch (cat.pluginId) {
    case 'wordless':
    default:
      return {
        kind: 'word-only',
        words: ['كلمة تجريبية ١', 'كلمة تجريبية ٢', 'كلمة تجريبية ٣'],
        usedWords: [],
      };
  }
}
