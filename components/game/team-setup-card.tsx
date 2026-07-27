'use client';

import { cn } from '@/lib/utils';
import type { Team, TeamColorId } from '@/lib/types';
import { TEAM_COLOR_MAP } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TeamColorPicker } from './team-color-picker';

interface TeamSetupCardProps {
  team: Team;
  index: number;
  otherTeamColorId: TeamColorId;
  onNameChange: (name: string) => void;
  onColorChange: (colorId: TeamColorId) => void;
}

/**
 * One team's configuration panel on the Teams page: a large colored header
 * (driven by the team's chosen color), a name input, and a color picker.
 */
export function TeamSetupCard({
  team,
  index,
  otherTeamColorId,
  onNameChange,
  onColorChange,
}: TeamSetupCardProps) {
  const color = TEAM_COLOR_MAP[team.colorId];

  return (
    <div
      className="flex flex-col gap-5 rounded-2xl border-2 border-border/60 bg-card/60 p-6 backdrop-blur transition-all hover:border-white/10"
      style={{
        boxShadow: `0 12px 40px -16px hsl(${color.hsl} / 0.5)`,
      }}
    >
      {/* Header strip in team color */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-lg font-black text-white shadow-lg',
            color.gradient
          )}
        >
          {index + 1}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            الفريق {index + 1}
          </p>
          <p className="text-sm font-bold" style={{ color: `hsl(${color.hsl})` }}>
            {color.name}
          </p>
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`team-name-${team.id}`} className="text-base">
          اسم الفريق
        </Label>
        <Input
          id={`team-name-${team.id}`}
          value={team.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="اكتب اسم الفريق"
          maxLength={24}
          className="h-12 border-2 bg-background/60 text-lg font-semibold"
          style={{ borderColor: `hsl(${color.hsl} / 0.4)` }}
        />
      </div>

      {/* Color */}
      <div className="flex flex-col gap-2">
        <Label className="text-base">لون الفريق</Label>
        <TeamColorPicker
          value={team.colorId}
          excludeId={otherTeamColorId}
          onChange={onColorChange}
        />
      </div>
    </div>
  );
}
