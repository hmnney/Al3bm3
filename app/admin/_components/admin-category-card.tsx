'use client';

import { useState } from 'react';
import { Pencil, Trash2, Plus, FolderPlus, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { categoryImageUrl } from '@/lib/media';
import type { AdminCategory, AdminQuestion } from '../_lib/types';

interface AdminCategoryCardProps {
  category: AdminCategory;
  questionCount: number;
  onEdit: (category: AdminCategory) => void;
  onDelete: (category: AdminCategory) => void;
  onAddQuestion: (category: AdminCategory) => void;
}

/**
 * A single category card in the admin Categories page. Shows the category
 * image (from /public/category-images/), name, description, and question
 * count, plus Edit / Delete / Add Question buttons.
 */
export function AdminCategoryCard({
  category,
  questionCount,
  onEdit,
  onDelete,
  onAddQuestion,
}: AdminCategoryCardProps) {
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(category.image) && !imgError;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur transition-all duration-300 hover:border-primary/40 hover:shadow-2xl">
      {/* Image / placeholder */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-background-soft to-muted/30">
        {hasImage ? (
          <img
            src={categoryImageUrl(category.id as never)}
            alt={category.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {imgError ? (
              <ImageOff className="h-8 w-8" />
            ) : (
              <span className="text-5xl">{category.glyph}</span>
            )}
            <span className="text-xs font-semibold">لا توجد صورة</span>
          </div>
        )}
        {/* Question count chip */}
        <div className="absolute right-3 top-3 rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-foreground backdrop-blur">
          {questionCount.toLocaleString('ar-EG')} سؤال
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-black text-foreground">{category.name}</h3>
          <p className="text-sm text-muted-foreground">{category.description}</p>
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => onEdit(category)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs font-bold text-foreground transition-all hover:border-primary/50 hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5" />
            تعديل
          </button>
          <button
            type="button"
            onClick={() => onDelete(category)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive transition-all hover:bg-destructive/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف
          </button>
          <button
            type="button"
            onClick={() => onAddQuestion(category)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border border-secondary/30 bg-secondary/5 px-3 py-2 text-xs font-bold text-secondary transition-all hover:bg-secondary/15'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة سؤال
          </button>
        </div>
      </div>
    </div>
  );
}

/** Props for the "add category" tile. */
export interface AddCategoryTileProps {
  onClick: () => void;
}

/** A large, dashed "add category" CTA tile. */
export function AddCategoryTile({ onClick }: AddCategoryTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center transition-all duration-300 hover:border-primary hover:bg-primary/10"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg transition-transform group-hover:scale-110">
        <FolderPlus className="h-8 w-8" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xl font-black text-foreground">➕ إضافة تصنيف</span>
        <span className="text-sm text-muted-foreground">أضف تصنيفاً جديداً للعبة</span>
      </div>
    </button>
  );
}
