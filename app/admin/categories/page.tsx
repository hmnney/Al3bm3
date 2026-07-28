'use client';

import { useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '../_lib/admin-context';
import { AdminPageHeader } from '../_components/admin-page-header';
import {
  AdminCategoryCard,
  AddCategoryTile,
} from '../_components/admin-category-card';
import type { AdminCategory } from '../_lib/types';

/**
 * Admin Categories page. Lists every category as a card with its image, name,
 * description, and question count. Each card has Edit / Delete / Add Question
 * buttons. A large dashed "add category" tile sits at the end of the grid.
 *
 * Per the spec, the popup forms are not built yet — the Edit and Add buttons
 * surface a toast confirming the action is wired and that the form will be
 * added later. Delete is functional against the local store.
 */
export default function AdminCategoriesPage() {
  const { data, ready, deleteCategory, questionsFor } = useAdmin();
  const { toast } = useToast();

  const cards = useMemo(
    () =>
      data.categories.map((c) => ({
        category: c,
        count: questionsFor(c.id).length,
      })),
    [data.categories, questionsFor]
  );

  const handleEdit = (c: AdminCategory) => {
    toast({
      title: 'تعديل التصنيف',
      description: `سيُضاف نموذج التعديل لـ "${c.name}" قريباً`,
    });
  };

  const handleAddQuestion = (c: AdminCategory) => {
    toast({
      title: 'إضافة سؤال',
      description: `سيُضاف نموذج إضافة سؤال إلى "${c.name}" قريباً`,
    });
  };

  const handleAddCategory = () => {
    toast({
      title: 'إضافة تصنيف',
      description: 'سيُضاف نموذج إنشاء تصنيف جديد قريباً',
    });
  };

  const handleDelete = (c: AdminCategory) => {
    deleteCategory(c.id);
    toast({
      title: 'تم حذف التصنيف',
      description: `حُذف "${c.name}" وجميع أسئلته`,
    });
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
          {cards.map(({ category, count }) => (
            <AdminCategoryCard
              key={category.id}
              category={category}
              questionCount={count}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddQuestion={handleAddQuestion}
            />
          ))}
          <AddCategoryTile onClick={handleAddCategory} />
        </div>
      )}
    </div>
  );
}
