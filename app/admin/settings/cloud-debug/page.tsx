'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cloud, Database, Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { SettingsCard } from '../../_components/settings-card';
import { supabase, hasSupabaseConfig } from '@/lib/supabase-client';
import { putState, getState } from '@/lib/state-persistence';

interface SyncEvent {
  kind: 'upload' | 'download';
  ok: boolean;
  status?: number;
  error?: string;
  response?: unknown;
  timestamp: string;
}

const TEST_KEY = 'cloud-debug-test';

export default function CloudDebugPage() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [tableFound, setTableFound] = useState<boolean | null>(null);
  const [tableProbeError, setTableProbeError] = useState<string | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState<string>('unknown');
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    setSupabaseUrl(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '(not set in environment)'
    );
    void probeTable();
  }, []);

  const probeTable = useCallback(async () => {
    setTableFound(null);
    setTableProbeError(null);
    if (!hasSupabaseConfig) {
      setTableFound(false);
      setTableProbeError('Supabase is not configured (missing URL or anon key).');
      return;
    }
    try {
      const { error } = await supabase.from('app_state').select('id').limit(1);
      if (error) {
        setTableFound(false);
        setTableProbeError(`${error.code ?? ''} ${error.message}`);
      } else {
        setTableFound(true);
      }
    } catch (e) {
      setTableFound(false);
      setTableProbeError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const runCloudTest = useCallback(async () => {
    setRunning(true);
    setEvents([]);

    const payload = {
      label: 'cloud-debug',
      createdAt: new Date().toISOString(),
      random: Math.random(),
    };

    const uploadEvent: SyncEvent = {
      kind: 'upload',
      ok: false,
      timestamp: new Date().toISOString(),
    };

    try {
      const saveRes = await putState(TEST_KEY, payload);
      uploadEvent.ok = saveRes.ok;
      uploadEvent.status = saveRes.status;
      uploadEvent.error = saveRes.error;
      uploadEvent.response = saveRes;
    } catch (e) {
      uploadEvent.error = e instanceof Error ? e.message : String(e);
    }
    setEvents((prev) => [...prev, uploadEvent]);

    const downloadEvent: SyncEvent = {
      kind: 'download',
      ok: false,
      timestamp: new Date().toISOString(),
    };
    try {
      const loadRes = await getState<typeof payload>(TEST_KEY);
      downloadEvent.response = loadRes;
      if (loadRes.status === 'found' && loadRes.data) {
        downloadEvent.ok = true;
        const match =
          loadRes.data.label === payload.label &&
          loadRes.data.random === payload.random;
        if (!match) {
          downloadEvent.ok = false;
          downloadEvent.error = 'Data mismatch — saved value did not match loaded value.';
        }
      } else {
        downloadEvent.ok = false;
        downloadEvent.error = loadRes.error ?? `Load status: ${loadRes.status}`;
      }
    } catch (e) {
      downloadEvent.error = e instanceof Error ? e.message : String(e);
    }
    setEvents((prev) => [...prev, downloadEvent]);
    setLastSync(new Date().toISOString());
    setRunning(false);
    void probeTable();
  }, [probeTable]);

  const lastUpload = [...events].reverse().find((e) => e.kind === 'upload');
  const lastDownload = [...events].reverse().find((e) => e.kind === 'download');
  const overallPass = events.length === 2 && events.every((e) => e.ok);

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="Cloud Debug"
        subtitle="فحص مباشر لاتصال قاعدة البيانات والسحابة"
        actions={
          <button
            onClick={runCloudTest}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Run Cloud Test
          </button>
        }
      />

      <div className="flex flex-col gap-5">
        <SettingsCard
          title="Supabase Connection"
          description="عنوان قاعدة البيانات وحالة الجدول"
          icon={<Cloud className="h-5 w-5" />}
        >
          <Row label="Supabase URL">
            <code className="block w-full break-all rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs text-foreground">
              {supabaseUrl}
            </code>
          </Row>
          <Row label="Supabase configured">
            <Badge ok={hasSupabaseConfig} label={hasSupabaseConfig ? 'Yes' : 'No'} />
          </Row>
          <Row label="app_state table found">
            {tableFound === null ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Probing…
              </span>
            ) : (
              <Badge ok={tableFound} label={tableFound ? 'Found' : 'Not found'} />
            )}
          </Row>
          {tableProbeError && (
            <Row label="Table probe error">
              <code className="block w-full break-all rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {tableProbeError}
              </code>
            </Row>
          )}
        </SettingsCard>

        {events.length > 0 && (
          <SettingsCard
            title="Test Result"
            description="نتيجة آخر اختبار سحابي"
            icon={overallPass ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          >
            <Row label="Overall">
              <Badge ok={overallPass} label={overallPass ? 'PASS' : 'FAIL'} large />
            </Row>
            <Row label="Save succeeded">
              <Badge ok={!!lastUpload?.ok} label={lastUpload ? (lastUpload.ok ? 'Yes' : 'No') : '—'} />
            </Row>
            <Row label="Load succeeded">
              <Badge ok={!!lastDownload?.ok} label={lastDownload ? (lastDownload.ok ? 'Yes' : 'No') : '—'} />
            </Row>
            <Row label="Last sync timestamp">
              <span className="text-sm text-foreground">{lastSync ?? '—'}</span>
            </Row>
          </SettingsCard>
        )}

        {lastUpload && (
          <SettingsCard
            title="Last Upload"
            description="تفاصيل آخر عملية حفظ"
            icon={<Database className="h-5 w-5" />}
          >
            <Row label="Status">
              <Badge ok={lastUpload.ok} label={lastUpload.ok ? 'OK' : 'Failed'} />
            </Row>
            <Row label="HTTP status code">
              <span className="text-sm text-foreground">{lastUpload.status ?? '—'}</span>
            </Row>
            {lastUpload.error && (
              <Row label="Error message">
                <code className="block w-full break-all rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {lastUpload.error}
                </code>
              </Row>
            )}
            <Row label="Database response">
              <pre className="block w-full overflow-auto rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs text-foreground">
                {JSON.stringify(lastUpload.response, null, 2)}
              </pre>
            </Row>
          </SettingsCard>
        )}

        {lastDownload && (
          <SettingsCard
            title="Last Download"
            description="تفاصيل آخر عملية قراءة"
            icon={<Database className="h-5 w-5" />}
          >
            <Row label="Status">
              <Badge ok={lastDownload.ok} label={lastDownload.ok ? 'OK' : 'Failed'} />
            </Row>
            <Row label="HTTP status code">
              <span className="text-sm text-foreground">{lastDownload.status ?? '—'}</span>
            </Row>
            {lastDownload.error && (
              <Row label="Error message">
                <code className="block w-full break-all rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {lastDownload.error}
                </code>
              </Row>
            )}
            <Row label="Database response">
              <pre className="block w-full overflow-auto rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs text-foreground">
                {JSON.stringify(lastDownload.response, null, 2)}
              </pre>
            </Row>
          </SettingsCard>
        )}

        {events.length === 0 && !running && (
          <div className="rounded-2xl border-2 border-dashed border-border/50 bg-card/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              اضغط &quot;Run Cloud Test&quot; لبدء الفحص.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function Badge({ ok, label, large }: { ok: boolean; label: string; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
        large ? 'text-sm px-4 py-1.5' : ''
      } ${
        ok
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-destructive/15 text-destructive'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
