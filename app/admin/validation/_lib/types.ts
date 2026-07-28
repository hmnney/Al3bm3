import type { AdminCategory, AdminQuestion } from '../../_lib/types';
import type { AllSettings } from '../../_lib/settings-types';
import type { InteractiveCategory, QRSession } from '../../interactive/_lib/types';

/**
 * Game Validation Mode — shared types.
 *
 * Completely isolated from the rest of the admin panel. The validation engine
 * is a collection of pure check functions that receive a `ValidationContext`
 * (a snapshot of all game state) and return a `CheckResult`. The runner
 * orchestrates them and computes a readiness score.
 *
 * To add a new check: create a function `(ctx) => CheckResult` (or
 * `Promise<CheckResult>`), register it in `runner.ts`. No other code changes.
 * Future plugins (Images, Audio, Posters, Video) add their own checks the
 * same way.
 */

export type CheckStatus = 'pass' | 'fail' | 'warning';

export interface CheckDetail {
  message: string;
  severity: 'error' | 'warning' | 'info';
  categoryId?: string;
  categoryName?: string;
}

export interface FixAction {
  id: string;
  label: string;
  description: string;
  /** If true, the fix navigates to another page instead of applying inline. */
  navigates?: boolean;
  href?: string;
}

export interface CheckResult {
  id: string;
  title: string;
  description: string;
  status: CheckStatus;
  weight: number;
  details: CheckDetail[];
  fix?: FixAction;
}

export type ReadinessLevel = 'green' | 'yellow' | 'red';

export interface ValidationReport {
  score: number;
  level: ReadinessLevel;
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  checks: CheckResult[];
  runAt: number;
}

export interface ValidationContext {
  categories: AdminCategory[];
  questions: AdminQuestion[];
  settings: AllSettings;
  interactiveCategories: InteractiveCategory[];
  sessions: QRSession[];
}

export type CheckFn = (
  ctx: ValidationContext
) => CheckResult | Promise<CheckResult>;

/** Thresholds — centralized so they can be tuned without touching checks. */
export const THRESHOLDS = {
  MIN_QUESTIONS_PER_CATEGORY: 5,
  MIN_ANSWER_LENGTH: 2,
  GREEN_THRESHOLD: 80,
  YELLOW_THRESHOLD: 50,
} as const;
