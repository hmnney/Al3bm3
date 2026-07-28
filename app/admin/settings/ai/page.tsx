'use client';

import { useState } from 'react';
import {
  Bot,
  Save,
  Power,
  Plug,
  Key,
  Cpu,
  Thermometer,
  Hash,
  Wifi,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ListChecks,
} from 'lucide-react';
import { useSettings } from '../../_lib/settings-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { SettingsCard, SettingRow } from '../../_components/settings-card';
import { cn } from '@/lib/utils';
import {
  getProviderById,
  listProviders,
  PROVIDER_LABELS,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_NEEDS_KEY,
  type AIProviderId,
  type ModelInfo,
} from '../../ai/_lib';

interface TestResultData {
  ok: boolean;
  message: string;
  detectedModel?: string;
  availableModels?: ModelInfo[];
  selectedModel?: string;
}

export default function AISettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const ai = settings.ai;
  const [apiKey, setApiKey] = useState(ai.apiKey);
  const [model, setModel] = useState(ai.model);
  const [temperature, setTemperature] = useState(ai.temperature);
  const [maxTokens, setMaxTokens] = useState(ai.maxTokens);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResultData | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const providers = listProviders();
  const currentProvider = getProviderById(ai.provider);

  const handleProviderChange = (id: AIProviderId) => {
    const defaults = PROVIDER_DEFAULT_MODELS[id];
    update({
      ai: {
        ...ai,
        provider: id,
        model: defaults,
        apiKey: PROVIDER_NEEDS_KEY[id] ? apiKey : '',
      },
    });
    setModel(defaults);
    setTestResult(null);
    toast({ title: 'تم التبديل', description: `المزود الحالي: ${PROVIDER_LABELS[id]}` });
  };

  const handleToggleEnabled = () => {
    update({ ai: { ...ai, enabled: !ai.enabled } });
    toast({
      title: ai.enabled ? 'تم تعطيل الذكاء الاصطناعي' : 'تم تفعيل الذكاء الاصطناعي',
    });
  };

  const handleSave = () => {
    update({
      ai: {
        ...ai,
        apiKey: apiKey.trim(),
        model: model.trim(),
        temperature,
        maxTokens,
      },
    });
    toast({ title: 'تم الحفظ', description: 'حُفظت إعدادات الذكاء الاصطناعي' });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const provider = getProviderById(ai.provider);
      const result = await provider.testConnection({
        ...ai,
        apiKey,
        model,
        temperature,
        maxTokens,
      });
      setTestResult(result);
      // Auto-save the detected model into AI Settings on success.
      if (result.ok && result.detectedModel && result.detectedModel !== model) {
        setModel(result.detectedModel);
        update({
          ai: {
            ...ai,
            apiKey: apiKey.trim(),
            model: result.detectedModel,
            temperature,
            maxTokens,
          },
        });
      }
      toast({
        title: result.ok ? 'نجح الاتصال' : 'فشل الاتصال',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      });
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const hasDebugData = testResult?.availableModels && testResult.availableModels.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="إعدادات الذكاء الاصطناعي"
        subtitle="مدير مزود الذكاء الاصطناعي — طبقة عامة بين اللعبة والمزود"
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleToggleEnabled}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all',
                ai.enabled
                  ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                  : 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
              )}
            >
              <Power className="h-4 w-4" />
              {ai.enabled ? 'مُفعّل' : 'معطّل'}
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              حفظ
            </button>
          </div>
        }
      />

      {/* Architecture banner */}
      <div className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black text-foreground">
            طبقة المزود (Provider Layer)
          </span>
          <span className="text-xs text-muted-foreground">
            اللعبة ← مدير المزود ← المزود المختار — لا يُستدعى Gemini مباشرة أبداً
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Provider selection */}
        <SettingsCard
          title="المزود الحالي"
          description="اختر مزود الذكاء الاصطناعي — كل المزودات تطبق نفس الواجهة"
          icon={<Plug className="h-5 w-5" />}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {providers.map((p) => {
              const active = ai.provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-sm font-black transition-all',
                    active
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                  )}
                >
                  <Bot className="h-6 w-6" />
                  {PROVIDER_LABELS[p.id]}
                  {PROVIDER_NEEDS_KEY[p.id] && (
                    <span className="text-[10px] font-bold text-amber-500">يحتاج مفت</span>
                  )}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        {/* API key */}
        {PROVIDER_NEEDS_KEY[ai.provider] && (
          <SettingsCard
            title="مفتاح API"
            description="مفت المصادقة للمزود المختار — يُخزّن محلياً فقط"
            icon={<Key className="h-5 w-5" />}
          >
            <SettingRow label="مفتاح API" hint="لن يُرسل إلى أي خادم خارجي">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="أدخل مفتاح API"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </SettingRow>
          </SettingsCard>
        )}

        {/* Model + parameters */}
        <SettingsCard
          title="النموذج والمعاملات"
          description="النموذج يُكتشف تلقائياً من Google — اتركه فارغاً للاكتشاف التلقائي"
          icon={<Cpu className="h-5 w-5" />}
        >
          <SettingRow
            label="النموذج"
            hint={model ? 'مكتشف تلقائياً' : 'سيُكتشف تلقائياً عند اختبار الاتصال'}
          >
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="اكتشف تلقائياً"
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </SettingRow>

          <SettingRow label="الحرارة (Temperature)" hint="0 = دقيق، 1 = إبداعي">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-sm font-black text-primary">
                <Thermometer className="h-3.5 w-3.5" />
                {temperature.toFixed(1)}
              </span>
            </div>
          </SettingRow>

          <SettingRow label="أقصى عدد للرموز (Max Tokens)" hint="حد طول الاستجابة">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={128}
                max={4096}
                step={128}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-sm font-black text-primary">
                <Hash className="h-3.5 w-3.5" />
                {maxTokens}
              </span>
            </div>
          </SettingRow>
        </SettingsCard>

        {/* Test connection */}
        <SettingsCard
          title="اختبار الاتصال"
          description="تحقق من أن المزود والمفت يعملان — يكتشف النموذج تلقائياً"
          icon={<Wifi className="h-5 w-5" />}
        >
          <div className="flex flex-col gap-3">
            <button
              onClick={handleTest}
              disabled={testing || (PROVIDER_NEEDS_KEY[ai.provider] && !apiKey)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              {testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
            </button>

            {testResult && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg border-2 px-4 py-3 text-sm font-bold',
                  testResult.ok
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-destructive/40 bg-destructive/10 text-destructive'
                )}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Debug panel */}
            {hasDebugData && (
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5">
                <button
                  onClick={() => setShowDebug((v) => !v)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
                >
                  {showDebug ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <ListChecks className="h-4 w-4" />
                  لوحة تشخيص النماذج
                  <span className="mr-auto text-xs font-normal text-muted-foreground">
                    {testResult.availableModels!.length} نموذج
                    {testResult.selectedModel && ` · المختار: ${testResult.selectedModel}`}
                  </span>
                </button>

                {showDebug && (
                  <div className="border-t-2 border-primary/15 p-4">
                    {/* Selected model */}
                    {testResult.selectedModel && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        <span className="text-sm font-bold text-success">
                          النموذج المختار: {testResult.selectedModel}
                        </span>
                      </div>
                    )}

                    {/* Available models list */}
                    <div className="mb-2 text-xs font-black text-muted-foreground uppercase tracking-wide">
                      النماذج المتاحة من Google
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                      {testResult.availableModels!.map((m) => {
                        const isSelected = m.name === testResult.selectedModel;
                        return (
                          <div
                            key={m.name}
                            className={cn(
                              'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
                              isSelected
                                ? 'border-success/40 bg-success/10'
                                : m.canGenerate
                                  ? 'border-border/50 bg-background/40'
                                  : 'border-destructive/20 bg-destructive/5'
                            )}
                          >
                            {isSelected ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-success shrink-0" />
                            ) : m.canGenerate ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <XCircle className="mt-0.5 h-3.5 w-3.5 text-destructive shrink-0" />
                            )}
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={cn(
                                  'font-bold',
                                  m.canGenerate ? 'text-foreground' : 'text-muted-foreground'
                                )}
                              >
                                {m.name}
                              </span>
                              {m.rejectionReason && (
                                <span className="text-destructive/80 font-normal">
                                  {m.rejectionReason}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!ai.enabled && (
              <div className="flex items-center gap-2 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs font-bold text-amber-500">
                <Power className="h-4 w-4 shrink-0" />
                الذكاء الاصطناعي معطّل حالياً — فعّله من الأعلى لاستخدام المزود. Mock AI يعمل دائماً.
              </div>
            )}
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
