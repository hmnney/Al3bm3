'use client';

import { useState } from 'react';
import { Users, Save } from 'lucide-react';
import { useSettings } from '../../_lib/settings-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { SettingsCard, SettingRow } from '../../_components/settings-card';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/lib/constants';

export default function TeamsSettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const [name1, setName1] = useState(settings.teams.defaultTeamNames[0]);
  const [name2, setName2] = useState(settings.teams.defaultTeamNames[1]);

  const toggleColor = (id: string) => {
    const has = settings.teams.availableColors.includes(id);
    const next = has
      ? settings.teams.availableColors.filter((x) => x !== id)
      : [...settings.teams.availableColors, id];
    update({ teams: { ...settings.teams, availableColors: next } });
  };

  const save = () => {
    update({
      teams: {
        ...settings.teams,
        defaultTeamNames: [name1.trim() || 'الفريق الأول', name2.trim() || 'الفريق الثاني'],
      },
    });
    toast({ title: 'تم الحفظ', description: 'حُفظت إعدادات الفرق بنجاح' });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="إعدادات الفرق"
        subtitle="أسماء الفرق الافتراضية والألوان المتاحة وعدد الفرق"
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
          title="أسماء الفرق الافتراضية"
          description="الأسماء التي تظهر عند بدء كل مباراة"
          icon={<Users className="h-5 w-5" />}
        >
          <SettingRow label="اسم الفريق الأول">
            <input
              value={name1}
              onChange={(e) => setName1(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </SettingRow>
          <SettingRow label="اسم الفريق الثاني">
            <input
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </SettingRow>
        </SettingsCard>

        <SettingsCard
          title="الألوان المتاحة"
          description="الألوان التي يمكن للفرق اختيارها"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TEAM_COLORS.map((c) => {
              const active = settings.teams.availableColors.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleColor(c.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-2 p-3 transition-all',
                    active
                      ? 'border-primary/60 bg-card/80'
                      : 'border-border/40 bg-background/30 opacity-50 hover:opacity-80'
                  )}
                >
                  <span
                    className={cn('h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br', c.gradient)}
                  />
                  <span className="text-sm font-bold text-foreground">{c.name}</span>
                </button>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard
          title="عدد الفرق الأقصى"
          description="ميزة مستقبلية — حالياً فريقان فقط"
        >
          <SettingRow
            label="الحد الأقصى للفرق"
            hint="يُستخدم مستقبلاً لدعم أكثر من فريقين"
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={2}
                max={6}
                value={settings.teams.maxTeams}
                onChange={(e) =>
                  update({
                    teams: { ...settings.teams, maxTeams: Number(e.target.value) },
                  })
                }
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="w-10 rounded-lg bg-primary/15 px-2 py-1 text-center text-sm font-black text-primary">
                {settings.teams.maxTeams}
              </span>
            </div>
          </SettingRow>
        </SettingsCard>
      </div>
    </div>
  );
}
