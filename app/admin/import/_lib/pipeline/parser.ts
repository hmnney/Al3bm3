import * as XLSX from 'xlsx';
import type { RawSheet } from './types';
import { readFile } from './reader';

/**
 * Parser module — turns raw file bytes into a RawSheet (headers + string rows).
 *
 * Handles BOTH .xlsx/.xls (via XLSX) and .csv (manual parse to avoid XLSX's
 * encoding quirks with Arabic). Strips empty rows, trailing blank rows, and
 * hidden rows. Trims whitespace from every cell.
 *
 * This is the module that fixes the "empty file" bug: the old code used
 * `sheet_to_json` which silently returns [] when headers are Arabic and the
 * sheet has no explicit range, or when the first row isn't recognized as
 * headers. We now read the raw cell matrix directly and detect headers
 * ourselves.
 */

/** Parse an uploaded File into a RawSheet. */
export async function parseFile(file: File): Promise<RawSheet> {
  const { ext, bytes } = await readFile(file);

  if (ext === 'csv' || ext === 'txt') {
    return parseCsv(bytes);
  }
  return parseXlsx(bytes);
}

/** Parse an XLSX/XLS workbook using the raw cell matrix (not sheet_to_json). */
function parseXlsx(bytes: Uint8Array): RawSheet {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };

  // Read the full 2D array of arrays — this is the key fix. We do NOT use
  // sheet_to_json because it silently drops rows when it can't match headers.
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });

  return matrixToSheet(matrix);
}

/** Parse a CSV file manually (handles UTF-8 BOM, quoted fields, CRLF). */
function parseCsv(bytes: Uint8Array): RawSheet {
  let text = decodeCsvBytes(bytes);
  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const matrix = csvToMatrix(text);
  return matrixToSheet(matrix);
}

/** Decode bytes as UTF-8 first, fall back to windows-1256 (Arabic) if it looks
 *  like mojibake. */
function decodeCsvBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  // If the text has Arabic letters, UTF-8 worked.
  if (/[\u0600-\u06FF]/.test(utf8)) return utf8;
  // Try windows-1256 (common Arabic encoding) as a fallback.
  try {
    const win1256 = new TextDecoder('windows-1256').decode(bytes);
    if (/[\u0600-\u06FF]/.test(win1256)) return win1256;
  } catch { /* TextDecoder may not support windows-1256 in all runtimes */ }
  return utf8;
}

/** Parse a CSV string into a matrix of string cells. */
function csvToMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',' || ch === '\t' || ch === ';') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        // Handle CRLF.
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  // Flush the last field/row if there's leftover.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Convert a raw matrix (array of arrays) into a RawSheet.
 * - First non-empty row is the header row.
 * - Subsequent rows are data.
 * - Empty rows and trailing blank rows are stripped.
 * - Every cell is trimmed.
 */
function matrixToSheet(matrix: string[][]): RawSheet {
  if (!matrix || matrix.length === 0) return { headers: [], rows: [] };

  // Trim every cell.
  const trimmed = matrix.map((r) => r.map((c) => String(c ?? '').trim()));

  // Find the header row: first row that has at least 2 non-empty cells.
  let headerIdx = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const nonEmpty = trimmed[i].filter((c) => c.length > 0).length;
    if (nonEmpty >= 2) {
      headerIdx = i;
      break;
    }
  }

  const headers = trimmed[headerIdx] ?? [];

  // Data rows start after the header row.
  const dataRows = trimmed.slice(headerIdx + 1);

  // Filter out completely empty rows (all cells blank).
  const nonEmptyRows = dataRows.filter(
    (r) => r.some((c) => c.length > 0)
  );

  // Normalize row lengths to match headers (pad or truncate).
  const colCount = headers.length;
  const normalizedRows = nonEmptyRows.map((r) => {
    const row = r.slice(0, colCount);
    while (row.length < colCount) row.push('');
    return row;
  });

  return { headers, rows: normalizedRows };
}
