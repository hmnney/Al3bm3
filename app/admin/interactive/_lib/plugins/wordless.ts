import type { InteractionPlugin } from '../types';

/**
 * Wordless Plugin — "ولا كلمة". The first plugin built on the Interaction
 * Engine. A player scans a QR to see a secret word on their phone; they must
 * make their teammates guess it without saying the word itself. The laptop
 * screen never reveals the word.
 *
 * This plugin is NOT hardcoded anywhere in the engine — it registers itself
 * like any other plugin.
 */
export const wordlessPlugin: InteractionPlugin = {
  id: 'wordless',
  name: 'ولا كلمة',
  description: 'اللاعب يرى الكلمة السرية على هاتفه بعد مسح QR ويجعل فريقه يخمنها دون ذكرها',
  interactionType: 'qr',
  usesQR: true,
  defaultConfig: () => ({
    singleUse: true,
    expirationSeconds: 120,
    connectionTimeoutSeconds: 60,
    secretContent: 'اكتب الكلمة السرية هنا',
  }),
  configSchema: () => [
    {
      key: 'secretContent',
      label: 'الكلمة السرية',
      type: 'textarea',
      default: 'اكتب الكلمة السرية هنا',
      hint: 'الكلمة التي سيراها اللاعب فقط على هاتفه',
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
    },
    {
      key: 'connectionTimeoutSeconds',
      label: 'انتهاء اتصال اللاعب (ثانية)',
      type: 'number',
      default: 60,
      min: 10,
      max: 600,
    },
  ],
};
