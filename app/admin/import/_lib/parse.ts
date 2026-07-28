import * as XLSX from 'xlsx';
import type { ImportedRow } from './ai/types';

/**
 * File parsing service. Reads an uploaded Excel (.xlsx) or CSV file and
 * normalizes its rows into `ImportedRow[]` for the Import Wizard.
 *
 * Column header matching is forgiving — it accepts both Arabic and English
 * header names and a few common aliases, so admins can upload spreadsheets in
 * either language without reformatting.
 */

/** Accepted header aliases per field (lowercased for matching). */
const HEADER_ALIASES: Record<keyof Omit<ImportedRow, 'rowIndex'>, string[]> = {
  question: ['question', 'السؤال', 'سؤال', 'text', 'النص'],
  answer: ['answer', 'الإجابة', 'إجابة', 'جواب', 'الجواب'],
  category: ['category', 'التصنيف', 'تصنيف', 'categoryid', 'category_id'],
  difficulty: ['difficulty', 'الصعوبة', 'صعوبة', 'level', 'المستوى'],
};

function findHeader(
  headers: string[],
  field: keyof Omit<ImportedRow, 'rowIndex'>
): string | undefined {
  const aliases = HEADER_ALIASES[field];
  return headers.find((h) => aliases.includes(h.trim().toLowerCase()));
}

/**
 * Parse an uploaded file into normalized rows. Accepts .xlsx, .xls, and .csv.
 * Never throws on a single bad row — it produces an empty-string row instead,
 * which the AI analyzer then flags. Throws only on unreadable file format.
 */
export async function parseFile(file: File): Promise<ImportedRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (json.length === 0) return [];

  const headers = Object.keys(json[0]);
  const qCol = findHeader(headers, 'question');
  const aCol = findHeader(headers, 'answer');
  const cCol = findHeader(headers, 'category');
  const dCol = findHeader(headers, 'difficulty');

  return json.map((obj, i) => {
    const cell = (col?: string) =>
      col ? String(obj[col] ?? '').trim() : '';
    return {
      rowIndex: i,
      question: cell(qCol),
      answer: cell(aCol),
      category: cell(cCol),
      difficulty: cell(dCol),
    };
  });
}

/** Build a small CSV string of the reviewed/accepted rows for a download fallback. */
export function rowsToCsv(rows: ImportedRow[]): string {
  const header = 'question,answer,category,difficulty\n';
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const body = rows
    .map((r) =>
      [r.question, r.answer, r.category, r.difficulty]
        .map(escape)
        .join(',')
    )
    .join('\n');
  return header + body;
}
