'use client';

import {
  Volume2,
  VolumeX,
  Music,
  Music2,
  Timer,
  ShieldQuestion,
  Repeat,
  ListChecks,
  Maximize2,
  Minimize2,
  Moon,
} from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHeader } from '@/components/layout/section-header';
import { BackButton } from '@/components/layout/back-button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useGame } from '@/components/providers/game-provider';
import { TIMER_PRESETS } from '@/lib/game';
import { cn } from '@/lib/utils';
import type { TimerPresetSeconds } from '@/lib/types';

interface SettingRowProps {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onToggle,
  disabled,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur transition-all hover:border-primary/30',
        disabled && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient-soft text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-label={title}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { state, updateSettings } = useGame();
  const { settings } = state;

  return (
    <PageShell>
      <div className="mb-8 flex items-center justify-between">
        <BackButton href="/" />
      </div>

      <SectionHeader
        title="الإعدادات"
        subtitle="تحكموا في تجربة اللعب — تُحفظ الإعدادات تلقائياً على الجهاز"
      />

      <div className="mx-auto mt-10 flex w-full max-w-2xl flex-col gap-6">
        {/* ---- Question time presets ---- */}
        <section className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient-soft text-primary">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                وقت السؤال
              </h3>
              <p className="text-sm text-muted-foreground">
                المدة الافتراضية للمؤقت في كل سؤال جديد
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {TIMER_PRESETS.map((sec) => {
              const active = settings.perQuestionSeconds === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() =>
                    updateSettings({ perQuestionSeconds: sec as TimerPresetSeconds })
                  }
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-4 font-black transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'border-primary bg-primary/15 text-primary glow-primary'
                      : 'border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  <span className="text-2xl tabular-nums">{sec}</span>
                  <span className="text-xs font-semibold">ثانية</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ---- Gameplay toggles ---- */}
        <section className="flex flex-col gap-4">
          <h4 className="px-1 text-sm font-bold text-muted-foreground">
            خيارات اللعب
          </h4>
          <ToggleRow
            icon={ShieldQuestion}
            title="تأكيد إنهاء المباراة"
            description="إظهار نافذة تأكيد قبل الخروج من المباراة"
            checked={settings.confirmEndMatch}
            onToggle={(v) => updateSettings({ confirmEndMatch: v })}
          />
          <ToggleRow
            icon={Repeat}
            title="تبديل الدور تلقائياً"
            description="تبديل الفريق تلقائياً بعد كل سؤال"
            checked={settings.autoSwitchTurn}
            onToggle={(v) => updateSettings({ autoSwitchTurn: v })}
          />
          <ToggleRow
            icon={ListChecks}
            title="عدّاد الأسئلة المكتملة"
            description="إظهار عدّاد الأسئلة المنجزة في رأس اللوحة"
            checked={settings.showCompletedCounter}
            onToggle={(v) => updateSettings({ showCompletedCounter: v })}
          />
        </section>

        {/* ---- Timer display toggles ---- */}
        <section className="flex flex-col gap-4">
          <h4 className="px-1 text-sm font-bold text-muted-foreground">
            شكل المؤقت
          </h4>
          <ToggleRow
            icon={Maximize2}
            title="مؤقت كبير"
            description="إظهار المؤقت بحجم كبير داخل نافذة السؤال"
            checked={settings.largeTimer}
            onToggle={(v) => updateSettings({ largeTimer: v })}
          />
          <ToggleRow
            icon={Minimize2}
            title="مؤقت مختصر"
            description="إظهار المؤقت بشكل مختصر وأصغر"
            checked={!settings.largeTimer}
            onToggle={(v) => updateSettings({ largeTimer: !v })}
          />
        </section>

        {/* ---- Appearance ---- */}
        <section className="flex flex-col gap-4">
          <h4 className="px-1 text-sm font-bold text-muted-foreground">
            المظهر
          </h4>
          <ToggleRow
            icon={Moon}
            title="الوضع الداكن"
            description="ميزة قادمة — الوضع الداكن للتطبيق"
            checked={settings.darkMode}
            onToggle={(v) => updateSettings({ darkMode: v })}
            disabled
          />
        </section>

        {/* ---- Audio ---- */}
        <section className="flex flex-col gap-4">
          <h4 className="px-1 text-sm font-bold text-muted-foreground">
            الصوت
          </h4>
          <ToggleRow
            icon={settings.soundEnabled ? Volume2 : VolumeX}
            title="المؤثرات الصوتية"
            description="أصوات الأزرار والإجابات الصحيحة (ميزة قادمة)"
            checked={settings.soundEnabled}
            onToggle={(v) => updateSettings({ soundEnabled: v })}
          />
          <ToggleRow
            icon={settings.musicEnabled ? Music : Music2}
            title="الموسيقى الخلفية"
            description="موسيقى خفيفة أثناء المباراة (ميزة قادمة)"
            checked={settings.musicEnabled}
            onToggle={(v) => updateSettings({ musicEnabled: v })}
          />
        </section>

        <p className="mt-2 text-center text-xs text-muted-foreground/70">
          تُحفظ الإعدادات على هذا الجهاز وتبقى محفوظة عند إعادة فتح الموقع
        </p>
      </div>
    </PageShell>
  );
}
