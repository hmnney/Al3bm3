import type { InteractionPlugin } from '../types';

/**
 * Custom plugin — a blank canvas for future interaction types. The admin
 * provides a custom JSON config; the engine treats it as opaque. New plugins
 * can extend the engine without changing it by registering here first.
 */
export const customPlugin: InteractionPlugin = {
  id: 'custom',
  name: 'مخصص',
  description: 'تفاعل مخصص بإعدادات حرة — للإضافات المستقبلية',
  interactionType: 'custom',
  defaultConfig: () => ({
    customConfig: '',
  }),
  configSchema: () => [
    {
      key: 'customConfig',
      label: 'إعدادات مخصصة (JSON)',
      type: 'textarea',
      default: '',
      hint: 'اكتب الإعدادات بصيغة JSON — يقرأها البرنامج المستقبلي',
    },
  ],
};
