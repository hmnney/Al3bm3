'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderTree,
  Database,
  Sparkles,
  Wand2,
  Activity,
  LogOut,
  Menu,
  X,
  Home,
  Settings2,
  Sliders,
  Timer,
  Users,
  FolderCog,
  QrCode,
  ShieldCheck,
  Puzzle,
  Bot,
  Play,
  PackageOpen,
  ImageDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  checkSessionExpiry,
  isAdminAuthenticated,
  logoutAdmin,
  touchSession,
} from '../_lib/auth';
import { QuickActions } from './quick-actions';

/**
 * Admin section shell. Wraps every /admin/* route with:
 *  - an auth gate (redirects to /admin/login when not authenticated)
 *  - a responsive RTL sidebar (collapses to a drawer on tablet/mobile)
 *  - the admin navigation
 *
 * The shell is a client component because it reads auth state from localStorage
 * and handles redirects. It does not render any game UI.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, exact: true },
  { href: '/admin/categories', label: 'التصنيفات', icon: FolderTree },
  { href: '/admin/questions', label: 'بنك الأسئلة', icon: Database },
  { href: '/admin/builder', label: 'بناء بنك الأسئلة', icon: Database },
  { href: '/admin/packs', label: 'حزم الأسئلة', icon: PackageOpen },
  { href: '/admin/designer', label: 'مصمم الأسئلة', icon: Wand2 },
  { href: '/admin/posters', label: 'استيراد البوسترات', icon: ImageDown },
  { href: '/admin/import', label: 'استيراد ذكي', icon: Sparkles },
  { href: '/admin/test', label: 'اختبار اللعبة', icon: Play },
  { href: '/admin/validation', label: 'التحقق من اللعبة', icon: ShieldCheck },
  { href: '/admin/system', label: 'تشخيص النظام', icon: Activity },
];

const SETTINGS_NAV: NavItem[] = [
  { href: '/admin/settings/game', label: 'إعدادات اللعبة', icon: Sliders },
  { href: '/admin/settings/timer', label: 'المؤقت', icon: Timer },
  { href: '/admin/settings/teams', label: 'الفرق', icon: Users },
  { href: '/admin/settings/categories', label: 'إدارة التصنيفات', icon: FolderCog },
  { href: '/admin/settings/qr', label: 'إعدادات QR', icon: QrCode },
  { href: '/admin/settings/security', label: 'الأمان', icon: ShieldCheck },
  { href: '/admin/settings/ai', label: 'الذكاء الاصطناعي', icon: Bot },
];

const INTERACTIVE_NAV: NavItem[] = [
  { href: '/admin/interactive', label: 'التصنيفات التفاعلية', icon: Puzzle },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auth gate — check on mount and whenever the route changes.
  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace('/admin/login');
      return;
    }
    setAuthed(true);
  }, [router]);

  // Close the drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Inactivity auto-logout: check periodically and on activity, driven by the
  // Security settings (sessionTimeout + autoLogout).
  useEffect(() => {
    if (!authed) return;
    const handleActivity = () => touchSession();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    const interval = window.setInterval(() => {
      if (checkSessionExpiry()) router.replace('/admin/login');
    }, 15000);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.clearInterval(interval);
    };
  }, [authed, router]);

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
      </div>
    );
  }

  const handleLogout = () => {
    logoutAdmin();
    router.replace('/admin/login');
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col gap-2 p-5">
      {/* Brand */}
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg glow-primary">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-black text-foreground">لوحة الإدارة</span>
          <span className="text-xs font-medium text-muted-foreground">
            العب مع شلتك
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all',
                active
                  ? 'bg-brand-gradient text-white shadow-lg glow-primary'
                  : 'text-muted-foreground hover:bg-card/80 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  active ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Interactive section */}
      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 px-4 pb-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70">
          <Puzzle className="h-3.5 w-3.5" />
          تصنيفات تفاعلية
        </div>
        {INTERACTIVE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all',
                active
                  ? 'bg-brand-gradient text-white shadow-lg glow-primary'
                  : 'text-muted-foreground hover:bg-card/80 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Settings section */}
      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 px-4 pb-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70">
          <Settings2 className="h-3.5 w-3.5" />
          إعدادات اللعبة
        </div>
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all',
                active
                  ? 'bg-brand-gradient text-white shadow-lg glow-primary'
                  : 'text-muted-foreground hover:bg-card/80 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="mt-auto flex flex-col gap-1.5 border-t border-border/50 pt-4">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground transition-all hover:bg-card/80 hover:text-foreground"
        >
          <Home className="h-5 w-5 shrink-0" />
          <span>العودة للعبة</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-destructive transition-all hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen w-full">
      {/* Desktop sidebar (fixed on lg+) */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-l border-border/50 bg-background-soft/80 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* Mobile/tablet drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-72 border-l border-border/50 bg-background-soft/95 backdrop-blur-xl lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="إغلاق"
              className="absolute left-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-card/80 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile/tablet) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="القائمة"
            className="rounded-lg border border-border/60 bg-card/40 p-2 text-foreground transition-colors hover:border-primary/50 hover:bg-card/70"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-black text-foreground">لوحة الإدارة</span>
        </header>

        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </div>
      </div>

      {/* Floating Quick Actions Control Center */}
      <QuickActions />
    </div>
  );
}
