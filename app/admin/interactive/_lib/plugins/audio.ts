import type { InteractionPlugin } from '../types';

/**
 * Audio plugin — audio-based interaction. The player listens to an audio clip
 * and answers. Configurable audio source + autoplay behavior.
 */
export const audioPlugin: InteractionPlugin = {
  id: 'audio-quiz',
  name: 'صوت',
  description: 'اللاعب يستمع إلى مقطع صوتي ويجيب',
  interactionType: 'audio',
  defaultConfig: () => ({
    audioUrl: '',
    autoplay: true,
    loop: false,
  }),
  configSchema: () => [
    {
      key: 'audioUrl',
      label: 'رابط المقطع الصوتي',
      type: 'text',
      default: '',
      hint: 'رابط الملف الصوتي أو اسم الملف المحلي',
    },
    {
      key: 'autoplay',
      label: 'تشغيل تلقائي',
      type: 'toggle',
      default: true,
    },
    {
      key: 'loop',
      label: 'تكرار',
      type: 'toggle',
      default: false,
    },
  ],
};
