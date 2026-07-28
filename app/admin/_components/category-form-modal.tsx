'use client';

import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import type { AdminCategory } from '../_lib/types';

const GLYPH_OPTIONS = ['🎯', '🎬', '🎮', '⚽', '🎵', '🧩', '🏆', '🌟', '💡', '📚', '🎭', '🔬', '🌍', '🍽️', '🏛️', '✈️', '🎨', '🎤'];
const GRADIENT_OPTIONS = [
  'from-indigo-500/80 to-blue-700/80',
  'from-rose-500/80 to-red-700/80',
  'from-pink-500/80 to-fuchsia-700/80',
  'from-violet-500/80 to-purple-700/80',
  'from-green-500/80 to-emerald-700/80',
  'from-emerald-500/80 to-teal-700/80',
  'from-amber-500/80 to-orange-700/80',
  'from-sky-500/80 to-cyan-700/80',
  'from-yellow-500/80 to-amber-700/80',
  'from-teal-500/80 to-green-700/80',
  'from-blue-500/80 to-indigo-700/80',
  'from-fuchsia-500/80 to-pink-700/80',
  'from-purple-500/80 to-violet-700/80',
  'from-orange-500/80 to-red-700/80',
  'from-cyan-500/80 to-blue-700/80',
];

interface CategoryFormModalProps {
  category: AdminCategory | null;
  onClose: () => void;
  onSave: (data: Omit<AdminCategory, 'id'>) => void;
}

export function CategoryFormModal({ category, onClose, onSave }: CategoryFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [glyph, setGlyph] = useState(GLYPH_OPTIONS[0]);
  const [gradient, setGradient] = useState(GRADIENT_OPTIONS[0]);
  const [image, setImage] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name);
      setDescription(category.description);
      setGlyph(category.glyph || GLYPH_OPTIONS[0]);
      setGradient(category.gradient || GRADIENT_OPTIONS[0]);
      setImage(category.image || '');
    } else {
      setName('');
      setDescription('');
      setGlyph(GLYPH_OPTIONS[0]);
      setGradient(GRADIENT_OPTIONS[0]);
      setImage('');
    }
  }, [category]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      glyph,
      gradient,
      image: image.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-border/50 bg-card/95 p-6 backdrop-blur-xl scrollbar-thin">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-foreground">
            {category ? 'تعديل التصنيف' : 'إضافة تصنيف'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card/80 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-foreground">الاسم</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم التصنيف"
                autoFocus
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-foreground">الوصف</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وصف مختصر"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-foreground">الأيقونة</span>
            <div className="flex flex-wrap gap-2">
              {GLYPH_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGlyph(g)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xl transition-all ${
                    glyph === g
                      ? 'border-primary bg-primary/15'
                      : 'border-border/50 bg-background/40 hover:border-primary/40'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-foreground">اللون</span>
            <div className="flex flex-wrap gap-2">
              {GRADIENT_OPTIONS.map((grad) => (
                <button
                  key={grad}
                  type="button"
                  onClick={() => setGradient(grad)}
                  className={`h-10 w-10 rounded-lg border-2 bg-gradient-to-br transition-all ${grad} ${
                    gradient === grad
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border/50 hover:border-primary/40'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-foreground">صورة (اختياري)</span>
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="اسم ملف الصورة في category-images/"
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:text-foreground"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
