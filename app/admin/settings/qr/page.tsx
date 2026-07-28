'use client';

import { QrCode, Save } from 'lucide-react';
import { useSettings } from '../../_lib/settings-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { SettingsCard, SettingRow } from '../../_components/settings-card';
import { QR_STYLE_LABELS } from '../../_lib/settings-types';
import { cn } from '@/lib/utils';
import type { QRSettingsData } from '../../_lib/settings-types';

export default function QRSettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const qr = settings.qr;

  const set = (patch: Partial<QRSettingsData>) =>
    update({ qr: { ...qr, ...patch } });

  const save = () => {
    toast({ title: 'تم الحفظ', description: 'حُفظت إعدادات QR بنجاح' });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="إعدادات QR"
        subtitle="إعدادات تصنيف «ولا كلمة» — معزولة ومستقلة"
        actions={
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            حفظ
          </button>
        }
      />

      <div className="flex flex-col gap-5">
        <SettingsCard
          title="تصنيف «ولا كلمة»"
          description="مُعدّ مسبقاً لدمج تصنيف يعتمد على رموز QR مستقبلاً"
          icon={<QrCode className="h-5 w-5" />}
        >
          <SettingRow
            label="انتهاء صلاحية QR"
            hint="عدد الدقائق قبل انتهاء صلاحية الرمز"
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={60}
                value={qr.expirationTime}
                onChange={(e) => set({ expirationTime: Number(e.target.value) })}
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="w-14 rounded-lg bg-primary/15 px-2 py-1 text-center text-sm font-black text-primary">
                {qr.expirationTime} د
              </span>
            </div>
          </SettingRow>

          <SettingRow label="نمط QR" hint="الشكل البصري للرمز">
            <div className="flex gap-2">
              {(Object.keys(QR_STYLE_LABELS) as QRSettingsData['style'][]).map((s) => (
                <button
                  key={s}
                  onClick={() => set({ style: s })}
                  className={cn(
                    'flex-1 rounded-lg border-2 px-3 py-2 text-sm font-bold transition-all',
                    qr.style === s
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {QR_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="حجم QR" hint="حجم الرمز بالبكسل">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={128}
                max={512}
                step={32}
                value={qr.size}
                onChange={(e) => set({ size: Number(e.target.value) })}
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="w-16 rounded-lg bg-primary/15 px-2 py-1 text-center text-sm font-black text-primary">
                {qr.size}px
              </span>
            </div>
          </SettingRow>

          <SettingRow label="استخدام مرة واحدة" hint="كل رمز يُمسح مرة واحدة فقط">
            <button
              onClick={() => set({ singleUse: !qr.singleUse })}
              className={cn(
                'relative h-7 w-12 rounded-full transition-colors',
                qr.singleUse ? 'bg-primary' : 'bg-muted'
              )}
              aria-pressed={qr.singleUse}
            >
              <span
                className={cn(
                  'absolute top-1 h-5 w-5 rounded-full bg-white transition-all',
                  qr.singleUse ? 'right-1' : 'right-6'
                )}
              />
            </button>
          </SettingRow>
        </SettingsCard>
      </div>
    </div>
  );
}
