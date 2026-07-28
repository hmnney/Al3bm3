import { cn } from '@/lib/utils';
import type { QuestionDifficulty } from '@/lib/types';
import type { MediaType } from '../_lib/types';

const DIFFICULTY_STYLES: Record<QuestionDifficulty, { label: string; cls: string }> = {
  easy: { label: 'سهل', cls: 'bg-success/15 text-success border-success/30' },
  medium: { label: 'متوسط', cls: 'bg-warning/15 text-warning border-warning/30' },
  hard: { label: 'صعب', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export function DifficultyBadge({ difficulty }: { difficulty: QuestionDifficulty }) {
  const d = DIFFICULTY_STYLES[difficulty];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold',
        d.cls
      )}
    >
      {d.label}
    </span>
  );
}

const MEDIA_STYLES: Record<MediaType, { label: string; cls: string }> = {
  image: { label: 'صورة', cls: 'bg-secondary/15 text-secondary border-secondary/30' },
  audio: { label: 'صوت', cls: 'bg-primary/15 text-primary border-primary/30' },
  video: { label: 'فيديو', cls: 'bg-accent/15 text-accent border-accent/30' },
  none: { label: 'بدون', cls: 'bg-muted/40 text-muted-foreground border-border/50' },
};

export function MediaBadge({ type }: { type: MediaType }) {
  const m = MEDIA_STYLES[type];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold',
        m.cls
      )}
    >
      {m.label}
    </span>
  );
}
