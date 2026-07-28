/**
 * Legacy parse module — now re-exports from the modular pipeline.
 *
 * The original `parseFile` lived here and used `sheet_to_json`, which silently
 * returned [] for Arabic-header sheets. The new pipeline (parser.ts) reads the
 * raw cell matrix directly and detects headers itself, fixing the "empty file"
 * bug. This file remains so existing import sites keep working.
 */
export { parseFile, mapRows, detectColumns, validateRows, runImport, formatReport } from './pipeline';
export type {
  ImportedRow,
  RawSheet,
  ColumnMapping,
  ValidatedRow,
  RowStatus,
  ImportReport,
  ImportProgress,
  CategoryResolution,
  CategoryAction,
  ImportKind,
} from './pipeline';

/** Build a small CSV string of the reviewed/accepted rows for a download fallback. */
export function rowsToCsv(rows: import('./pipeline/types').ImportedRow[]): string {
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
