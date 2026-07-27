import { cn } from '@/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared outer wrapper for every game page. Provides consistent max-width,
 * vertical padding, vertical centering on tall screens (good for TV), and the
 * fade-up entrance animation. Put a <SectionHeader/> or page content inside.
 */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 sm:px-8 sm:py-12 animate-fade-up',
        className
      )}
    >
      {children}
    </div>
  );
}
