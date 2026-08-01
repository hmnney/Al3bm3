/**
 * Excel import + template generation for the "ولا كلمة" (charades) category.
 *
 * Excel format:
 *   | word | points |
 *   Harry Potter | 250
 *   Spider-Man   | 250
 *   Football     | 500
 *   Lion         | 750
 *
 * Validation:
 *   - Skip empty rows (blank word)
 *   - Skip duplicate words (case-insensitive)
 *   - Ignore extra columns
 *   - Points must be 250, 500, or 750 (defaults to 250 if missing/invalid)
 */

import * as XLSX from 'xlsx';
import type { PointValue } from './types';

export interface CharadesRow {
  word: string;
  points: PointValue;
}

export interface ExcelParseResult {
  rows: CharadesRow[];
  totalRows: number;
  skippedEmpty: number;
  skippedDuplicates: number;
}

const VALID_POINTS: PointValue[] = [250, 500, 750];

function normalizePoints(raw: unknown): PointValue {
  if (typeof raw === 'number' && VALID_POINTS.includes(raw as PointValue)) {
    return raw as PointValue;
  }
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    if (VALID_POINTS.includes(n as PointValue)) return n as PointValue;
  }
  return 250;
}

/**
 * Parse an .xlsx File into validated charades rows.
 * - Skips empty rows
 * - Skips duplicate words (case-insensitive)
 * - Ignores extra columns
 */
export async function parseCharadesExcel(file: File): Promise<ExcelParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    return { rows: [], totalRows: 0, skippedEmpty: 0, skippedDuplicates: 0 };
  }

  // Read as array-of-arrays so we can find columns by header name
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  });

  if (raw.length === 0) {
    return { rows: [], totalRows: 0, skippedEmpty: 0, skippedDuplicates: 0 };
  }

  // Find the header row — look for a row containing "word"
  let headerIdx = 0;
  let wordCol = 0;
  let pointsCol = 1;
  let headerFound = false;

  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const row = raw[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').toLowerCase().trim();
      if (cell === 'word' || cell === 'كلمة' || cell === 'الword') {
        headerIdx = i;
        wordCol = j;
        headerFound = true;
        // Find points column in the same header row
        for (let k = 0; k < row.length; k++) {
          const c = String(row[k] ?? '').toLowerCase().trim();
          if (c === 'points' || c === 'نقاط' || c === 'النقاط') {
            pointsCol = k;
            break;
          }
        }
        break;
      }
    }
    if (headerFound) break;
  }

  const dataStart = headerFound ? headerIdx + 1 : 0;
  const rows: CharadesRow[] = [];
  const seen = new Set<string>();
  let skippedEmpty = 0;
  let skippedDuplicates = 0;
  let totalRows = 0;

  for (let i = dataStart; i < raw.length; i++) {
    const row = raw[i];
    if (!row) continue;

    const wordRaw = row[wordCol];
    const word = String(wordRaw ?? '').trim();

    if (!word) {
      skippedEmpty++;
      continue;
    }

    totalRows++;

    const key = word.toLowerCase();
    if (seen.has(key)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(key);

    const points = normalizePoints(row[pointsCol]);
    rows.push({ word, points });
  }

  return { rows, totalRows, skippedEmpty, skippedDuplicates };
}

/**
 * Generate a downloadable Excel template with exactly:
 *   | word | points |
 * Nothing else.
 */
export function downloadCharadesTemplate(): void {
  const data = [
    ['word', 'points'],
    ['Harry Potter', 250],
    ['Spider-Man', 250],
    ['Football', 500],
    ['Lion', 750],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 24 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Charades');

  XLSX.writeFile(wb, 'charades-template.xlsx');
}

/**
 * Generate a downloadable Excel template with ALL supported columns:
 *   | category | points | question | option_a | option_b | option_c | option_d | answer | image | video | audio |
 *
 * Includes example rows for both normal and multiple-choice questions.
 */
export function downloadFullQuestionTemplate(): void {
  const headers = [
    'category',
    'points',
    'question',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'answer',
    'image',
    'video',
    'audio',
  ];

  const exampleNormal: string[] = [
    'conan',
    '250',
    'من هو بطل كونان البوليسي؟',
    '', '', '', '',
    'كونان إدوغاوا',
    '', '', '',
  ];

  const exampleMC: string[] = [
    'football',
    '500',
    'كم عدد لاعبي فريق كرة القدم في الملعب؟',
    '9 لاعبين',
    '10 لاعبين',
    '11 لاعباً',
    '12 لاعباً',
    '11 لاعباً',
    '', '', '',
  ];

  const exampleImage: string[] = [
    'movie-posters',
    '750',
    'ما اسم هذا الفيلم؟',
    '', '', '', '',
    'Inception',
    'https://example.com/poster.jpg',
    '', '',
  ];

  const data = [headers, exampleNormal, exampleMC, exampleImage];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 16 },
    { wch: 8 },
    { wch: 30 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');

  XLSX.writeFile(wb, 'questions-template.xlsx');
}
