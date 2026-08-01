import { registerPlugin } from '../registry';
import { normalPlugin } from './normal';
import { qrBasePlugin } from './qr';
import { wordlessPlugin } from './wordless';
import { wordOnlyPlugin } from './word-only';
import { qrWordPlugin } from './qr-word';
import { audioPlugin } from './audio';
import { videoPlugin } from './video';
import { privateScreenPlugin } from './private-screen';
import { customPlugin } from './custom';

/**
 * Plugin registration entry point. Every plugin registers itself with the
 * engine here — the engine never hardcodes any plugin. To add a new
 * interaction type or plugin, create a plugin module and register it here.
 * No engine changes needed.
 */

let registered = false;

export function registerAllPlugins(): void {
  if (registered) return;
  registerPlugin(normalPlugin);
  registerPlugin(qrBasePlugin);
  registerPlugin(wordlessPlugin); // "ولا كلمة" — manual secret word
  registerPlugin(wordOnlyPlugin); // "ولا كلمة" — AI-generated words
  registerPlugin(qrWordPlugin); // "ولا كلمة" — Excel import + QR generation
  registerPlugin(audioPlugin);
  registerPlugin(videoPlugin);
  registerPlugin(privateScreenPlugin);
  registerPlugin(customPlugin);
  registered = true;
}
