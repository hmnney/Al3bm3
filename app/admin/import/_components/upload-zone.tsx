'use client';

import { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop upload area for Excel/CSV files. Click to browse, or drop a
 * file onto the zone. Shows the selected file name once chosen. Error-safe:
 * invalid file types are rejected with a local message, never thrown.
 */
export function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ACCEPT = ['.xlsx', '.xls', '.csv'];

  const validate = (file: File): string | null => {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ACCEPT.includes(ext)) {
      return 'صيغة الملف غير مدعومة. الرجاء رفع ملف Excel أو CSV.';
    }
    return null;
  };

  const handleFile = (file: File) => {
    const err = validate(file);
    if (err) {
      setError(err);
      setSelected(null);
      return;
    }
    setError(null);
    setSelected(file);
    onFile(file);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={cn(
          'group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 sm:p-16',
          dragging
            ? 'border-primary bg-primary/10 scale-[1.01]'
            : 'border-border/60 bg-card/40 hover:border-primary/50 hover:bg-primary/5',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg transition-transform group-hover:scale-110',
            dragging && 'scale-110'
          )}
        >
          <UploadCloud className="h-8 w-8" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-black text-foreground sm:text-xl">
            اسحب ملفك هنا أو اضغط للاختيار
          </span>
          <span className="text-sm text-muted-foreground">
            يدعم ملفات Excel (.xlsx) و CSV
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Selected file chip */}
      {selected && !error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">
                {selected.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {(selected.size / 1024).toFixed(1)} ك.ب
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setError(null);
            }}
            aria-label="إزالة"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
