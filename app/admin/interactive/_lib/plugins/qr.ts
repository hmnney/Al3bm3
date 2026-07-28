import type { InteractionPlugin } from '../types';

/**
 * QR base plugin — generic QR interaction. Generates a secure one-time QR that
 * a player scans to view private content on their phone. The laptop/game screen
 * never reveals the content.
 */
export const qrBasePlugin: InteractionPlugin = {
  id: 'qr-base',
  name: 'QR عام',
  description: 'رمز QR عام يفتح محتوى خاص على هاتف اللاعب',
  interactionType: 'qr',
  usesQR: true,
  defaultConfig: () => ({
    singleUse: true,
    expirationSeconds: 120,
    connectionTimeoutSeconds: 60,
    secretContent: 'اكتب المحتوى السري هنا',
  }),
  configSchema: () => [
    {
      key: 'secretContent',
      label: 'المحتوى السري',
      type: 'textarea',
      default: 'اكتب المحتوى السري هنا',
      hint: 'يظهر فقط على هاتف اللاعب بعد مسح QR',
    },
    {
      key: 'singleUse',
      label: 'استخدام مرة واحدة',
      type: 'toggle',
      default: true,
      hint: 'كل رمز QR يُمسح مرة واحدة فقط',
    },
    {
      key: 'expirationSeconds',
      label: 'انتهاء صلاحية QR (ثانية)',
      type: 'number',
      default: 120,
      min: 10,
      max: 600,
      hint: 'الوقت قبل انتهاء صلاحية الرمز',
    },
    {
      key: 'connectionTimeoutSeconds',
      label: 'انتهاء اتصال اللاعب (ثانية)',
      type: 'number',
      default: 60,
      min: 10,
      max: 600,
      hint: 'الوقت المسموح به للاعب بعد الاتصال',
    },
  ],
};
