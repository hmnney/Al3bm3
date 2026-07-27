'use client';

import { cn } from '@/lib/utils';
import type { Team } from '@/lib/types';
import { TEAM_COLOR_MAP } from '@/lib/constants';

interface TeamScoreBadgeProps {
  team: Team;
  side: 'left' | 'right';
  className?: string;
}

/**
 * Compact score badge shown above each team's column on the game board. The
 * `side` prop controls which corner the colored accent sits on so the two
 * badges mirror each other across the board.
 */
export function TeamScoreBadge({ team, side, className }: TeamScoreBadgeProps) {
  const color = TEAM_COLOR_MAP[team.colorId];
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card/70 px-4 py-2 backdrop-blur',
        className
      )}
      style={{ borderColor: `hsl(${color.hsl} / 0.5)` }}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-black text-white shadow',
          color.gradient
        )}
      >
        {team.score}
      </div>
      <div
        className={cn(
          'flex flex-col',
          side === 'left' ? 'items-start text-left' : 'items-end text-right'
        )}
      >
        <span className="max-w-[10rem] truncate text-sm font-bold text-foreground">
          {team.name}
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: `hsl(${color.hsl})` }}
        >
          {color.name}
        </span>
      </div>
    </div>
  );
}
