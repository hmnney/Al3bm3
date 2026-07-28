'use client';

import { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '../_lib/admin-context';
import { AdminPageHeader } from '../_components/admin-page-header';
import { DifficultyBadge, MediaBadge } from '../_components/badges';
import { mediaTypeOf, type AdminQuestion, type MediaType } from '../_lib/types';
import { QuestionFormModal } from '../_components/question-form-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuestionDifficulty } from '@/lib/types';

/**
 * Admin Question Bank page. A searchable, filterable table of every question.
 * Filters: category, difficulty, media type. Search matches question text.
 *
 * Add / Edit surface a toast (the form popups are deferred per spec). Delete
 * is functional against the local store.
 */
export default function AdminQuestionsPage() {
  const { data, ready, deleteQuestion, addQuestion, updateQuestion } = useAdmin();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [mediaFilter, setMediaFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);

  // Category id -> name lookup for the table + filter options.
  const categoryName = useMemo(() => {
    const map = new Map(data.categories.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? '—';
  }, [data.categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.questions.filter((item) => {
      if (categoryFilter !== 'all' && item.categoryId !== categoryFilter)
        return false;
      if (difficultyFilter !== 'all' && item.difficulty !== difficultyFilter)
        return false;
      if (mediaFilter !== 'all' && mediaTypeOf(item) !== mediaFilter)
        return false;
      if (q && !item.question.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.questions, search, categoryFilter, difficultyFilter, mediaFilter]);

  const hasActiveFilters =
    search !== '' ||
    categoryFilter !== 'all' ||
    difficultyFilter !== 'all' ||
    mediaFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setDifficultyFilter('all');
    setMediaFilter('all');
  };

  const handleAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (q: AdminQuestion) => {
    setEditing(q);
    setShowForm(true);
  };

  const handleSave = (formData: Omit<AdminQuestion, 'id'>) => {
    if (editing) {
      updateQuestion(editing.id, formData);
      toast({ title: 'تم الحفظ', description: 'حُفظت تعديلات السؤال' });
    } else {
      addQuestion(formData);
      toast({ title: 'تمت الإضافة', description: 'أُضيف السؤال إلى بنك الأسئلة' });
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = (q: AdminQuestion) => {
    deleteQuestion(q.id);
    toast({
      title: 'تم حذف السؤال',
      description: 'حُذف السؤال من بنك الأسئلة',
    });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="بنك الأسئلة"
        subtitle="ابحث وصفِّ جميع أسئلة اللعبة"
        actions={
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            إضافة سؤال
          </button>
        }
      />

      {/* Filters bar */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border-2 border-border/50 bg-card/50 p-4 backdrop-blur lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في نص السؤال…"
            className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Category filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="التصنيف" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التصنيفات</SelectItem>
            {data.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Difficulty filter */}
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue placeholder="الصعوبة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الصعوبات</SelectItem>
            <SelectItem value="easy">سهل</SelectItem>
            <SelectItem value="medium">متوسط</SelectItem>
            <SelectItem value="hard">صعب</SelectItem>
          </SelectContent>
        </Select>

        {/* Media filter */}
        <Select value={mediaFilter} onValueChange={setMediaFilter}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue placeholder="نوع الوسائط" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الوسائط</SelectItem>
            <SelectItem value="image">صورة</SelectItem>
            <SelectItem value="audio">صوت</SelectItem>
            <SelectItem value="video">فيديو</SelectItem>
            <SelectItem value="none">بدون</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-xs font-bold text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            مسح
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          {filtered.length.toLocaleString('ar-EG')} نتيجة
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border-2 border-border/50 bg-card/40 backdrop-blur">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                السؤال
              </TableHead>
              <TableHead className="hidden text-right text-xs font-bold uppercase tracking-wider text-muted-foreground sm:table-cell">
                التصنيف
              </TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                الصعوبة
              </TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                النقاط
              </TableHead>
              <TableHead className="hidden text-right text-xs font-bold uppercase tracking-wider text-muted-foreground md:table-cell">
                الوسائط
              </TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                إجراءات
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!ready ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-border/40">
                  <TableCell colSpan={6}>
                    <div className="h-6 animate-pulse rounded bg-muted/40" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm font-semibold text-muted-foreground">
                    لا توجد أسئلة مطابقة
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((q) => (
                <TableRow
                  key={q.id}
                  className="border-border/40 text-sm transition-colors hover:bg-primary/5"
                >
                  <TableCell className="max-w-xs truncate font-semibold text-foreground">
                    {q.question}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {categoryName(q.categoryId)}
                  </TableCell>
                  <TableCell>
                    <DifficultyBadge difficulty={q.difficulty as QuestionDifficulty} />
                  </TableCell>
                  <TableCell className="font-bold tabular-nums text-foreground">
                    {q.points.toLocaleString('ar-EG')}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <MediaBadge type={mediaTypeOf(q)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEdit(q)}
                        aria-label="تعديل"
                        className="rounded-lg border border-border/60 bg-background/60 p-2 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(q)}
                        aria-label="حذف"
                        className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive transition-all hover:bg-destructive/15"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showForm && (
        <QuestionFormModal
          question={editing}
          categories={data.categories}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
