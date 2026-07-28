'use client';

import { useState } from 'react';
import { Timer, Plus, Trash2, Save } from 'lucide-react';
import { useSettings } from '../../_lib/settings-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { SettingsCard, SettingRow } from '../../_components/settings-card';
import { cn } from '@/lib/utils';

const BUILTIN = [30, 45, 60, 90, 120];

export default function TimerSettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const [customInput, setCustomInput] = useState('');

  const addCustom = () => {
    const sec = Number(customInput);
    if (!sec || sec < 5 || sec > 600) {
      toast({ title: 'قيمة غير صالحة', description: 'أدخل قيمة بين 5 و 600 ثانية', variant: 'destructive' });
      return;
    }
    if (settings.timer.customPresets.includes(sec)) {
      toast({ title: 'موجود مسبقاً', description: 'هذا المؤقت المخصص مضاف بالفعل' });
      return;
    }
    update({
      timer: {
        ...settings.timer,
        customPresets: [...settings.timer.customPresets, sec].sort((a, b) => a - b),
      },
    });
    setCustomInput('');
    toast({ title: 'تمت الإضافة', description: `أُضيف مؤقت ${sec} ثانية` });
  };

  const removeCustom = (sec: number) => {
    update({
      timer: {
        ...settings.timer,
        customPresets: settings.timer.customPresets.filter((x) => x !== sec),
        defaultPreset:
          settings.timer.defaultPreset === sec ? 45 : settings.timer.defaultPreset,
      },
    });
  };

  const setDefault = (sec: number) => {
    update({ timer: { ...settings.timer, defaultPreset: sec } });
  };

  const save = () => {
    toast({ title: 'تم الحفظ', description: 'حُفظت إعدادات المؤقت بنجاح' });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="إعدادات المؤقت"
        subtitle="مؤقتات اللعب الجاهزة والمخصصة"
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
          title="المؤقتات الجاهزة"
          description="المؤقتات القياسية المتاحة دائماً"
          icon={<Timer className="h-5 w-5" />}
        >
          <SettingRow label="اختر المؤقت الافتراضي" hint="المؤقت الذي يبدأ به كل سؤال">
            <div className="grid grid-cols-5 gap-2">
              {BUILTIN.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setDefault(sec)}
                  className={cn(
                    'rounded-lg border-2 px-2 py-2 text-sm font-black transition-all',
                    settings.timer.defaultPreset === sec
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {sec}
                </button>
              ))}
            </div>
          </SettingRow>
        </SettingsCard>

        <SettingsCard
          title="مؤقتات مخصصة"
          description="أنشئ مؤقتاتك الخاصة لتناسب شلتك"
        >
          <SettingRow label="إضافة مؤقت مخصص" hint="بالثواني (5 إلى 600)">
            <div className="flex gap-2">
              <input
                type="number"
                min={5}
                max={600}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="مثال: 75"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <button
                onClick={addCustom}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                إضافة
              </button>
            </div>
          </SettingRow>

          {settings.timer.customPresets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {settings.timer.customPresets.map((sec) => (
                <div
                  key={sec}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all',
                    settings.timer.defaultPreset === sec
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 bg-background/40 text-foreground'
                  )}
                >
                  <button onClick={() => setDefault(sec)} className="text-sm font-black">
                    {sec} ث
                  </button>
                  <button
                    onClick={() => removeCustom(sec)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {settings.timer.customPresets.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              لا توجد مؤقتات مخصصة بعد.
            </p>
          )}
        </SettingsCard>
      </div>
    </div>
  );
}
