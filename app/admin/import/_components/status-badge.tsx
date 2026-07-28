import { cn } from '@/lib/utils';
import type { AnalysisStatus } from '../_lib/ai/types';

const STATUS_STYLES: Record<
  AnalysisStatus,
  { label: string; cls: string }
> = {
  accepted: { label: 'مقبول', cls: 'bg-success/15 text-success border-success/30' },
  rejected: { label: 'مرفوض', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  duplicate: { label: 'مكرر', cls: 'bg-warning/15 text-warning border-warning/30' },
  'needs-review': { label: 'مراجعة', cls: 'bg-secondary/15 text-secondary border-secondary/30' },
  'needs-manual-review': { label: 'مراجعة يدوية', cls: 'bg-primary/15 text-primary border-primary/30' },
};

export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold',
        s.cls
      )}
    >
      {s.label}
    </span>
  );
}
