'use client';

import { useState } from 'react';
import { ShieldCheck, Save, Eye, EyeOff, LogOut } from 'lucide-react';
import { useSettings } from '../../_lib/settings-context';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader } from '../../_components/admin-page-header';
import { SettingsCard, SettingRow } from '../../_components/settings-card';
import { cn } from '@/lib/utils';
import { logoutAdmin } from '../../_lib/auth';
import { useRouter } from 'next/navigation';

export default function SecuritySettingsPage() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const router = useRouter();
  const [pwd, setPwd] = useState(settings.security.adminPassword);
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const savePassword = () => {
    if (pwd.length < 4) {
      toast({ title: 'كلمة مرور ضعيفة', description: 'يجب أن تكون 4 أحرف على الأقل', variant: 'destructive' });
      return;
    }
    if (confirm && pwd !== confirm) {
      toast({ title: 'عدم تطابق', description: 'كلمتا المرور غير متطابقتين', variant: 'destructive' });
      return;
    }
    update({ security: { ...settings.security, adminPassword: pwd } });
    setConfirm('');
    toast({ title: 'تم الحفظ', description: 'حُفظت كلمة مرور الأدمن الجديدة' });
  };

  const logoutNow = () => {
    logoutAdmin();
    toast({ title: 'تم تسجيل الخروج', description: 'ستتم إعادة توجيهك لصفحة الدخول' });
    router.replace('/admin/login');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="الأمان"
        subtitle="كلمة مرور الأدمن وانتهاء الجلسة والخروج التلقائي"
      />

      <div className="flex flex-col gap-5">
        <SettingsCard
          title="كلمة مرور الأدمن"
          description="كلمة المرور اللازمة للوصول إلى لوحة التحكم"
          icon={<ShieldCheck className="h-5 w-5" />}
        >
          <SettingRow label="كلمة المرور الجديدة">
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 pl-10 text-sm text-foreground outline-none focus:border-primary"
              />
              <button
                onClick={() => setShowPwd((s) => !s)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="إظهار/إخفاء"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </SettingRow>

          <SettingRow label="تأكيد كلمة المرور" hint="أعد كتابة كلمة المرور">
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="تأكيد"
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </SettingRow>

          <div className="mt-3 flex justify-end">
            <button
              onClick={savePassword}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              حفظ كلمة المرور
            </button>
          </div>
        </SettingsCard>

        <SettingsCard
          title="انتهاء الجلسة"
          description="مدة الخمول قبل تسجيل الخروج التلقائي"
        >
          <SettingRow
            label="مدة انتهاء الجلسة"
            hint="عدد الدقائق قبل انتهاء صلاحية الجلسة"
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={settings.security.sessionTimeout}
                onChange={(e) =>
                  update({
                    security: {
                      ...settings.security,
                      sessionTimeout: Number(e.target.value),
                    },
                  })
                }
                className="flex-1 accent-[hsl(var(--primary))]"
              />
              <span className="w-14 rounded-lg bg-primary/15 px-2 py-1 text-center text-sm font-black text-primary">
                {settings.security.sessionTimeout} د
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label="الخروج التلقائي"
            hint="تسجيل خروج بعد فترة خمول"
          >
            <button
              onClick={() =>
                update({
                  security: {
                    ...settings.security,
                    autoLogout: !settings.security.autoLogout,
                  },
                })
              }
              className={cn(
                'relative h-7 w-12 rounded-full transition-colors',
                settings.security.autoLogout ? 'bg-primary' : 'bg-muted'
              )}
              aria-pressed={settings.security.autoLogout}
            >
              <span
                className={cn(
                  'absolute top-1 h-5 w-5 rounded-full bg-white transition-all',
                  settings.security.autoLogout ? 'right-1' : 'right-6'
                )}
              />
            </button>
          </SettingRow>
        </SettingsCard>

        <SettingsCard
          title="تسجيل الخروج"
          description="إنهاء جلستك الحالية فوراً"
        >
          <button
            onClick={logoutNow}
            className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive transition-all hover:bg-destructive/20"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج الآن
          </button>
        </SettingsCard>
      </div>
    </div>
  );
}
