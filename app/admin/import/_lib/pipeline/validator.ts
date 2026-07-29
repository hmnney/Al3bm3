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
      if (url) {
        if (!isValidMediaUrl(url)) {
          issues.push(`رابط ${label} غير صالح`);
        } else if (!isValidMediaExtension(url, field)) {
          issues.push(`امتداد ${label} غير مدعوم`);
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
    // extension — many CDN/streaming URLs have no file extension. The
    // <video>/<audio> element will attempt playback regardless.
    if (type === 'video' || type === 'audio') {
      return u.protocol === 'http:' || u.protocol === 'https:';
    }
    return false;
  } catch {
    return false;
  }
}
