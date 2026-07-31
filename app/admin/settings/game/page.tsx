'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sliders, Save, RotateCcw, Cloud } from 'lucide-react';
import { useSettings } from '../../_lib/settings-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { SettingsCard, SettingRow } from '../../_components/settings-card';
import { cn } from '@/lib/utils';
import type { PointValue } from '@/lib/types';

const POINT_OPTIONS: PointValue[] = [250, 500, 750];

export default function GameSettingsPage() {
  const { settings, update, resetAll } = useSettings();
  const { toast } = useToast();
  const [name, setName] = useState(settings.game.defaultGameName);
  const [subtitle, setSubtitle] = useState(settings.game.defaultSubtitle);
  const [catCount, setCatCount] = useState(settings.game.defaultNumberOfCategories);

  const togglePoint = (p: PointValue) => {
    const has = settings.game.defaultPoints.includes(p);
    const next = has
      ? settings.game.defaultPoints.filter((x) => x !== p)
      : [...settings.game.defaultPoints, p].sort((a, b) => a - b);
    update({ game: { ...settings.game, defaultPoints: next } });
  };

  const save = () => {
    update({
      game: {
        ...settings.game,
        defaultGameName: name.trim() || 'عب مع شلتك',
        defaultSubtitle: subtitle.trim(),
        defaultNumberOfCategories: Math.max(1, Math.min(12, catCount)),
        defaultPoints: settings.game.defaultPoints.length
          ? settings.game.defaultPoints
          : [250, 500, 750],
      },
    });
    toast({ title: 'تم الحفظ', description: 'حُفظت إعدادات اللعبة بنجاح' });
  };

  const reset = () => {
    resetAll();
    setName('عب مع شلتك');
    setSubtitle('لعبة الأصدقاء التفاعلية');
    setCatCount(6);
    toast({ title: 'تمت الاستعادة', description: 'عادت الإعدادات الافتراضية' });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="إعدادات اللعبة"
        subtitle="الاسم والعنوان الافتراضي وعدد التصنيفات والنقاط"
        actions={
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              استعادة
            </button>
            <button
              onClick={save}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              حفظ
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        <SettingsCard
          title="الهوية الافتراضية"
          description="الاسم والعنوان اللذان يظهران في أنحاء اللعبة"
          icon={<Sliders className="h-5 w-5" />}
        >
          <SettingRow label="اسم اللعبة الافتراضي" hint="يظهر في الواجهة الرئيسية">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </SettingRow>
          <SettingRow label="العنوان الفرعي الافتراضي" hint="وصف قصير تحت الاسم">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </SettingRow>
        </SettingsCard>

        <SettingsCard
          title="التصنيفات والنقاط"
          description="عدد التصنيفات الافتراضي ونقاط اللوحة"
        >
          <SettingRow
            label="عدد التصنيفات الافتراضي"
            hint="بين 1 و 12"
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={12}
                value={catCount}
                onChange={(e) => setCatCount(Number(e.target.value))}
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="w-10 rounded-lg bg-primary/15 px-2 py-1 text-center text-sm font-black text-primary">
                {catCount}
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label="النقاط الافتراضية"
            hint="قيم النقاط المفعّلة على اللوحة"
          >
            <div className="flex gap-2">
              {POINT_OPTIONS.map((p) => {
                const active = settings.game.defaultPoints.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePoint(p)}
                    className={cn(
                      'flex-1 rounded-lg border-2 px-3 py-2 text-sm font-black transition-all',
                      active
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </SettingRow>
        </SettingsCard>

        <Link
          href="/admin/settings/cloud-debug"
          className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-border/50 bg-card/30 p-5 backdrop-blur transition-all hover:border-primary/40 hover:bg-card/50"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-base font-black text-foreground">
              Cloud Debug
            </span>
            <span className="text-sm text-muted-foreground">
              فحص اتصال قاعدة البيانات والسحابة
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
