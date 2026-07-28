'use client';

import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import type { AdminCategory, AdminQuestion } from '../_lib/types';
import type { QuestionDifficulty } from '@/lib/types';

const DIFFICULTIES: { value: QuestionDifficulty; label: string; points: 250 | 500 | 750 }[] = [
  { value: 'easy', label: 'سهل', points: 250 },
  { value: 'medium', label: 'متوسط', points: 500 },
  { value: 'hard', label: 'صعب', points: 750 },
];

interface QuestionFormModalProps {
  question: AdminQuestion | null;
  categories: AdminCategory[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSave: (data: Omit<AdminQuestion, 'id'>) => void;
}

export function QuestionFormModal({
  question,
  categories,
  defaultCategoryId,
  onClose,
  onSave,
}: QuestionFormModalProps) {
  const [categoryId, setCategoryId] = useState('');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium');
  const [questionText, setQuestionText] = useState('');
  const [answer, setAnswer] = useState('');
  const [image, setImage] = useState('');
  const [audio, setAudio] = useState('');
  const [video, setVideo] = useState('');

  useEffect(() => {
    if (question) {
      setCategoryId(question.categoryId);
      setDifficulty(question.difficulty);
      setQuestionText(question.question);
      setAnswer(question.answer);
      setImage(question.image || '');
      setAudio(question.audio || '');
      setVideo(question.video || '');
    } else {
      setCategoryId(defaultCategoryId || categories[0]?.id || '');
      setDifficulty('medium');
      setQuestionText('');
      setAnswer('');
      setImage('');
      setAudio('');
      setVideo('');
    }
  }, [question, defaultCategoryId, categories]);

  const points = DIFFICULTIES.find((d) => d.value === difficulty)!.points;

  const handleSave = () => {
    if (!questionText.trim() || !answer.trim() || !categoryId) return;
    onSave({
      categoryId,
      difficulty,
      points,
      question: questionText.trim(),
      answer: answer.trim(),
      image: image.trim() || undefined,
      audio: audio.trim() || undefined,
      video: video.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-border/50 bg-card/95 p-6 backdrop-blur-xl scrollbar-thin">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-foreground">
            {question ? 'تعديل السؤال' : 'إضافة سؤال'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card/80 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-foreground">التصنيف</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-foreground">الصعوبة</span>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-black transition-all ${
                    difficulty === d.value
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {d.label} · {d.points}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-foreground">السؤال</span>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="نص السؤال"
              rows={3}
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-foreground">الإجابة</span>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="الإجابة الصحيحة"
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-foreground">صورة (اختياري)</span>
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="images/"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-foreground">صوت (اختياري)</span>
              <input
                value={audio}
                onChange={(e) => setAudio(e.target.value)}
                placeholder="audio/"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-foreground">فيديو (اختياري)</span>
              <input
                value={video}
                onChange={(e) => setVideo(e.target.value)}
                placeholder="video/"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
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
            disabled={!questionText.trim() || !answer.trim() || !categoryId}
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
