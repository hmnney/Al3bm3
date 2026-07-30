import type { ImportedRow, RowStatus, ValidatedRow } from './types';

/**
 * Validator module — validates each imported row and assigns a status.
 *
 * FATAL errors (row is excluded from import) — ONLY these:
 *  - Missing question
 *  - Missing answer
 *  - Invalid points (not 250, 500, or 750 when present)
 *
 * WARNINGS (row is still imported):
 *  - Missing category (AI enrichment or auto-create will handle it)
 *  - Unknown category (will be auto-created)
 *  - Invalid difficulty (defaults to medium)
 *  - Duplicate question (still imported)
 *  - Broken media URL (media skipped, question imported)
 *  - Unsupported media extension (media skipped, question imported)
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

    // --- FATAL: Missing question ---
    if (!row.question.trim()) {
      issues.push('السؤال مفقود');
      hasError = true;
    }

    // --- FATAL: Missing answer ---
    if (!row.answer.trim()) {
      issues.push('الإجابة مفقودة');
      hasError = true;
    }

    // --- FATAL: Invalid points (must be 250, 500, or 750 if present) ---
    if (row.points.trim()) {
      const p = Number(row.points.trim());
      if (Number.isNaN(p) || ![250, 500, 750].includes(p)) {
        issues.push('نقاط غير صحيحة (يجب أن تكون 250 أو 500 أو 750)');
        hasError = true;
      }
    }

    // --- WARNING: Missing category (AI enrichment or auto-create handles it) ---
    if (!row.category.trim()) {
      issues.push('التصنيف مفقود (سيُنشأ تلقائياً)');
    }

    // --- WARNING: Unknown category (will be auto-created) ---
    if (row.category.trim() && !validCategories.has(row.category.trim())) {
      issues.push('تصنيف غير معروف (سيُنشأ تلقائياً)');
    }

    // --- WARNING: Invalid difficulty (defaults to medium) ---
    if (row.difficulty.trim()) {
      const d = row.difficulty.trim().toLowerCase();
      if (!['easy', 'medium', 'hard', 'سهل', 'متوسط', 'صعب', '1', '2', '3'].includes(d)) {
        issues.push('صعوبة غير صحيحة (ستُعتبر متوسطة)');
      }
    }

    // --- WARNING: Duplicate question (still imported) ---
    const normalized = row.question.trim().toLowerCase();
    if (normalized) {
      if (seen.has(normalized)) {
        issues.push('سؤال مكرر');
      } else {
        seen.set(normalized, row.rowIndex);
      }
    }

    // --- WARNING: Broken media URLs (media skipped, question still imported) ---
    for (const [field, label] of [
      ['image', 'الصورة'],
      ['video', 'الفيديو'],
      ['audio', 'الصوت'],
    ] as const) {
      const url = row[field].trim();
      if (url) {
        if (!isValidMediaUrl(url)) {
          issues.push(`رابط ${label} غير صالح (سيُتجاهل)`);
        } else if (!isValidMediaExtension(url, field)) {
          issues.push(`امتداد ${label} غير مدعوم (سيُتجاهل)`);
        }
      }
    }

    const status: RowStatus = hasError ? 'error' : issues.length > 0 ? 'warning' : 'ready';
    return { row, status, issues };
  });
}

/** A media URL is valid if it's a well-formed http(s) or data: URL. */
function isValidMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'data:';
  } catch {
    return false;
  }
}

/** Valid file extensions per media type. */
const VALID_EXTENSIONS: Record<'image' | 'video' | 'audio', string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp'],
  video: ['mp4', 'webm', 'ogg', 'mov', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a'],
};

/** Check if a media URL has a valid extension for its type. */
function isValidMediaExtension(url: string, type: 'image' | 'video' | 'audio'): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'data:') {
      const mime = url.slice(0, url.indexOf(','));
      return VALID_EXTENSIONS[type].some((ext) => mime.includes(`/${ext}`));
    }
    const pathname = u.pathname.toLowerCase();
    if (VALID_EXTENSIONS[type].some((ext) => pathname.endsWith('.' + ext))) {
      return true;
    }
    // For video and audio, accept any http(s) URL even without a recognized
    // extension — many CDN/streaming URLs have no file extension.
    if (type === 'video' || type === 'audio') {
      return u.protocol === 'http:' || u.protocol === 'https:';
    }
    return false;
  } catch {
    return false;
  }
}
