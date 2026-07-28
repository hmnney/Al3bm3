import type { InteractionPlugin } from '../types';

/**
 * Private Screen plugin — content shown only on the player's device, not on the
 * shared game screen. Can use QR or a direct link. Configurable delivery method
 * + reveal duration.
 */
export const privateScreenPlugin: InteractionPlugin = {
  id: 'private-screen',
  name: 'شاشة خاصة',
  description: 'المحتوى يظهر على هاتف اللاعب فقط عبر رابط أو QR',
  interactionType: 'private-screen',
  usesQR: true,
  defaultConfig: () => ({
    deliveryMethod: 'qr',
    revealDurationSeconds: 30,
    secretContent: 'اكتب المحتوى الخاص هنا',
  }),
  configSchema: () => [
    {
      key: 'secretContent',
      label: 'المحتوى الخاص',
      type: 'textarea',
      default: 'اكتب المحتوى الخاص هنا',
    },
    {
      key: 'deliveryMethod',
      label: 'طريقة العرض',
      type: 'select',
      default: 'qr',
      options: [
        { value: 'qr', label: 'QR' },
        { value: 'link', label: 'رابط مباشر' },
      ],
    },
    {
      key: 'revealDurationSeconds',
      label: 'مدة العرض (ثانية)',
      type: 'number',
      default: 30,
      min: 5,
      max: 300,
    },
  ],
};
