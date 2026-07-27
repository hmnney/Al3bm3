'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category } from '@/lib/types';
import { CategoryArt } from './category-art';

interface CategoryCardProps {
  category: Category;
  selected: boolean;
  selectionIndex?: number;
  disabled?: boolean;
  onSelect: (id: Category['id']) => void;
}

/**
 * Selectable category card used on the Categories page. Clicking toggles
 * selection; the card shows a numbered badge once chosen and dims when the
 * 6-category limit is reached and this card isn't one of them.
 */
export function CategoryCard({
  category,
  selected,
  selectionIndex,
  disabled,
  onSelect,
}: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      disabled={disabled && !selected}
      aria-pressed={selected}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card/60 text-right transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary glow-primary'
          : 'border-border/60 hover:border-primary/50',
        disabled && !selected && 'cursor-not-allowed opacity-40'
      )}
    >
      {/* Art */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <CategoryArt
          category={category}
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
        />

        {/* Selected overlay + number badge */}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/30 backdrop-blur-[2px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-2xl font-black text-white shadow-lg animate-count-pop">
              {typeof selectionIndex === 'number' ? selectionIndex + 1 : <Check className="h-7 w-7" />}
            </div>
          </div>
        )}

        {/* Disabled "limit reached" hint */}
        {disabled && !selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 text-xs font-semibold text-muted-foreground">
            اكتمل العدد
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-lg font-bold leading-snug text-foreground">
          {category.name}
        </h3>
        <p className="text-sm text-muted-foreground">{category.description}</p>
      </div>
    </button>
  );
}
