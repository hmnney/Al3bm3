'use client';

import { useMemo } from 'react';
import {
  FolderCog,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Power,
} from 'lucide-react';
import { useSettings } from '../../_lib/settings-context';
import { useAdmin } from '../../_lib/admin-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { SettingsCard } from '../../_components/settings-card';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '@/lib/constants';

export default function CategoriesSettingsPage() {
  const { settings, update } = useSettings();
  const { data } = useAdmin();
  const { toast } = useToast();

  // Stable category list: seeded CATEGORIES enriched with any admin-created ones.
  const allCats = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string; glyph: string; gradient: string }> =
      CATEGORIES.map((c) => ({ id: c.id, name: c.name, glyph: c.glyph, gradient: c.gradient }));
    data.categories.forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        list.push({ id: c.id, name: c.name, glyph: c.glyph, gradient: c.gradient });
      }
    });
    return list;
  }, [data.categories]);

  // Resolve the effective order: settings.order first, then any not yet ordered.
  const ordered = useMemo(() => {
    const byId = new Map(allCats.map((c) => [c.id, c]));
    const result = settings.categories.order
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    allCats.forEach((c) => {
      if (!settings.categories.order.includes(c.id)) result.push(c);
    });
    return result;
  }, [allCats, settings.categories.order]);

  const move = (id: string, dir: -1 | 1) => {
    const ids = ordered.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    update({ categories: { ...settings.categories, order: ids } });
  };

  const toggleDisabled = (id: string) => {
    const has = settings.categories.disabled.includes(id);
    update({
      categories: {
        ...settings.categories,
        disabled: has
          ? settings.categories.disabled.filter((x) => x !== id)
          : [...settings.categories.disabled, id],
      },
    });
  };

  const toggleHidden = (id: string) => {
    const has = settings.categories.hidden.includes(id);
    update({
      categories: {
        ...settings.categories,
        hidden: has
          ? settings.categories.hidden.filter((x) => x !== id)
          : [...settings.categories.hidden, id],
      },
    });
    toast({
      title: has ? 'إظهار التصنيف' : 'إخفاء التصنيف',
      description: has ? 'سيظهر التصنيف في القائمة' : 'لن يظهر التصنيف في القائمة',
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="إدارة التصنيفات"
        subtitle="إعادة الترتيب والتغيير والإخفاء"
      />

      <SettingsCard
        title="ترتيب وحالة التصنيفات"
        description="استخدم الأسهم لإعادة الترتيب، والأيقونات للتغيير أو الإخفاء"
        icon={<FolderCog className="h-5 w-5" />}
      >
        <div className="flex flex-col gap-2">
          {ordered.map((c, idx) => {
            const disabled = settings.categories.disabled.includes(c.id);
            const hidden = settings.categories.hidden.includes(c.id);
            return (
              <div
                key={c.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border-2 p-3 transition-all',
                  hidden
                    ? 'border-border/30 bg-background/20 opacity-60'
                    : disabled
                      ? 'border-border/40 bg-background/30'
                      : 'border-border/50 bg-card/50'
                )}
              >
                <span className="w-6 text-center text-xs font-black text-muted-foreground">
                  {idx + 1}
                </span>
                <span className={cn('text-2xl', disabled && 'grayscale')}>{c.glyph}</span>
                <span
                  className={cn(
                    'flex-1 text-sm font-bold',
                    disabled || hidden ? 'text-muted-foreground' : 'text-foreground'
                  )}
                >
                  {c.name}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => move(c.id, -1)}
                    disabled={idx === 0}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                    aria-label="تحريك لأعلى"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => move(c.id, 1)}
                    disabled={idx === ordered.length - 1}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                    aria-label="تحريك لأسفل"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleDisabled(c.id)}
                    className={cn(
                      'rounded-lg p-1.5 transition-colors',
                      disabled
                        ? 'text-warning hover:bg-warning/10'
                        : 'text-success hover:bg-success/10'
                    )}
                    aria-label="تفعيل/تعطيل"
                    title={disabled ? 'مُعطّل' : 'مُفعّل'}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleHidden(c.id)}
                    className={cn(
                      'rounded-lg p-1.5 transition-colors',
                      hidden
                        ? 'text-muted-foreground hover:bg-primary/10'
                        : 'text-secondary hover:bg-secondary/10'
                    )}
                    aria-label="إخفاء/إظهار"
                    title={hidden ? 'مخفي' : 'مرئي'}
                  >
                    {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}
