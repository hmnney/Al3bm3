import type { InteractionPlugin } from '../types';

/**
 * Normal plugin — standard question/answer interaction. No special config.
 */
export const normalPlugin: InteractionPlugin = {
  id: 'normal-base',
  name: 'عادي',
  description: 'سؤال وجواب تقليدي بدون تفاعل خاص',
  interactionType: 'normal',
  defaultConfig: () => ({}),
  configSchema: () => [],
};
