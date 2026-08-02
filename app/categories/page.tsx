'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHeader } from '@/components/layout/section-header';
import { BackButton } from '@/components/layout/back-button';
import { GameButton } from '@/components/game/game-button';
import { CategoryCard } from '@/components/game/category-card';
import { useGame } from '@/components/providers/game-provider';
import { CATEGORIES, REQUIRED_CATEGORY_COUNT } from '@/lib/constants';
import { categoryImageUrl, preloadImage } from '@/lib/media';
import { AdminProvider, useAdmin } from '@/app/admin/_lib/admin-context';
import {
  loadInteractiveCategories,
  loadInteractiveCategoriesRemote,
} from '@/app/admin/interactive/_lib/store';
import { getPlugin } from '@/app/admin/interactive/_lib/registry';
import { registerAllPlugins } from '@/app/admin/interactive/_lib/plugins';
import type { InteractiveCategory } from '@/app/admin/interactive/_lib/types';
import type { CategoryId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

// Ensure plugins are registered so we can look up glyphs for interactive cats.
registerAllPlugins();

export default function CategoriesPage() {
  return (
    <AdminProvider>
      <CategoriesPageInner />
    </AdminProvider>
  );
}

function CategoriesPageInner() {
  const router = useRouter();
  const { state, toggleCategory, clearCategories, startMatch } = useGame();
  const { data: adminData } = useAdmin();

  const [interactiveCats, setInteractiveCats] = useState<InteractiveCategory[]>(
    []
  );

  // Load interactive categories from the persisted store (localStorage cache
  // first, then Supabase). The real game shows them alongside the standard
  // categories — same data source as the admin panel.
  useEffect(() => {
    setInteractiveCats(loadInteractiveCategories());
    void loadInteractiveCategoriesRemote().then((result) => {
      if (result.status === 'found' && result.data) {
        setInteractiveCats(result.data);
      }
    });
  }, []);

  useEffect(() => {
    console.log('[categories-page] Rendering from AdminContext — Category count =', adminData.categories.length);
  }, [adminData.categories.length]);

  // Warm the cache for every category image so selection cards (and the later
  // board) can paint instantly. Fire-and-forget; missing files are harmless.
  useEffect(() => {
    CATEGORIES.forEach((c) => preloadImage(categoryImageUrl(c.id)));
  }, []);

  const selected = state.selectedCategoryIds;
  const remaining = REQUIRED_CATEGORY_COUNT - selected.length;
  const limitReached = selected.length >= REQUIRED_CATEGORY_COUNT;

  const enabledInteractive = interactiveCats.filter((c) => c.enabled);

  // Admin-created categories that are NOT in the static catalog — these come
  // from Smart Import or manual creation and must be selectable.
  const staticIds = new Set(CATEGORIES.map((c) => c.id));
  const customAdminCats = adminData.categories.filter((c) => !staticIds.has(c.id as CategoryId));

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
                i < selected.length ? 'bg-brand-gradient' : 'bg-muted/40'
              }`}
            />
          ))}
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          {selected.length} / {REQUIRED_CATEGORY_COUNT} تصنيفات
          {remaining > 0 && ` — اختاروا ${remaining} إضافي`}
        </p>
      </div>

      {/* Interactive categories */}
      {enabledInteractive.length > 0 && (
        <div className="mt-10">
          <span className="mb-3 block text-xs font-black uppercase tracking-wider text-primary">
            تصنيفات تفاعلية
          </span>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {enabledInteractive.map((ic) => {
              const id = ic.id as CategoryId;
              const isSelected = selected.includes(id);
              const selectionIndex = isSelected
                ? selected.indexOf(id)
                : undefined;
              return (
                <InteractiveCategoryChip
                  key={ic.id}
                  category={ic}
                  selected={isSelected}
                  selectionIndex={selectionIndex}
                  disabled={limitReached && !isSelected}
                  onToggle={() => toggleCategory(id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Standard categories */}
      <div className="mt-10">
        {enabledInteractive.length > 0 && (
          <span className="mb-3 block text-xs font-black uppercase tracking-wider text-muted-foreground">
            تصنيفات عادية
          </span>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          {customAdminCats.map((adminCat) => {
            const id = adminCat.id as CategoryId;
            const isSelected = selected.includes(id);
            const selectionIndex = isSelected
              ? selected.indexOf(id)
              : undefined;
            return (
              <CategoryCard
                key={adminCat.id}
                category={{
                  id,
                  name: adminCat.name,
                  description: adminCat.description,
                  glyph: adminCat.glyph,
                  gradient: adminCat.gradient,
                }}
                selected={isSelected}
                selectionIndex={selectionIndex}
                disabled={limitReached}
                onSelect={toggleCategory}
              />
            );
          })}
        </div>
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

function InteractiveCategoryChip({
  category,
  selected,
  selectionIndex,
  disabled,
  onToggle,
}: {
  category: InteractiveCategory;
  selected: boolean;
  selectionIndex?: number;
  disabled: boolean;
  onToggle: () => void;
}) {
  const glyph = getInteractiveGlyph(category);

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border-2 p-5 text-right transition-all duration-200',
        selected
          ? 'border-primary bg-primary/15 shadow-lg'
          : 'border-border/50 bg-card/40 hover:border-primary/40',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {/* Badge */}
      <div className="absolute left-4 top-4 rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-black text-primary">
        تفاعلي
      </div>

      {/* Selection number */}
      {selected && selectionIndex !== undefined && (
        <div className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-xs font-black text-white shadow">
          {selectionIndex + 1}
        </div>
      )}

      {/* Glyph */}
      <div className="flex h-20 items-center justify-center">
        <span className="text-5xl">{glyph}</span>
      </div>

      {/* Name + description */}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-black text-foreground">{category.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {category.description}
        </p>
      </div>

      {selected && (
        <div className="absolute bottom-4 left-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
      )}
    </button>
  );
}

function getInteractiveGlyph(cat: InteractiveCategory): string {
  const plugin = getPlugin(cat.pluginId);
  if (cat.interactionType === 'qr') return '📱';
  if (cat.interactionType === 'audio') return '🎙️';
  if (cat.interactionType === 'video') return '🎬';
  if (plugin) return '🎮';
  return '🧩';
}
