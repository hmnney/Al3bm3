import type {
  CheckFn,
  CheckResult,
  ReadinessLevel,
  ValidationContext,
  ValidationReport,
} from './types';
import { THRESHOLDS } from './types';
import {
  checkCategoryQuestions,
  checkPointCoverage,
  checkDuplicates,
  checkEmptyAnswers,
  checkInteractiveData,
  checkQRSessions,
  checkAIProvider,
  checkImportPipeline,
  checkGameSettings,
  checkTimer,
  checkTeams,
} from './checks';

/**
 * Game Validation Mode — runner.
 *
 * Orchestrates all registered checks, runs them in sequence, and computes a
 * weighted readiness score. Each check carries a `weight` (summing to 100);
 * the score is the sum of weights of passing checks, with warnings counting
 * at 50%.
 *
 * To add a new check: create a function `(ctx) => CheckResult` (or
 * `Promise<CheckResult>`), add it to `CHECKS`, and assign a weight. No other
 * code changes. Future plugins add their own checks the same way.
 */

const CHECKS: Array<{ fn: CheckFn; weight: number }> = [
  { fn: checkCategoryQuestions, weight: 15 },
  { fn: checkPointCoverage, weight: 15 },
  { fn: checkDuplicates, weight: 10 },
  { fn: checkEmptyAnswers, weight: 10 },
  { fn: checkInteractiveData, weight: 8 },
  { fn: checkQRSessions, weight: 5 },
  { fn: checkAIProvider, weight: 7 },
  { fn: checkImportPipeline, weight: 5 },
  { fn: checkGameSettings, weight: 10 },
  { fn: checkTimer, weight: 5 },
  { fn: checkTeams, weight: 10 },
];

export async function runValidation(
  ctx: ValidationContext
): Promise<ValidationReport> {
  const checks: CheckResult[] = [];

  for (const { fn, weight } of CHECKS) {
    try {
      const result = await fn(ctx);
      // Ensure weight from registration overrides any in-check weight.
      checks.push({ ...result, weight });
    } catch (err) {
      checks.push({
        id: 'runtime-error',
        title: 'خطأ في التحقق',
        description: `فشل غير متوقع: ${(err as Error).message || 'غير معروف'}`,
        status: 'fail',
        weight,
        details: [],
      });
    }
  }

  const score = computeScore(checks);
  const level = readinessLevel(score);
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warning').length;

  return {
    score,
    level,
    total: checks.length,
    passed,
    failed,
    warnings,
    checks,
    runAt: Date.now(),
  };
}

function computeScore(checks: CheckResult[]): number {
  let earned = 0;
  for (const c of checks) {
    if (c.status === 'pass') earned += c.weight;
    else if (c.status === 'warning') earned += c.weight * 0.5;
  }
  return Math.round(earned);
}

export function readinessLevel(score: number): ReadinessLevel {
  if (score >= THRESHOLDS.GREEN_THRESHOLD) return 'green';
  if (score >= THRESHOLDS.YELLOW_THRESHOLD) return 'yellow';
  return 'red';
}
