import type { InteractionPlugin, InteractionType } from './types';

/**
 * Interaction Engine — the generic plugin registry.
 *
 * This is the heart of the Interactive Categories system. Plugins register
 * themselves here; the admin UI and the game ask the registry for plugins by
 * id or by interaction type. The engine knows nothing about any specific
 * plugin — "ولا كلمة" is just the first plugin registered.
 *
 * To add a new interaction type or plugin: create a plugin module and
 * register it in `plugins/index.ts`. No engine changes needed.
 */

const plugins = new Map<string, InteractionPlugin>();
const byType = new Map<InteractionType, InteractionPlugin[]>();

/** Register a plugin. Idempotent — re-registering replaces. */
export function registerPlugin(plugin: InteractionPlugin): void {
  plugins.set(plugin.id, plugin);
  const list = byType.get(plugin.interactionType) ?? [];
  const filtered = list.filter((p) => p.id !== plugin.id);
  filtered.push(plugin);
  byType.set(plugin.interactionType, filtered);
}

/** Get a plugin by id, or null. */
export function getPlugin(id: string): InteractionPlugin | null {
  return plugins.get(id) ?? null;
}

/** Get all registered plugins. */
export function getAllPlugins(): InteractionPlugin[] {
  return Array.from(plugins.values());
}

/** Get all plugins for a given interaction type. */
export function getPluginsByType(type: InteractionType): InteractionPlugin[] {
  return byType.get(type) ?? [];
}

/** Whether any plugin is registered for an interaction type. */
export function hasPluginForType(type: InteractionType): boolean {
  return (byType.get(type)?.length ?? 0) > 0;
}

/** Reset the registry (useful for tests / hot reload). */
export function resetRegistry(): void {
  plugins.clear();
  byType.clear();
}
