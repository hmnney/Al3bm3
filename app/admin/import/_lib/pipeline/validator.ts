import type { ImportedRow, RowStatus, ValidatedRow } from './types';

/**
 * Validator module — validates each imported row and assigns a status.
 *
 * Checks:
 *  - Missing category
 *  - Missing question
 *  - Missing answer
 *  - Invalid difficulty
 *  - Invalid points
 *  - Duplicate question (within the same batch)
 *  - Broken media URL (malformed, not a valid http(s) URL)
 *  - Unknown category (checked against the provided valid set)
 *
 * Status assignment:
 *  - 'ready'   → no issues
 *  - 'warning' → non-fatal issues (invalid difficulty, broken media URL, duplicate)
 *  - 'error'   → missing required fields (category, question, answer)
 */

/** Set of valid category ids/names that already exist. */
export function validateRows(
  rows: ImportedRow[],
  validCategories: Set<string>
): ValidatedRow[] {
  const seen = new Map<string, number>(); // normalized question → first rowIndex

  return rows.map((row) => {
    const issues: string[] = [];
    let hasError = false;

    // --- Required field checks ---
    if (!row.category.trim()) {
      issues.push('التصنيف مفقود');
      hasError = true;
    }
    if (!row.question.trim()) {
      issues.push('السؤال مفقود');
      hasError = true;
    }
    if (!row.answer.trim()) {
      issues.push('الإجابة مفقودة');
      hasError = true;
    }

    // --- Unknown category ---
    if (row.category.trim() && !validCategories.has(row.category.trim())) {
      issues.push('تصنيف غير معروف');
    }

    // --- Invalid difficulty ---
    if (row.difficulty.trim()) {
      const d = row.difficulty.trim().toLowerCase();
      if (!['easy', 'medium', 'hard', 'سهل', 'متوسط', 'صعب', '1', '2', '3'].includes(d)) {
        issues.push('صعوبة غير صحيحة');
      }
    }

    // --- Invalid points ---
    if (row.points.trim()) {
      const p = Number(row.points.trim());
      if (Number.isNaN(p) || p < 0) {
        issues.push('نقاط غير صحيحة');
      }
    }

    // --- Duplicate question ---
    const normalized = row.question.trim().toLowerCase();
    if (normalized) {
      if (seen.has(normalized)) {
        issues.push('سؤال مكرر');
      } else {
        seen.set(normalized, row.rowIndex);
      }
    }

    // --- Broken media URLs ---
    for (const [field, label] of [
      ['image', 'الصورة'],
      ['video', 'الفيديو'],
      ['audio', 'الصوت'],
    ] as const) {
      const url = row[field].trim();
      if (url && !isValidMediaUrl(url)) {
        issues.push(`رابط ${label} غير صالح`);
      }
    }

    const status: RowStatus = hasError ? 'error' : issues.length > 0 ? 'warning' : 'ready';
    return { row, status, issues };
  });
}

/** A media URL is valid if it's a well-formed http(s) URL. */
function isValidMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
