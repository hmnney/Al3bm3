'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Trash2, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { InteractionPlugin, PluginConfig, PluginDataset } from '../types';
import { getAIProvider } from '../../../ai/_lib';
import type { AIProviderConfig, GenerateWordsRequest } from '../../../ai/_lib';
import { useSettings } from '../../../_lib/settings-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/** Topics the admin can choose from when generating words. */
const WORD_TOPICS = [
  'أنمي',
  'أفلام',
  'كرة قدم',
  'الدوري السعودي',
  'مصارعة',
  'مسلسل Friends',
  'ألعاب',
  'ثقافة عامة',
  'مشاهير',
  'شخصيات كرتونية',
] as const;

const WORD_COUNTS = [10, 25, 50, 100, 250] as const;

/** Ensure a dataset is a valid word-only dataset. */
function asWordDataset(dataset: PluginDataset | undefined): {
  kind: 'word-only';
  words: string[];
  usedWords: string[];
} {
  if (dataset && dataset.kind === 'word-only') return dataset;
  return { kind: 'word-only', words: [], usedWords: [] };
}

/**
 * AdminExtra — the AI word generation panel shown inside the category detail
 * view. The admin picks a topic + count, presses Generate, and the current AI
 * provider returns a list of words that get saved into the category's dataset.
 */
function WordOnlyAdminExtra({
  category,
  onUpdateDataset,
}: {
  category: import('../types').InteractiveCategory;
  onUpdate: (config: PluginConfig) => void;
  onUpdateDataset: (dataset: PluginDataset) => void;
}) {
  const { settings } = useSettings();
  const { toast } = useToast();
  const dataset = asWordDataset(category.dataset);
  const [topic, setTopic] = useState<string>(WORD_TOPICS[0]);
  const [count, setCount] = useState<number>(25);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = dataset.words.length - dataset.usedWords.length;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const aiConfig: AIProviderConfig = {
        provider: settings.ai.provider,
        apiKey: settings.ai.apiKey,
        model: settings.ai.model,
        temperature: settings.ai.temperature,
        maxTokens: settings.ai.maxTokens,
        enabled: settings.ai.enabled,
      };
      const provider = getAIProvider(aiConfig);
      const request: GenerateWordsRequest = { topic, count };
      const words = await provider.generateWords(request, aiConfig);

      if (!words || words.length === 0) {
        setError('لم يُرجع المزود أي كلمات. تحقق من الاتصال أو جرّب مرة أخرى.');
        return;
      }

      // Merge new words with existing (avoid duplicates), preserve usedWords.
      const existing = new Set(dataset.words.map((w) => w.toLowerCase()));
      const fresh = words.filter((w) => {
        const trimmed = w.trim();
        return trimmed && !existing.has(trimmed.toLowerCase());
      });
      const merged = [...dataset.words, ...fresh];

      onUpdateDataset({
        kind: 'word-only',
        words: merged,
        usedWords: dataset.usedWords,
      });
      toast({
        title: 'تم توليد الكلمات',
        description: `أُضيف ${fresh.length} كلمة جديدة (الإجمالي: ${merged.length})`,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleClearAll = () => {
    onUpdateDataset({ kind: 'word-only', words: [], usedWords: [] });
    toast({ title: 'تم مسح الكلمات' });
  };

  const handleRemoveWord = (word: string) => {
    onUpdateDataset({
      kind: 'word-only',
      words: dataset.words.filter((w) => w !== word),
      usedWords: dataset.usedWords.filter((w) => w !== word),
    });
  };

  const handleResetUsed = () => {
    onUpdateDataset({
      kind: 'word-only',
      words: dataset.words,
      usedWords: [],
    });
    toast({ title: 'تمت إعادة تعيين الكلمات المستخدمة' });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="إجمالي الكلمات" value={dataset.words.length} tone="primary" />
        <StatBox label="المتبقي" value={remaining} tone="success" />
        <StatBox label="المستخدم" value={dataset.usedWords.length} tone="muted" />
      </div>

      {/* AI Generation panel */}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-black text-foreground">
            توليد الكلمات بالذكاء الاصطناعي
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {/* Topic selector */}
          <div>
            <span className="mb-2 block text-xs font-bold text-muted-foreground">
              التصنيف الرئيسي
            </span>
            <div className="flex flex-wrap gap-2">
              {WORD_TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={cn(
                    'rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition-all',
                    topic === t
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Count selector */}
          <div>
            <span className="mb-2 block text-xs font-bold text-muted-foreground">
              عدد الكلمات
            </span>
            <div className="flex flex-wrap gap-2">
              {WORD_COUNTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCount(c)}
                  className={cn(
                    'rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition-all',
                    count === c
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? 'جارٍ التوليد...' : 'توليد الكلمات'}
          </button>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!settings.ai.enabled && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs font-bold text-amber-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              الذكاء الاصطناعي معطّل — سيُستخدم المحرك المحلي (Mock AI).
            </div>
          )}
        </div>
      </div>

      {/* Words list */}
      {dataset.words.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-foreground">
              الكلمات المحفوظة ({dataset.words.length})
            </span>
            <div className="flex gap-2">
              {dataset.usedWords.length > 0 && (
                <button
                  onClick={handleResetUsed}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  إعادة تعيين المستخدم
                </button>
              )}
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-bold text-destructive transition-all hover:bg-destructive/15"
              >
                <Trash2 className="h-3 w-3" />
                مسح الكل
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto rounded-xl border border-border/40 bg-background/40 p-3 scrollbar-thin">
            {dataset.words.map((word) => {
              const isUsed = dataset.usedWords.includes(word);
              return (
                <div
                  key={word}
                  className={cn(
                    'group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all',
                    isUsed
                      ? 'border-border/30 bg-muted/20 text-muted-foreground line-through'
                      : 'border-primary/30 bg-primary/10 text-foreground'
                  )}
                >
                  {isUsed && <CheckCircle2 className="h-3 w-3 text-muted-foreground" />}
                  {word}
                  <button
                    onClick={() => handleRemoveWord(word)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-card/20 py-10 text-center">
          <span className="text-sm text-muted-foreground">
            لا توجد كلمات بعد — استخدم لوحة التوليد بالأعلى
          </span>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'success' | 'muted';
}) {
  const tones = {
    primary: 'border-primary/30 bg-primary/10 text-primary',
    success: 'border-success/30 bg-success/10 text-success',
    muted: 'border-border/40 bg-muted/20 text-muted-foreground',
  };
  return (
    <div className={cn('flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3', tones[tone])}>
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}

/**
 * GameplayComponent — rendered inside the question modal when a team selects
 * this category. Picks a random unused word, creates a QR session, and shows
 * the QR code. The main screen NEVER shows the word — only the player who
 * scans the QR sees it on their phone.
 */
function WordOnlyGameplay({
  category,
  sessionUrl,
  onResult,
}: {
  category: import('../types').InteractiveCategory;
  sessionUrl: string;
  onResult: (result: 'current' | 'opponent' | 'none') => void;
}) {
  const dataset = asWordDataset(category.dataset);
  const remaining = dataset.words.length - dataset.usedWords.length;

  if (remaining === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <AlertCircle className="h-10 w-10 text-amber-500" />
        <p className="text-lg font-black text-foreground">
          لا توجد كلمات متبقية في هذا التصنيف
        </p>
        <p className="text-sm text-muted-foreground">
          اطلب من المدير توليد المزيد من الكلمات
        </p>
        <button
          onClick={() => onResult('none')}
          className="rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-bold text-muted-foreground transition-all hover:text-foreground"
        >
          تخطي
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 text-sm font-black text-amber-500">
        <Sparkles className="h-4 w-4" />
        ولا كلمة — امسح QR لترى الكلمة
      </div>
      <p className="max-w-md text-sm text-muted-foreground">
        اللاعب يمسح رمز QR بهاتفه ليرى الكلمة السرية. يجب أن يجعل فريقه يخمنها دون
        ذكرها. الشاشة الرئيسية لا تظهر الكلمة أبداً.
      </p>
      <div className="rounded-2xl border-2 border-primary/30 bg-card/50 p-4">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(sessionUrl)}`}
          alt="QR Code"
          className="h-60 w-60"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onResult('current')}
          className="rounded-full border-2 border-success/40 bg-success/10 px-4 py-2 text-sm font-bold text-success transition-all hover:bg-success/20"
        >
          الفريق الحالي جاوب
        </button>
        <button
          onClick={() => onResult('opponent')}
          className="rounded-full border-2 border-secondary/40 bg-secondary/10 px-4 py-2 text-sm font-bold text-secondary transition-all hover:bg-secondary/20"
        >
          الفريق الآخر جاوب
        </button>
        <button
          onClick={() => onResult('none')}
          className="rounded-full border-2 border-border/60 bg-muted/30 px-4 py-2 text-sm font-bold text-muted-foreground transition-all hover:bg-muted/50"
        >
          لم يجاوب أحد
        </button>
      </div>
    </div>
  );
}

/** Word Only plugin — AI-powered word generation + QR gameplay. */
export const wordOnlyPlugin: InteractionPlugin = {
  id: 'word-only',
  name: 'ولا كلمة (توليد تلقائي)',
  description:
    'الذكاء الاصطناعي يولّد الكلمات تلقائياً. اللاعب يمسح QR ليرى الكلمة على هاتفه فقط.',
  interactionType: 'qr',
  usesQR: true,
  defaultConfig: () => ({
    singleUse: true,
    expirationSeconds: 120,
    connectionTimeoutSeconds: 60,
  }),
  configSchema: () => [
    {
      key: 'singleUse',
      label: 'استخدام مرة واحدة',
      type: 'toggle',
      default: true,
      hint: 'كل رمز QR يُمسح مرة واحدة فقط',
    },
    {
      key: 'expirationSeconds',
      label: 'انتهاء صلاحية QR (ثانية)',
      type: 'number',
      default: 120,
      min: 10,
      max: 600,
    },
    {
      key: 'connectionTimeoutSeconds',
      label: 'انتهاء اتصال اللاعب (ثانية)',
      type: 'number',
      default: 60,
      min: 10,
      max: 600,
    },
  ],
  AdminExtra: WordOnlyAdminExtra,
  GameplayComponent: WordOnlyGameplay,
};

/** Pick a random unused word from a word-only dataset. Returns null if empty. */
export function pickWord(dataset: PluginDataset | undefined): string | null {
  if (!dataset || dataset.kind !== 'word-only') return null;
  const available = dataset.words.filter((w) => !dataset.usedWords.includes(w));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/** Mark a word as used in a word-only dataset. Returns the updated dataset. */
export function markWordUsed(
  dataset: PluginDataset | undefined,
  word: string
): PluginDataset {
  const ds = asWordDataset(dataset);
  if (!ds.usedWords.includes(word)) {
    return { ...ds, usedWords: [...ds.usedWords, word] };
  }
  return ds;
}
