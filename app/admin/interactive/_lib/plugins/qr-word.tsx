'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  UploadCloud,
  FileDown,
  Loader2,
  Trash2,
  QrCode,
  AlertCircle,
  CheckCircle2,
  X,
  Maximize2,
  Hash,
} from 'lucide-react';
import type {
  InteractionPlugin,
  PluginConfig,
  PluginDataset,
} from '../types';
import type { InteractiveCategory } from '../types';
import { useInteractive } from '../interactive-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  parseCharadesExcel,
  downloadCharadesTemplate,
  type CharadesRow,
} from '@/lib/excel-import';
import { generateAndUploadQr } from '@/lib/qr-generator';

// ============================================================
// Dataset helpers
// ============================================================

export interface QrWordEntry {
  word: string;
  points: number;
  qrUrl: string;
}

function asQrWordDataset(
  dataset: PluginDataset | undefined
): { kind: 'qr-word'; entries: QrWordEntry[]; usedWords: string[] } {
  if (dataset && dataset.kind === 'qr-word') return dataset;
  return { kind: 'qr-word', entries: [], usedWords: [] };
}

// ============================================================
// AdminExtra — Excel import + QR generation panel
// ============================================================

function QrWordAdminExtra({
  category,
  onUpdateDataset,
}: {
  category: InteractiveCategory;
  onUpdate: (config: PluginConfig) => void;
  onUpdateDataset: (dataset: PluginDataset) => void;
}) {
  const { updateDataset } = useInteractive();
  const { toast } = useToast();
  const dataset = asQrWordDataset(category.dataset);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stats, setStats] = useState<{
    imported: number;
    skippedDuplicates: number;
    failed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = dataset.entries.length - dataset.usedWords.length;

  // Group by points for display
  const byPoints: Record<number, QrWordEntry[]> = { 250: [], 500: [], 750: [] };
  for (const e of dataset.entries) {
    const bucket = byPoints[e.points] ?? (byPoints[e.points] = []);
    bucket.push(e);
  }

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.xlsx$/i)) {
      toast({
        title: 'نوع ملف غير صحيح',
        description: 'الرجاء اختيار ملف Excel بصيغة .xlsx',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setStats(null);

    try {
      const result = await parseCharadesExcel(file);
      const existing = new Set(
        dataset.entries.map((e) => e.word.toLowerCase())
      );

      const finalStats = { imported: 0, skippedDuplicates: 0, failed: 0 };
      const newEntries: QrWordEntry[] = [];

      for (const row of result.rows) {
        if (existing.has(row.word.toLowerCase())) {
          finalStats.skippedDuplicates++;
          continue;
        }
        existing.add(row.word.toLowerCase());

        try {
          const qrResult = await generateAndUploadQr(row.word);
          newEntries.push({
            word: row.word,
            points: row.points,
            qrUrl: qrResult.url,
          });
          finalStats.imported++;
        } catch {
          finalStats.failed++;
        }
      }

      finalStats.skippedDuplicates += result.skippedDuplicates;

      const merged = [...dataset.entries, ...newEntries];
      onUpdateDataset({
        kind: 'qr-word',
        entries: merged,
        usedWords: dataset.usedWords,
      });

      setStats(finalStats);

      toast({
        title: 'اكتمل الاستيراد',
        description: `Imported: ${finalStats.imported} · Skipped: ${finalStats.skippedDuplicates} · Failed: ${finalStats.failed}`,
      });
    } catch (e) {
      toast({
        title: 'فشل الاستيراد',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      void handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteEntry = (word: string) => {
    onUpdateDataset({
      kind: 'qr-word',
      entries: dataset.entries.filter((e) => e.word !== word),
      usedWords: dataset.usedWords.filter((w) => w !== word),
    });
  };

  const handleClearAll = () => {
    onUpdateDataset({ kind: 'qr-word', entries: [], usedWords: [] });
    setStats(null);
  };

  const handleDownloadTemplate = () => {
    downloadCharadesTemplate();
    toast({ title: 'تم تحميل القالب', description: 'charades-template.xlsx' });
  };

  const handleResetUsed = () => {
    onUpdateDataset({
      kind: 'qr-word',
      entries: dataset.entries,
      usedWords: [],
    });
    toast({ title: 'تمت إعادة تعيين الكلمات المستخدمة' });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="إجمالي الكلمات" value={dataset.entries.length} tone="primary" />
        <StatBox label="المتبقي" value={remaining} tone="success" />
        <StatBox label="المستخدم" value={dataset.usedWords.length} tone="muted" />
      </div>

      {/* Import zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border/50 bg-card/30 hover:border-primary/40 hover:bg-card/50'
        )}
        onClick={() => !importing && fileInputRef.current?.click()}
      >
        {importing ? (
          <>
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-bold text-foreground">
              جاري الاستيراد وإنشاء QR Codes...
            </p>
          </>
        ) : (
          <>
            <UploadCloud
              className={cn(
                'mb-2 h-8 w-8',
                dragging ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <p className="text-sm font-bold text-foreground">
              {dragging ? 'أفلت ملف Excel هنا' : 'اسحب ملف .xlsx أو انقر للاختيار'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              التنسيق: عمود &quot;word&quot; وعمود &quot;points&quot;
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={onFileSelect}
      />

      {/* Template download */}
      <button
        onClick={handleDownloadTemplate}
        className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-foreground transition-all hover:border-primary/40"
      >
        <FileDown className="h-4 w-4" />
        تحميل قالب Excel
      </button>

      {/* Import stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Imported" value={stats.imported} tone="success" />
          <StatBox
            label="Skipped duplicates"
            value={stats.skippedDuplicates}
            tone="warning"
          />
          <StatBox label="Failed" value={stats.failed} tone="error" />
        </div>
      )}

      {/* Words list */}
      {dataset.entries.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-foreground">
              الكلمات المحفوظة ({dataset.entries.length})
            </span>
            <div className="flex gap-2">
              {dataset.usedWords.length > 0 && (
                <button
                  onClick={handleResetUsed}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-all hover:text-foreground"
                >
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

          {([250, 500, 750] as const).map((pts) => {
            const items = byPoints[pts];
            if (!items || items.length === 0) return null;
            return (
              <div key={pts}>
                <div className="mb-2 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground">
                    {pts} نقطة ({items.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((entry) => {
                    const isUsed = dataset.usedWords.includes(entry.word);
                    return (
                      <div
                        key={entry.word}
                        className={cn(
                          'group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all',
                          isUsed
                            ? 'border-border/30 bg-muted/20 text-muted-foreground line-through'
                            : 'border-primary/30 bg-primary/10 text-foreground'
                        )}
                      >
                        {isUsed && (
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.qrUrl}
                          alt={`QR: ${entry.word}`}
                          className="h-6 w-6 rounded object-contain"
                        />
                        {entry.word}
                        <button
                          onClick={() => handleDeleteEntry(entry.word)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/40 bg-card/20 py-10 text-center">
          <QrCode className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            لا توجد كلمات بعد — استورد ملف Excel للبدء
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
  tone: 'primary' | 'success' | 'muted' | 'warning' | 'error';
}) {
  const tones = {
    primary: 'border-primary/30 bg-primary/10 text-primary',
    success: 'border-success/30 bg-success/10 text-success',
    muted: 'border-border/40 bg-muted/20 text-muted-foreground',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
  };
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3',
        tones[tone]
      )}
    >
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}

// ============================================================
// GameplayComponent — QR-only display with fullscreen + timer
// ============================================================

function QrWordGameplay({
  category,
  onResult,
  timerSeconds = 60,
  largeTimer = false,
}: {
  category: InteractiveCategory;
  sessionUrl: string;
  onResult: (result: 'current' | 'opponent' | 'none') => void;
  timerSeconds?: number;
  largeTimer?: boolean;
}) {
  const dataset = asQrWordDataset(category.dataset);
  const [pickedEntry, setPickedEntry] = useState<QrWordEntry | null>(null);
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [seconds, setSeconds] = useState(timerSeconds);
  const [running, setRunning] = useState(false);

  // Pick a random unused word on mount
  useEffect(() => {
    const available = dataset.entries.filter(
      (e) => !dataset.usedWords.includes(e.word)
    );
    if (available.length > 0) {
      const picked = available[Math.floor(Math.random() * available.length)];
      setPickedEntry(picked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer ticking
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Stop at zero + auto-reveal
  useEffect(() => {
    if (seconds === 0) {
      setRunning(false);
      setRevealed(true);
    }
  }, [seconds]);

  // When QR fullscreen closes, start the timer
  const handleCloseFullscreen = () => {
    setQrFullscreen(false);
    if (!timerStarted) {
      setTimerStarted(true);
      setRunning(true);
    }
  };

  if (!pickedEntry) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <AlertCircle className="h-10 w-10 text-amber-500" />
        <p className="text-lg font-black text-foreground">
          لا توجد كلمات متبقية في هذا التصنيف
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

  const timerColor = seconds <= 10 ? 'text-destructive' : 'text-foreground';
  const timerWarn = seconds <= 10;

  return (
    <div className="flex h-full flex-col">
      {/* Timer bar */}
      {timerStarted && (
        <div className="flex items-center justify-center gap-2 border-b border-border/60 py-3">
          <span
            className={cn(
              'font-black tabular-nums tracking-tight',
              largeTimer ? 'text-4xl' : 'text-3xl',
              timerColor,
              timerWarn && 'animate-pulse'
            )}
          >
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:
            {String(seconds % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center">
        {!revealed ? (
          <>
            {/* QR Code — the ONLY thing shown */}
            <div className="overflow-hidden rounded-2xl border-2 border-border/60 bg-white p-4 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pickedEntry.qrUrl}
                alt="QR Code"
                className="h-48 w-48 object-contain"
              />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              امسح الرمز ثم مثّل الكلمة لفريقك
            </p>

            {/* Fullscreen button */}
            <button
              onClick={() => setQrFullscreen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90"
            >
              <Maximize2 className="h-4 w-4" />
              عرض QR بملء الشاشة
            </button>

            {timerStarted && seconds > 0 && (
              <p className="text-xs text-muted-foreground">
                الإجابة تظهر تلقائياً عند انتهاء الوقت
              </p>
            )}
          </>
        ) : (
          <div className="flex w-full max-w-3xl flex-col items-center gap-6 animate-scale-in">
            <div className="w-full rounded-2xl border-2 border-success/40 bg-success/10 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-wider text-success">
                الإجابة
              </p>
              <p className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                {pickedEntry.word}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen QR overlay */}
      {qrFullscreen && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pickedEntry.qrUrl}
            alt="QR Code Fullscreen"
            className="h-[70vh] w-[70vh] object-contain"
          />
          <button
            onClick={handleCloseFullscreen}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-base font-bold text-background shadow-lg transition-all hover:opacity-90"
          >
            <X className="h-5 w-5" />
            إغلاق وبدء المؤقت
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Plugin definition
// ============================================================

export const qrWordPlugin: InteractionPlugin = {
  id: 'qr-word',
  name: 'ولا كلمة (استيراد Excel)',
  description:
    'استورد كلمات من Excel — يتم إنشاء QR Code لكل كلمة تلقائياً. الشاشة الرئيسية لا تظهر الكلمة أبداً.',
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
      hint: 'كل كلمة تُستخدم مرة واحدة فقط',
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
  AdminExtra: QrWordAdminExtra,
  GameplayComponent: QrWordGameplay,
};

// ============================================================
// Helpers exported for the board
// ============================================================

/** Pick a random unused word from a qr-word dataset. Returns null if empty. */
export function pickQrWord(
  dataset: PluginDataset | undefined
): QrWordEntry | null {
  if (!dataset || dataset.kind !== 'qr-word') return null;
  const available = dataset.entries.filter(
    (e) => !dataset.usedWords.includes(e.word)
  );
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/** Mark a word as used in a qr-word dataset. Returns the updated dataset. */
export function markQrWordUsed(
  dataset: PluginDataset | undefined,
  word: string
): PluginDataset {
  const ds = asQrWordDataset(dataset);
  if (!ds.usedWords.includes(word)) {
    return { ...ds, usedWords: [...ds.usedWords, word] };
  }
  return ds;
}
