'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamColor, TeamColorId } from '@/lib/types';
import { TEAM_COLORS } from '@/lib/constants';

interface TeamColorPickerProps {
  value: TeamColorId;
  excludeId?: TeamColorId;
  onChange: (id: TeamColorId) => void;
}

/**
 * Row of swatches a team uses to pick its color. The other team's color is
 * shown but disabled so the two teams can't pick the same one.
 */
export function TeamColorPicker({
  value,
  excludeId,
  onChange,
}: TeamColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="اختيار لون الفريق">
      {TEAM_COLORS.map((color: TeamColor) => {
        const isExcluded = color.id === excludeId;
        const isActive = color.id === value;
        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={isExcluded}
            title={isExcluded ? `مأخوذ من الفريق الآخر` : color.name}
            onClick={() => onChange(color.id)}
            className={cn(
              'relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-offset-2 ring-offset-background transition-all',
              color.gradient,
              isActive
                ? 'ring-white scale-110'
                : 'ring-transparent hover:scale-105',
              isExcluded && 'cursor-not-allowed opacity-30 grayscale'
            )}
          >
            {isActive && <Check className="h-6 w-6 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
