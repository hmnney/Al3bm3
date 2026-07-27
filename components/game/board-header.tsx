'use client';

import { cn } from '@/lib/utils';
import type { Team, TeamColor } from '@/lib/types';
import { TEAM_COLOR_MAP } from '@/lib/constants';

interface BoardHeaderProps {
  currentTeam: Team;
  opponentTeam: Team;
  completedCount: number;
  totalCount: number;
  showCounter: boolean;
  className?: string;
}

/**
 * Compact board header: the team whose turn it is (highlighted, right side in
 * RTL), a small progress indicator in the middle, and the opponent (left side).
 */
export function BoardHeader({
  currentTeam,
  opponentTeam,
  completedCount,
  totalCount,
  showCounter,
  className,
}: BoardHeaderProps) {
  const pct = totalCount ? (completedCount / totalCount) * 100 : 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between',
        className
      )}
    >
      <TeamBlock team={currentTeam} color={TEAM_COLOR_MAP[currentTeam.colorId]} active />

      <div className={cn('order-last flex flex-col items-center gap-1.5 lg:order-none', !showCounter && 'invisible lg:invisible')}>
        <span className="text-xs font-semibold text-muted-foreground">
          {completedCount} / {totalCount} سؤال
        </span>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full bg-brand-gradient transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <TeamBlock team={opponentTeam} color={TEAM_COLOR_MAP[opponentTeam.colorId]} />
    </div>
  );
}

function TeamBlock({
  team,
  color,
  active,
}: {
  team: Team;
  color: TeamColor;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border-2 p-2.5 pr-4 transition-all',
        active ? 'glow-primary' : 'border-transparent opacity-70'
      )}
      style={
        active
          ? {
              borderColor: `hsl(${color.hsl})`,
              backgroundColor: `hsl(${color.hsl} / 0.1)`,
            }
          : undefined
      }
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-base font-black text-white',
          color.gradient
        )}
      >
        {team.score}
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-foreground">{team.name}</span>
          {active && (
            <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold text-white">
              الدور الحالي
            </span>
          )}
        </div>
        <span className="text-xs font-medium" style={{ color: `hsl(${color.hsl})` }}>
          {color.name}
        </span>
      </div>
    </div>
  );
}
