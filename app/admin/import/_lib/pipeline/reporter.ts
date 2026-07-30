import type { ImportReport } from './types';

/**
 * Reporter module — formats the final import report for the UI.
 *
 * Isolated: takes the raw `ImportReport` counts and returns display-ready
 * Arabic labels and stat items. The UI renders these without knowing how the
 * counts were computed.
 */

export interface ReportStat {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export function formatReport(report: ImportReport): ReportStat[] {
  return [
    { label: 'مستورد', value: report.imported, tone: 'success' },
    { label: 'صور مستوردة', value: report.importedImages, tone: 'info' },
    { label: 'فيديوهات مستوردة', value: report.importedVideos, tone: 'info' },
    { label: 'ملفات صوتية مستوردة', value: report.importedAudio, tone: 'info' },
    { label: 'وسائط متخطّاة', value: report.skippedMedia, tone: 'warning' },
    { label: 'متخطّى', value: report.skipped, tone: 'neutral' },
    { label: 'مكررات', value: report.duplicates, tone: 'warning' },
    { label: 'تحذيرات', value: report.warnings, tone: 'warning' },
    { label: 'أخطاء', value: report.errors, tone: 'error' },
    { label: 'صفوف فاشلة', value: report.failedRows.length, tone: 'error' },
    { label: 'تصنيفات مطابقة', value: report.matchedCategories, tone: 'info' },
    { label: 'تصنيفات جديدة', value: report.newCategories, tone: 'success' },
  ];
}
