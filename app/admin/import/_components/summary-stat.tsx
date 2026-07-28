import { cn } from '@/lib/utils';

interface SummaryStatProps {
  label: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  className?: string;
}

/** Stat card for the import summary screen. Mirrors the dashboard StatCard. */
export function SummaryStat({
  label,
  value,
  icon: Icon,
  gradient,
  className,
}: SummaryStatProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 border-border/50 bg-card/50 p-5 backdrop-blur transition-all hover:border-primary/40 hover:shadow-xl',
        className
      )}
    >
      <div
        className={cn(
          'absolute -left-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity group-hover:opacity-40',
          gradient
        )}
      />
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg',
            gradient
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-black tabular-nums text-foreground sm:text-3xl">
            {value.toLocaleString('ar-EG')}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
