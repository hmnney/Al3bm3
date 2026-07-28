import type { InteractionPlugin } from '../types';

/**
 * Video plugin — video-based interaction. The player watches a video clip and
 * answers. Configurable video source + controls behavior.
 */
export const videoPlugin: InteractionPlugin = {
  id: 'video-quiz',
  name: 'فيديو',
  description: 'اللاعب يشاهد مقطع فيديو ويجيب',
  interactionType: 'video',
  defaultConfig: () => ({
    videoUrl: '',
    autoplay: true,
    showControls: true,
    muteStart: false,
  }),
  configSchema: () => [
    {
      key: 'videoUrl',
      label: 'رابط الفيديو',
      type: 'text',
      default: '',
      hint: 'رابط الملف أو اسم الملف المحلي',
    },
    {
      key: 'autoplay',
      label: 'تشغيل تلقائي',
      type: 'toggle',
      default: true,
    },
    {
      key: 'showControls',
      label: 'إظهار أدوات التحكم',
      type: 'toggle',
      default: true,
    },
    {
      key: 'muteStart',
      label: 'بدء بدون صوت',
      type: 'toggle',
      default: false,
    },
  ],
};
