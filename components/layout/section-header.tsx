import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  step?: number;
  totalSteps?: number;
  className?: string;
}

/**
 * Reusable page header used at the top of every game-setup page. Shows an
 * optional step indicator (e.g. "خطوة 2 من 4") to orient players through the
 * Home → Teams → Categories → Board flow.
 */
export function SectionHeader({
  title,
  subtitle,
  step,
  totalSteps,
  className,
}: SectionHeaderProps) {
  return (
    <header className={cn('flex flex-col items-center text-center', className)}>
      {typeof step === 'number' && typeof totalSteps === 'number' && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          <span>خطوة {step} من {totalSteps}</span>
        </div>
      )}
      <h1 className="bg-gradient-to-l from-primary via-primary-glow to-secondary bg-clip-text text-4xl font-black leading-tight text-transparent sm:text-5xl md:text-6xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {subtitle}
        </p>
      )}
    </header>
  );
}
