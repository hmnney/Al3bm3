export { registerAllPlugins } from './plugins';
export {
  getPlugin,
  getAllPlugins,
  getPluginsByType,
  hasPluginForType,
} from './registry';
export { useInteractive, InteractiveProvider } from './interactive-context';
export { statusLabel } from './qr-session-manager';
export type {
  InteractionPlugin,
  InteractionType,
  InteractiveCategory,
  PluginConfig,
  PluginConfigField,
  PluginConfigSchema,
  PluginDataset,
  QRSession,
  QRSessionStatus,
} from './types';
export {
  INTERACTION_TYPE_LABELS,
  INTERACTION_TYPE_ICONS,
} from './types';
