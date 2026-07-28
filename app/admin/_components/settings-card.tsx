'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A consistent themed card for each settings group. RTL, purple/dark-blue. */
export function SettingsCard({
  title,
  description,
  icon,
  children,
  className,
}: SettingsCardProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur transition-all duration-300 hover:border-primary/30',
        className
      )}
    >
      <div className="mb-5 flex items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg">
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-black text-foreground">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

interface SettingRowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

/** A labelled setting row: label + hint on one side, control on the other. */
export function SettingRow({ label, hint, children }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/30 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-bold text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="shrink-0 sm:max-w-xs sm:flex-1">{children}</div>
    </div>
  );
}
