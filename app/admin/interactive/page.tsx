'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Puzzle,
  Plus,
  Pencil,
  Trash2,
  QrCode,
  Check,
  X,
  Power,
  Database,
} from 'lucide-react';
import {
  INTERACTION_TYPE_LABELS,
  INTERACTION_TYPE_ICONS,
  getPlugin,
  getPluginsByType,
  registerAllPlugins,
  useInteractive,
} from './_lib';
import type {
  InteractionType,
  InteractiveCategory,
  PluginConfig,
} from './_lib';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../_components/admin-page-header';
import { QRSessionPanel } from './_components/qr-session-panel';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

// Ensure all plugins are registered once.
registerAllPlugins();

const TYPES = Object.keys(INTERACTION_TYPE_LABELS) as InteractionType[];

function typeIcon(name: string) {
  return (LucideIcons as unknown as Record<string, React.ElementType>)[name] ?? LucideIcons.Circle;
}

export default function InteractiveCategoriesPage() {
  const { categories, ready, addCategory, updateCategory, deleteCategory } =
    useInteractive();
  const { toast } = useToast();
  const [editing, setEditing] = useState<InteractiveCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Keep the selected category fresh from context so dataset edits reflect live.
  const selected = useMemo(
    () => categories.find((c) => c.id === selectedId) ?? null,
    [categories, selectedId]
  );

  const handleAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (cat: InteractiveCategory) => {
    setEditing(cat);
    setShowForm(true);
  };

  const handleDelete = (cat: InteractiveCategory) => {
    deleteCategory(cat.id);
    toast({ title: 'تم الحذف', description: `حُذف "${cat.name}"` });
  };

  const handleToggle = (cat: InteractiveCategory) => {
    updateCategory(cat.id, { enabled: !cat.enabled });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="التصنيفات التفاعلية"
        subtitle="محرك تفاعلي عام يدعم تصنيفات تفاعلية غير محدودة"
        actions={
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            إضافة تصنيف
          </button>
        }
      />

      {/* Plugin architecture banner */}
      <div className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg">
          <Puzzle className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black text-foreground">
            بنية الإضافات (Plugin Architecture)
          </span>
          <span className="text-xs text-muted-foreground">
            كل تفاعل يسجل نفسه عبر المحرك — أضف إضافة جديدة دون تغيير المحرك
          </span>
        </div>
      </div>

      {!ready ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border-2 border-border/40 bg-card/30" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/40 bg-card/20 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg">
            <Plus className="h-8 w-8" />
          </div>
          <span className="text-sm text-muted-foreground">
            لا توجد تصنيفات تفاعلية بعد — ابدأ بإضافة واحدة
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              onEdit={() => handleEdit(cat)}
              onDelete={() => handleDelete(cat)}
              onToggle={() => handleToggle(cat)}
              onManage={() => setSelectedId(cat.id)}
            />
          ))}
        </div>
      )}

      {selected && (
        <CategoryDetail
          category={selected}
          onClose={() => setSelectedId(null)}
        />
      )}

      {showForm && (
        <CategoryFormModal
          category={editing}
          onClose={() => setShowForm(false)}
          onSave={(data) => {
            if (editing) {
              updateCategory(editing.id, data);
              toast({ title: 'تم الحفظ', description: 'حُفظت التعديلات' });
            } else {
              addCategory({ ...data, enabled: true });
              toast({ title: 'تمت الإضافة', description: 'أُضيف التصنيف التفاعلي' });
            }
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function CategoryCard({
  category,
  onEdit,
  onDelete,
  onToggle,
  onManage,
}: {
  category: InteractiveCategory;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onManage: () => void;
}) {
  const plugin = getPlugin(category.pluginId);
  const Icon = typeIcon(INTERACTION_TYPE_ICONS[category.interactionType]);
  const usesQR = plugin?.usesQR;
  const hasAdminExtra = !!plugin?.AdminExtra;
  const hasDataset = !!category.dataset;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border-2 p-5 backdrop-blur transition-all',
        category.enabled
          ? 'border-border/50 bg-card/50 hover:border-primary/30'
          : 'border-border/30 bg-background/20 opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="text-lg font-black text-foreground">{category.name}</h3>
          <p className="text-sm text-muted-foreground">{category.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-black text-primary">
          {INTERACTION_TYPE_LABELS[category.interactionType]}
        </span>
      </div>

      {plugin && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md bg-secondary/15 px-2 py-1 font-bold text-secondary">
            إضافة: {plugin.name}
          </span>
          {usesQR && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 font-bold text-amber-500">
              <QrCode className="h-3 w-3" />
              يستخدم QR
            </span>
          )}
          {hasDataset && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 font-bold text-emerald-500">
              <Database className="h-3 w-3" />
              بيانات
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {hasAdminExtra && (
          <button
            onClick={onManage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20"
          >
            <Database className="h-3.5 w-3.5" />
            إدارة البيانات
          </button>
        )}
        {usesQR && !hasAdminExtra && (
          <button
            onClick={onManage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20"
          >
            <QrCode className="h-3.5 w-3.5" />
            لوحة QR
          </button>
        )}
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs font-bold text-foreground transition-all hover:border-primary/50 hover:bg-primary/10"
        >
          <Pencil className="h-3.5 w-3.5" />
          تعديل
        </button>
        <button
          onClick={onToggle}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all',
            category.enabled
              ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
              : 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
          )}
        >
          <Power className="h-3.5 w-3.5" />
          {category.enabled ? 'مُفعّل' : 'معطّل'}
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive transition-all hover:bg-destructive/15"
        >
          <Trash2 className="h-3.5 w-3.5" />
          حذف
        </button>
      </div>
    </div>
  );
}

function CategoryDetail({
  category,
  onClose,
}: {
  category: InteractiveCategory;
  onClose: () => void;
}) {
  const plugin = getPlugin(category.pluginId);
  const { updateConfig, updateDataset } = useInteractive();
  const Icon = typeIcon(INTERACTION_TYPE_ICONS[category.interactionType]);

  const AdminExtra = plugin?.AdminExtra;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border-2 border-border/50 bg-card/95 p-6 backdrop-blur-xl scrollbar-thin">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-foreground">{category.name}</h2>
              <span className="text-xs text-muted-foreground">
                {INTERACTION_TYPE_LABELS[category.interactionType]} · {plugin?.name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-card/80 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Plugin AdminExtra (e.g. AI word generation panel) */}
        {AdminExtra && (
          <div className="mb-6">
            <AdminExtra
              category={category}
              onUpdate={(config) => updateConfig(category.id, config)}
              onUpdateDataset={(dataset) => updateDataset(category.id, dataset)}
            />
          </div>
        )}

        {/* QR session panel for plugins that use QR */}
        {plugin?.usesQR && <QRSessionPanel category={category} />}

        {!AdminExtra && !plugin?.usesQR && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              هذا النوع من التفاعل لا يستخدم QR — تُدار إعداداته من صفحة التعديل.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryFormModal({
  category,
  onClose,
  onSave,
}: {
  category: InteractiveCategory | null;
  onClose: () => void;
  onSave: (data: Omit<InteractiveCategory, 'id' | 'enabled'>) => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [interactionType, setInteractionType] = useState<InteractionType>(
    category?.interactionType ?? 'qr'
  );
  const [pluginId, setPluginId] = useState<string>(
    category?.pluginId ?? 'wordless'
  );
  const [config, setConfig] = useState<PluginConfig>(category?.config ?? {});

  const plugins = useMemo(() => getPluginsByType(interactionType), [interactionType]);
  const plugin = getPlugin(pluginId);

  // When interaction type changes, pick the first available plugin + its defaults.
  useEffect(() => {
    if (plugins.length && !plugins.some((p) => p.id === pluginId)) {
      const first = plugins[0];
      setPluginId(first.id);
      setConfig(first.defaultConfig());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionType]);

  // When plugin changes, load its default config if switching to a new plugin.
  useEffect(() => {
    const p = getPlugin(pluginId);
    if (p && (!category || category.pluginId !== pluginId)) {
      setConfig(p.defaultConfig());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      interactionType,
      pluginId,
      config,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-2 border-border/50 bg-card/95 p-6 backdrop-blur-xl scrollbar-thin">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-foreground">
            {category ? 'تعديل تصنيف تفاعلي' : 'إضافة تصنيف تفاعلي'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-card/80 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Name + description */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="الاسم">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="الوصف">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </FormField>
          </div>

          {/* Interaction type */}
          <div>
            <span className="mb-2 block text-sm font-bold text-foreground">نوع التفاعل</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TYPES.map((t) => {
                const Icon = typeIcon(INTERACTION_TYPE_ICONS[t]);
                const active = interactionType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setInteractionType(t)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-xs font-bold transition-all',
                      active
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {INTERACTION_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plugin selector */}
          {plugins.length > 0 && (
            <div>
              <span className="mb-2 block text-sm font-bold text-foreground">الإضافة</span>
              <div className="flex flex-wrap gap-2">
                {plugins.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPluginId(p.id)}
                    className={cn(
                      'rounded-lg border-2 px-3 py-2 text-sm font-bold transition-all',
                      pluginId === p.id
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              {plugin && (
                <p className="mt-1 text-xs text-muted-foreground">{plugin.description}</p>
              )}
            </div>
          )}

          {/* Plugin config fields */}
          {plugin && plugin.configSchema().length > 0 && (
            <div className="rounded-xl border border-border/40 bg-background/40 p-4">
              <span className="mb-3 block text-sm font-black text-foreground">
                إعدادات الإضافة
              </span>
              <div className="flex flex-col gap-3">
                {plugin.configSchema().map((field) => (
                  <ConfigField
                    key={field.key}
                    field={field}
                    value={config[field.key] ?? field.default}
                    onChange={(v) => setConfig((c) => ({ ...c, [field.key]: v }))}
                  />
                ))}
              </div>
            </div>
          )}
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
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
          >
            <Check className="h-4 w-4" />
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ConfigField({
  field,
  value,
  onChange,
}: {
  field: import('./_lib').PluginConfigField;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  switch (field.type) {
    case 'text':
      return (
        <FormField label={field.label} hint={field.hint}>
          <input
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </FormField>
      );
    case 'textarea':
      return (
        <FormField label={field.label} hint={field.hint}>
          <textarea
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </FormField>
      );
    case 'number':
      return (
        <FormField label={field.label} hint={field.hint}>
          <input
            type="number"
            min={field.min}
            max={field.max}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </FormField>
      );
    case 'toggle':
      return (
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-foreground">{field.label}</span>
            {field.hint && <span className="text-xs text-muted-foreground">{field.hint}</span>}
          </div>
          <button
            onClick={() => onChange(!value)}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors',
              value ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span
              className={cn(
                'absolute top-1 h-5 w-5 rounded-full bg-white transition-all',
                value ? 'right-1' : 'right-6'
              )}
            />
          </button>
        </div>
      );
    case 'select':
      return (
        <FormField label={field.label} hint={field.hint}>
          <select
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
      );
    default:
      return null;
  }
}
