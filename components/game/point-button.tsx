'use client';

import { cn } from '@/lib/utils';
import type { PointValue } from '@/lib/types';

interface PointButtonProps {
  points: PointValue;
  completed: boolean;
  teamHsl: string;
  onClick: () => void;
}

/**
 * A single point-value button on the game board (250 / 500 / 750). When
 * completed it goes gray and disabled. The accent color follows the team it
 * belongs to via an inline HSL string.
 *
 * The click handler is wired here, but the question popup itself is a future
 * feature — for now clicking just marks the slot as completed so the board
 * state is fully exercised.
 */
export function PointButton({
  points,
  completed,
  teamHsl,
  onClick,
}: PointButtonProps) {
  return (
    <button
      type="button"
      disabled={completed}
      onClick={onClick}
      className={cn(
        'group relative flex h-14 w-full items-center justify-center rounded-xl border-2 text-xl font-black transition-all duration-200 sm:h-16 sm:text-2xl',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        completed
          ? 'cursor-not-allowed border-border/40 bg-muted/30 text-muted-foreground/50'
          : 'hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
      )}
      style={
        completed
          ? undefined
          : {
              borderColor: `hsl(${teamHsl} / 0.55)`,
              backgroundColor: `hsl(${teamHsl} / 0.12)`,
              color: `hsl(${teamHsl})`,
            }
      }
      aria-label={`${points} نقطة${completed ? ' — مكتمل' : ''}`}
    >
      <span className="tabular-nums tracking-tight">{points}</span>
      {!completed && (
        <span
          className="absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
          style={{ boxShadow: `0 8px 24px -8px hsl(${teamHsl} / 0.7)` }}
        />
      )}
    </button>
  );
}
