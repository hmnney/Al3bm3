import type { ColumnMapping, ImportedRow, ImportKind, RawSheet } from './types';

/**
 * Mapper module — maps detected headers to known fields and converts raw
 * string rows into `ImportedRow[]`.
 *
 * Header detection is bilingual (Arabic + English) and order-independent: the
 * column order in the file does NOT matter. We match by header name, not by
 * position.
 */

/** Accepted header aliases per field (lowercased for matching). */
const HEADER_ALIASES: Record<keyof ColumnMapping, string[]> = {
  question: ['question', 'السؤال', 'سؤال', 'text', 'النص', 'الكلمة', 'كلمة'],
  answer: ['answer', 'الإجابة', 'إجابة', 'جواب', 'الجواب', 'الإجابه'],
  category: ['category', 'التصنيف', 'تصنيف', 'categoryid', 'category_id', 'الفئة', 'فئة'],
  difficulty: ['difficulty', 'الصعوبة', 'صعوبة', 'level', 'المستوى', 'مستوى'],
  points: ['points', 'النقاط', 'نقاط', 'score', 'الدرجة', 'درجة'],
  image: ['image', 'الصورة', 'صورة', 'photo', 'الصوره', 'picture', 'img', 'url'],
  video: ['video', 'الفيديو', 'فيديو', 'clip', 'مقطع'],
  audio: ['audio', 'الصوت', 'صوت', 'voice', 'الصوت'],
  optionA: ['option_a', 'optiona', 'a', 'الخيار_أ', 'الخيار أ', 'أ'],
  optionB: ['option_b', 'optionb', 'b', 'الخيار_ب', 'الخيار ب', 'ب'],
  optionC: ['option_c', 'optionc', 'c', 'الخيار_ج', 'الخيار ج', 'ج'],
  optionD: ['option_d', 'optiond', 'd', 'الخيار_د', 'الخيار د', 'د'],
  mediaUrl: ['media_url', 'mediaurl', 'media', 'الوسائط', 'رابط_الوسائط', 'رابط الوسائط'],
};

/** Detect which column index maps to each known field. */
export function detectColumns(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const mapping: ColumnMapping = {};

  (Object.keys(HEADER_ALIASES) as (keyof ColumnMapping)[]).forEach((field) => {
    const aliases = HEADER_ALIASES[field];
    const idx = lower.findIndex((h) => aliases.includes(h));
    if (idx >= 0) mapping[field] = idx;
  });

  return mapping;
}

/**
 * Map raw rows into ImportedRow[] using the detected column mapping.
 * If no headers matched at all, fall back to positional mapping
 * (col 0 = question, col 1 = answer, col 2 = category, col 3 = difficulty).
 */
export function mapRows(
  sheet: RawSheet,
  kind: ImportKind = 'questions'
): ImportedRow[] {
  const { headers, rows } = sheet;
  if (rows.length === 0) return [];

  let mapping = detectColumns(headers);

  // Fallback: if NO known headers were detected, use positional mapping.
  const detected = Object.values(mapping).filter((v) => v !== undefined).length;
  if (detected === 0) {
    mapping = {
      question: 0,
      answer: 1,
      category: 2,
      difficulty: 3,
      points: 4,
      image: 5,
      video: 6,
      audio: 7,
    };
  }

  return rows.map((cells, i) => {
    const cell = (idx?: number) =>
      idx !== undefined && idx < cells.length ? cells[idx].trim() : '';
    return {
      rowIndex: i,
      question: cell(mapping.question),
      answer: cell(mapping.answer),
      category: cell(mapping.category),
      difficulty: cell(mapping.difficulty),
      points: cell(mapping.points),
      image: cell(mapping.image),
      video: cell(mapping.video),
      audio: cell(mapping.audio),
      optionA: cell(mapping.optionA),
      optionB: cell(mapping.optionB),
      optionC: cell(mapping.optionC),
      optionD: cell(mapping.optionD),
      mediaUrl: cell(mapping.mediaUrl),
    };
  });
}
