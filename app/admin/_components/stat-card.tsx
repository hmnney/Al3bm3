import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  /** Tailwind gradient classes for the icon chip, e.g. "from-purple-500 to-violet-600". */
  gradient: string;
  className?: string;
}

/** A single statistic card for the dashboard. */
export function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur transition-all duration-300 hover:border-primary/40 hover:shadow-2xl',
        className
      )}
    >
      {/* Glow accent */}
      <div
        className={cn(
          'absolute -left-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40',
          gradient
        )}
      />

      <div className="relative flex items-center gap-4">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg',
            gradient
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="flex flex-col">
          <span className="text-3xl font-black tabular-nums text-foreground sm:text-4xl">
            {value.toLocaleString('ar-EG')}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
