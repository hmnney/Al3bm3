'use client';

import { cn } from '@/lib/utils';
import type { Category, QuestionSlot, Team } from '@/lib/types';
import { POINT_VALUES, TEAM_COLOR_MAP } from '@/lib/constants';
import { CategoryArt } from './category-art';
import { PointButton } from './point-button';

interface BoardCategoryCardProps {
  category: Category;
  slots: QuestionSlot[];
  teams: [Team, Team];
  onAnswer: (
    categoryId: Category['id'],
    points: QuestionSlot['points'],
    team: QuestionSlot['team']
  ) => void;
}

/**
 * One category column on the game board. Contains the category art + title at
 * the top, then two mirrored columns of point buttons (team 1 on the right in
 * RTL, team 2 on the left). Completed buttons turn gray and disabled.
 *
 * The onAnswer callback is invoked when a point button is pressed; the actual
 * question popup is a future feature, so the parent currently just marks the
 * slot completed to exercise the full board state.
 */
export function BoardCategoryCard({
  category,
  slots,
  teams,
  onAnswer,
}: BoardCategoryCardProps) {
  const [team1, team2] = teams;
  const team1Color = TEAM_COLOR_MAP[team1.colorId];
  const team2Color = TEAM_COLOR_MAP[team2.colorId];

  const isCompleted = (points: number, team: QuestionSlot['team']) =>
    slots.some(
      (s) =>
        s.categoryId === category.id &&
        s.points === points &&
        s.team === team &&
        s.completed
    );

  const allDone = slots.every((s) => s.completed);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border-2 bg-card/50 backdrop-blur transition-all',
        allDone
          ? 'border-border/40 opacity-70'
          : 'border-border/60 hover:border-primary/40'
      )}
    >
      {/* Header */}
      <div className="relative">
        <CategoryArt
          category={category}
          large
          className="h-28 w-full rounded-none sm:h-32"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <h3 className="absolute bottom-3 right-4 left-4 text-center text-xl font-black text-white drop-shadow-lg sm:text-2xl">
          {category.name}
        </h3>
        {allDone && (
          <div className="absolute right-3 top-3 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-success backdrop-blur">
            ✅ تم إنهاء التصنيف
          </div>
        )}
      </div>

      {/* Two team columns */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {/* team-1 column (renders on the right in RTL) */}
        <div className="flex flex-col gap-2.5">
          {POINT_VALUES.map((points) => (
            <PointButton
              key={`t1-${points}`}
              points={points}
              completed={isCompleted(points, 'team-1')}
              teamHsl={team1Color.hsl}
              onClick={() => onAnswer(category.id, points, 'team-1')}
            />
          ))}
        </div>
        {/* team-2 column (renders on the left in RTL) */}
        <div className="flex flex-col gap-2.5">
          {POINT_VALUES.map((points) => (
            <PointButton
              key={`t2-${points}`}
              points={points}
              completed={isCompleted(points, 'team-2')}
              teamHsl={team2Color.hsl}
              onClick={() => onAnswer(category.id, points, 'team-2')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
