'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '../_lib/admin-context';
import { useSettings } from '../_lib/settings-context';
import { AdminPageHeader } from '../_components/admin-page-header';
import {
  AdminCategoryCard,
  AddCategoryTile,
} from '../_components/admin-category-card';
import { CategoryFormModal } from '../_components/category-form-modal';
import { QuestionFormModal } from '../_components/question-form-modal';
import type { AdminCategory, AdminQuestion } from '../_lib/types';
import { cn } from '@/lib/utils';

export default function AdminCategoriesPage() {
  const {
    data,
    ready,
    addCategory,
    updateCategory,
    deleteCategory,
    addQuestion,
  } = useAdmin();
  const { settings, update } = useSettings();
  const { toast } = useToast();

  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<AdminCategory | null>(null);
  const [showQForm, setShowQForm] = useState(false);
  const [questionTargetCat, setQuestionTargetCat] = useState<AdminCategory | null>(null);

  const ordered = useMemo(() => {
    const byId = new Map(data.categories.map((c) => [c.id, c]));
    const result = settings.categories.order
      .map((id) => byId.get(id))
      .filter((c): c is AdminCategory => Boolean(c));
    data.categories.forEach((c) => {
      if (!settings.categories.order.includes(c.id)) result.push(c);
    });
    return result;
  }, [data.categories, settings.categories.order]);

  const cards = useMemo(
    () =>
      ordered.map((c) => ({
        category: c,
        count: data.questions.filter((q) => q.categoryId === c.id).length,
      })),
    [ordered, data.questions]
  );

  const move = (id: string, dir: -1 | 1) => {
    const ids = ordered.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    update({ categories: { ...settings.categories, order: ids } });
  };

  const toggleDisabled = (id: string) => {
    const has = settings.categories.disabled.includes(id);
    update({
      categories: {
        ...settings.categories,
        disabled: has
          ? settings.categories.disabled.filter((x) => x !== id)
          : [...settings.categories.disabled, id],
      },
    });
    toast({ title: has ? 'تم التفعيل' : 'تم التعطيل' });
  };

  const toggleHidden = (id: string) => {
    const has = settings.categories.hidden.includes(id);
    update({
      categories: {
        ...settings.categories,
        hidden: has
          ? settings.categories.hidden.filter((x) => x !== id)
          : [...settings.categories.hidden, id],
      },
    });
    toast({ title: has ? 'إظهار التصنيف' : 'إخفاء التصنيف' });
  };

  const handleEdit = (c: AdminCategory) => {
    setEditingCat(c);
    setShowCatForm(true);
  };

  const handleAddCategory = () => {
    setEditingCat(null);
    setShowCatForm(true);
  };

  const handleAddQuestion = (c: AdminCategory) => {
    setQuestionTargetCat(c);
    setShowQForm(true);
  };

  const handleDelete = (c: AdminCategory) => {
    deleteCategory(c.id);
    toast({ title: 'تم حذف التصنيف', description: `حُذف "${c.name}" وجميع أسئلته` });
  };

  const handleSaveCategory = (formData: Omit<AdminCategory, 'id'>) => {
    if (editingCat) {
      updateCategory(editingCat.id, formData);
      toast({ title: 'تم الحفظ', description: `حُفظت تعديلات "${formData.name}"` });
    } else {
      addCategory(formData);
      toast({ title: 'تمت الإضافة', description: `أُضيف "${formData.name}"` });
    }
    setShowCatForm(false);
    setEditingCat(null);
  };

  const handleSaveQuestion = (formData: Omit<AdminQuestion, 'id'>) => {
    addQuestion(formData);
    toast({ title: 'تمت الإضافة', description: 'أُضيف السؤال إلى بنك الأسئلة' });
    setShowQForm(false);
    setQuestionTargetCat(null);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="التصنيفات"
        subtitle="إدارة تصنيفات اللعبة وأسئلتها"
      />

      {!ready ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl border-2 border-border/40 bg-card/30"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ category, count }, idx) => {
            const disabled = settings.categories.disabled.includes(category.id);
            const hidden = settings.categories.hidden.includes(category.id);
            return (
              <div key={category.id} className="relative">
                <AdminCategoryCard
                  category={category}
                  questionCount={count}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddQuestion={handleAddQuestion}
                />
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-1 backdrop-blur">
                  <button
                    onClick={() => move(category.id, -1)}
                    disabled={idx === 0}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                    aria-label="تحريك لأعلى"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => move(category.id, 1)}
                    disabled={idx === ordered.length - 1}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                    aria-label="تحريك لأسفل"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleDisabled(category.id)}
                    className={cn(
                      'rounded-md p-1 transition-colors',
                      disabled
                        ? 'text-warning hover:bg-warning/10'
                        : 'text-success hover:bg-success/10'
                    )}
                    aria-label="تفعيل/تعطيل"
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleHidden(category.id)}
                    className={cn(
                      'rounded-md p-1 transition-colors',
                      hidden
                        ? 'text-muted-foreground hover:bg-primary/10'
                        : 'text-secondary hover:bg-secondary/10'
                    )}
                    aria-label="إخفاء/إظهار"
                  >
                    {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {hidden && (
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-background/40" />
                )}
              </div>
            );
          })}
          <AddCategoryTile onClick={handleAddCategory} />
        </div>
      )}

      {showCatForm && (
        <CategoryFormModal
          category={editingCat}
          onClose={() => {
            setShowCatForm(false);
            setEditingCat(null);
          }}
          onSave={handleSaveCategory}
        />
      )}

      {showQForm && (
        <QuestionFormModal
          question={null}
          categories={data.categories}
          defaultCategoryId={questionTargetCat?.id}
          onClose={() => {
            setShowQForm(false);
            setQuestionTargetCat(null);
          }}
          onSave={handleSaveQuestion}
        />
      )}
    </div>
  );
}
