import type { AIProvider, AIProviderConfig, AIProviderId } from './types';
import { PROVIDER_DEFAULT_MODELS } from './types';
import { MockAIProvider } from './providers/mock';
import { GeminiProvider } from './providers/gemini';
import { OpenRouterProvider } from './providers/openrouter';
import { GroqProvider } from './providers/groq';

/**
 * AI Provider Factory — the ONLY entry point to AI in the entire project.
 *
 * The project NEVER imports Gemini (or any provider) directly. Every call
 * flows through this factory:
 *
 *   Game / Admin UI
 *     ↓
 *   getAIProvider()  ← this factory
 *     ↓
 *   Selected AI Provider
 *
 * To add a new provider: create a class implementing `AIProvider`, add its id
 * to `AIProviderId`, and register it in the `PROVIDERS` map below. No other
 * code in the project changes.
 */

const PROVIDERS: Record<AIProviderId, AIProvider> = {
  mock: new MockAIProvider(),
  gemini: new GeminiProvider(),
  openrouter: new OpenRouterProvider(),
  groq: new GroqProvider(),
};

/**
 * Get the active AI provider for the given config. When AI is disabled, always
 * returns the Mock provider so the app never breaks and never makes network
 * calls.
 */
export function getAIProvider(config: AIProviderConfig): AIProvider {
  if (!config.enabled) return PROVIDERS.mock;
  return PROVIDERS[config.provider] ?? PROVIDERS.mock;
}

/** Get a specific provider by id (used by the settings UI for "Test Connection"). */
export function getProviderById(id: AIProviderId): AIProvider {
  return PROVIDERS[id] ?? PROVIDERS.mock;
}

/** List all available providers (for the settings dropdown). */
export function listProviders(): AIProvider[] {
  return Object.values(PROVIDERS);
}

/** Build the default config for a provider switch. */
export function defaultConfigForProvider(id: AIProviderId): Partial<AIProviderConfig> {
  return {
    provider: id,
    model: PROVIDER_DEFAULT_MODELS[id],
    apiKey: '',
  };
}

// Public surface of the AI package.
export type {
  AIProvider,
  AIProviderConfig,
  AIProviderId,
  AIQuestion,
  AnalyzeRequest,
  AnalyzeResult,
  ClassifyRequest,
  ClassifyResult,
  CoachRequest,
  CoachResult,
  DiagnosticsRequest,
  DiagnosticsResult,
  GenerateRequest,
  GenerateWordsRequest,
  GenerateWordsResult,
  ImproveRequest,
  ImproveResult,
  ModelInfo,
} from './types';
export {
  PROVIDER_LABELS,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_NEEDS_KEY,
} from './types';
