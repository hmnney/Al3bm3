import type { AnalysisFlag, ImportSummary, RowAnalysis } from './types';

/**
 * Tally a list of row analyses into the import summary counts.
 * A row can carry multiple flags; each flag is counted independently, while
 * the accepted/rejected/duplicate buckets reflect the row's final status.
 *
 * The new optional tallies (needsManualReview, qualityIssues) are included
 * only when present in the analyses, so the existing summary UI keeps working
 * unchanged.
 */
export function buildSummary(analyses: RowAnalysis[]): ImportSummary {
  const countFlag = (f: AnalysisFlag) =>
    analyses.filter((a) => a.flags.includes(f)).length;

  const summary: ImportSummary = {
    total: analyses.length,
    accepted: analyses.filter((a) => a.status === 'accepted').length,
    rejected: analyses.filter((a) => a.status === 'rejected').length,
    duplicates: analyses.filter((a) => a.status === 'duplicate').length,
    missingAnswers: countFlag('missing-answer'),
    emptyRows: countFlag('empty-row'),
    invalidCategories: countFlag('invalid-category'),
  };

  // New optional tallies — only count when the richer analysis is present.
  const hasManual = analyses.some((a) => a.status === 'needs-manual-review');
  if (hasManual) {
    summary.needsManualReview = analyses.filter(
      (a) => a.status === 'needs-manual-review'
    ).length;
  }
  const hasQuality = analyses.some((a) => a.quality && a.quality.flags.length > 0);
  if (hasQuality) {
    summary.qualityIssues = analyses.filter(
      (a) => a.quality && a.quality.flags.length > 0
    ).length;
  }

  return summary;
}
