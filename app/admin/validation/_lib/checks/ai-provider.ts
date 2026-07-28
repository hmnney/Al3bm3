import { getProviderById, PROVIDER_NEEDS_KEY } from '../../../ai/_lib';
import type { CheckResult, ValidationContext } from '../types';

/**
 * Check: AI provider is connected.
 *
 * Async check — performs a real connection test when a non-mock provider is
 * configured with an API key. Falls back to config validation otherwise.
 * Warning when AI is disabled (not required, but limits features).
 */
export async function checkAIProvider(
  ctx: ValidationContext
): Promise<CheckResult> {
  const { settings } = ctx;
  const ai = settings.ai;
  const details: CheckResult['details'] = [];

  if (!ai.enabled) {
    details.push({
      message: 'الذكاء الاصطناعي غير مفعّل — الميزات المتقدمة محدودة',
      severity: 'warning',
    });
    return {
      id: 'ai-provider',
      title: 'مزود الذكاء الاصطناعي متصل',
      description: 'التحقق من اتصال مزود الذكاء الاصطناعي الحالي',
      status: 'warning',
      weight: 7,
      details,
      fix: {
        id: 'enable-ai-mock',
        label: 'تفعيل Mock AI',
        description: 'تفعيل الذكاء الاصطناعي بمزود Mock للتجربة المحلية',
      },
    };
  }

  if (ai.provider === 'mock') {
    details.push({
      message: 'المزود الحالي هو Mock — يعمل محلياً بدون اتصال شبكي',
      severity: 'info',
    });
    return {
      id: 'ai-provider',
      title: 'مزود الذكاء الاصطناعي متصل',
      description: 'التحقق من اتصال مزود الذكاء الاصطناعي الحالي',
      status: 'pass',
      weight: 7,
      details,
    };
  }

  if (PROVIDER_NEEDS_KEY[ai.provider] && !ai.apiKey.trim()) {
    details.push({
      message: `مزود ${ai.provider} مفعّل لكن بدون مفتاح API`,
      severity: 'error',
    });
    return {
      id: 'ai-provider',
      title: 'مزود الذكاء الاصطناعي متصل',
      description: 'التحقق من اتصال مزود الذكاء الاصطناعي الحالي',
      status: 'fail',
      weight: 7,
      details,
      fix: {
        id: 'go-to-ai-settings',
        label: 'إعدادات الذكاء الاصطناعي',
        description: 'اذهب إلى إعدادات الذكاء الاصطناعي لإضافة مفتاح API',
        navigates: true,
        href: '/admin/settings/ai',
      },
    };
  }

  // Real connection test.
  try {
    const provider = getProviderById(ai.provider);
    const result = await provider.testConnection(ai);
    if (result.ok) {
      details.push({
        message: `الاتصال ناجح مع ${ai.provider}${result.detectedModel ? ` (${result.detectedModel})` : ''}`,
        severity: 'info',
      });
      return {
        id: 'ai-provider',
        title: 'مزود الذكاء الاصطناعي متصل',
        description: 'التحقق من اتصال مزود الذكاء الاصطناعي الحالي',
        status: 'pass',
        weight: 7,
        details,
      };
    }
    details.push({
      message: `فشل الاتصال: ${result.message}`,
      severity: 'error',
    });
    return {
      id: 'ai-provider',
      title: 'مزود الذكاء الاصطناعي متصل',
      description: 'التحقق من اتصال مزود الذكاء الاصطناعي الحالي',
      status: 'fail',
      weight: 7,
      details,
      fix: {
        id: 'go-to-ai-settings',
        label: 'إعدادات الذكاء الاصطناعي',
        description: 'اذهب إلى إعدادات الذكاء الاصطناعي لمراجعة التكوين',
        navigates: true,
        href: '/admin/settings/ai',
      },
    };
  } catch (err) {
    details.push({
      message: `خطأ في الاتصال: ${(err as Error).message || 'غير معروف'}`,
      severity: 'error',
    });
    return {
      id: 'ai-provider',
      title: 'مزود الذكاء الاصطناعي متصل',
      description: 'التحقق من اتصال مزود الذكاء الاصطناعي الحالي',
      status: 'fail',
      weight: 7,
      details,
      fix: {
        id: 'go-to-ai-settings',
        label: 'إعدادات الذكاء الاصطناعي',
        description: 'اذهب إلى إعدادات الذكاء الاصطناعي لمراجعة التكوين',
        navigates: true,
        href: '/admin/settings/ai',
      },
    };
  }
}
