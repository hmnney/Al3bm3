import { cn } from '@/lib/utils';

interface StepperProps {
  steps: string[];
  current: number; // 0-based index of the active step
}

/**
 * Horizontal wizard stepper. Shows all step labels with numbered circles;
 * completed steps are filled, the active step is highlighted, and future
 * steps are muted. Connectors fill as progress advances.
 */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex w-full items-center gap-1 sm:gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black transition-all sm:h-10 sm:w-10',
                  active &&
                    'border-primary bg-brand-gradient text-white shadow-lg glow-primary',
                  done && 'border-primary bg-primary text-white',
                  !active && !done && 'border-border/60 bg-card/40 text-muted-foreground'
                )}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-center text-xs font-bold sm:block',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors',
                  done ? 'bg-primary' : 'bg-border/40'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
