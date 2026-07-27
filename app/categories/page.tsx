'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHeader } from '@/components/layout/section-header';
import { BackButton } from '@/components/layout/back-button';
import { GameButton } from '@/components/game/game-button';
import { CategoryCard } from '@/components/game/category-card';
import { useGame } from '@/components/providers/game-provider';
import { CATEGORIES, REQUIRED_CATEGORY_COUNT } from '@/lib/constants';
import { categoryImageUrl, preloadImage } from '@/lib/media';

export default function CategoriesPage() {
  const router = useRouter();
  const { state, toggleCategory, clearCategories, startMatch } = useGame();

  // Warm the cache for every category image so selection cards (and the later
  // board) can paint instantly. Fire-and-forget; missing files are harmless.
  useEffect(() => {
    CATEGORIES.forEach((c) => preloadImage(categoryImageUrl(c.id)));
  }, []);

  const selected = state.selectedCategoryIds;
  const remaining = REQUIRED_CATEGORY_COUNT - selected.length;
  const limitReached = selected.length >= REQUIRED_CATEGORY_COUNT;

  const handleContinue = () => {
    if (selected.length !== REQUIRED_CATEGORY_COUNT) return;
    startMatch(selected);
    router.push('/board');
  };

  return (
    <PageShell>
      <div className="mb-8 flex items-center justify-between">
        <BackButton href="/teams" />
        {selected.length > 0 && (
          <button
            onClick={clearCategories}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:border-destructive/50 hover:text-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            مسح الاختيار
          </button>
        )}
      </div>

      <SectionHeader
        title="اختيار التصنيفات"
        subtitle={`اختاروا ${REQUIRED_CATEGORY_COUNT} تصنيفات للمباراة — كل تصنيف يضيف نكهة مختلفة`}
        step={2}
        totalSteps={3}
      />

      {/* Selection counter */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {Array.from({ length: REQUIRED_CATEGORY_COUNT }).map((_, i) => (
            <div
              key={i}
              className={`h-3 w-10 rounded-full transition-all duration-300 ${
                i < selected.length
                  ? 'bg-brand-gradient'
                  : 'bg-muted/40'
              }`}
            />
          ))}
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          {selected.length} / {REQUIRED_CATEGORY_COUNT} تصنيفات
          {remaining > 0 && ` — اختاروا ${remaining} إضافي`}
        </p>
      </div>

      {/* Category grid */}
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CATEGORIES.map((category) => {
          const isSelected = selected.includes(category.id);
          const selectionIndex = isSelected
            ? selected.indexOf(category.id)
            : undefined;
          return (
            <CategoryCard
              key={category.id}
              category={category}
              selected={isSelected}
              selectionIndex={selectionIndex}
              disabled={limitReached}
              onSelect={toggleCategory}
            />
          );
        })}
      </div>

      {/* Continue */}
      <div className="mt-12 flex flex-col items-center gap-3">
        <GameButton
          size="xl"
          onClick={handleContinue}
          disabled={selected.length !== REQUIRED_CATEGORY_COUNT}
          className="w-full max-w-md"
        >
          ابدأ المباراة
          <ArrowLeft className="h-6 w-6" />
        </GameButton>
        {selected.length !== REQUIRED_CATEGORY_COUNT && (
          <p className="text-sm text-muted-foreground">
            يجب اختيار {REQUIRED_CATEGORY_COUNT} تصنيفات بالضبط للمتابعة
          </p>
        )}
      </div>
    </PageShell>
  );
}
