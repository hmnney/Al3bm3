'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Search,
  X,
  CornerDownLeft,
  Plus,
  FolderTree,
  Database,
  Bot,
  Wand2,
  Sparkles,
  Sliders,
  Puzzle,
  Activity,
  LayoutDashboard,
  LogOut,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logoutAdmin } from '../_lib/auth';

/**
 * Quick Actions Control Center — a floating button + side drawer with grouped
 * shortcuts, instant search filtering, and Ctrl/Cmd+K keyboard support.
 *
 * Self-contained: injected once into the admin shell. Does NOT duplicate
 * navigation — it reuses the same routes the sidebar already links to. The
 * shortcut list is the single source of truth here; the sidebar is untouched.
 */

interface QuickAction {
  id: string;
  label: string;
  href?: string;
  icon: React.ElementType;
  group: string;
  keywords: string[];
  action?: 'logout';
}

const GROUPS: Array<{ id: string; label: string; icon: React.ElementType }> = [
  { id: 'content', label: 'إدارة المحتوى', icon: Database },
  { id: 'ai', label: 'الذكاء الاصطناعي', icon: Bot },
  { id: 'game', label: 'إدارة اللعبة', icon: Sliders },
  { id: 'system', label: 'النظام', icon: LayoutDashboard },
];

const ACTIONS: QuickAction[] = [
  // إدارة المحتوى
  { id: 'add-question', label: 'إضافة سؤال', href: '/admin/questions', icon: Plus, group: 'content', keywords: ['سؤال', 'أضف', 'question', 'add'] },
  { id: 'add-category', label: 'إضافة تصنيف', href: '/admin/categories', icon: FolderTree, group: 'content', keywords: ['تصنيف', 'فئة', 'category', 'add'] },
  { id: 'question-bank', label: 'بنك الأسئلة', href: '/admin/questions', icon: Database, group: 'content', keywords: ['سؤال', 'بنك', 'أسئلة', 'question', 'bank'] },
  { id: 'categories', label: 'التصنيفات', href: '/admin/categories', icon: FolderTree, group: 'content', keywords: ['تصنيف', 'فئة', 'category'] },
  // الذكاء الاصطناعي
  { id: 'ai-settings', label: 'إعدادات AI', href: '/admin/settings/ai', icon: Bot, group: 'ai', keywords: ['ai', 'ذكاء', 'اصطناعي', 'إعدادات', 'gemini', 'groq', 'openrouter'] },
  { id: 'designer', label: 'مصمم الأسئلة', href: '/admin/designer', icon: Wand2, group: 'ai', keywords: ['مصمم', 'تصميم', 'سؤال', 'designer', 'ai'] },
  { id: 'smart-import', label: 'الاستيراد الذكي', href: '/admin/import', icon: Sparkles, group: 'ai', keywords: ['استيراد', 'ذكي', 'import', 'ai'] },
  // إدارة اللعبة
  { id: 'game-settings', label: 'إعدادات اللعبة', href: '/admin/settings/game', icon: Sliders, group: 'game', keywords: ['إعدادات', 'لعبة', 'game', 'settings'] },
  { id: 'interactive', label: 'التصنيفات التفاعلية', href: '/admin/interactive', icon: Puzzle, group: 'game', keywords: ['تفاعلي', 'تصنيف', 'interactive', 'qr'] },
  { id: 'diagnostics', label: 'التشخيص', href: '/admin/system', icon: Activity, group: 'game', keywords: ['تشخيص', 'نظام', 'diagnostics', 'system'] },
  // النظام
  { id: 'dashboard', label: 'لوحة التحكم', href: '/admin', icon: LayoutDashboard, group: 'system', keywords: ['لوحة', 'تحكم', 'dashboard', 'admin'] },
  { id: 'logout', label: 'تسجيل الخروج', icon: LogOut, group: 'system', keywords: ['خروج', 'logout', 'تسجيل'], action: 'logout' },
];

export function QuickActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Ctrl/Cmd+K toggles; Escape closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus the search input when the drawer opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Filter actions by query (matches label + keywords, Arabic + Latin).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) => {
      const haystack = [a.label, ...a.keywords].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  // Group the filtered actions, preserving GROUPS order.
  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({
      ...g,
      items: filtered.filter((a) => a.group === g.id),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  // Flat list for keyboard navigation.
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Reset active index when the filtered set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keyboard navigation within the drawer.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = flat[activeIndex];
      if (action) executeAction(action);
    }
  };

  // Scroll the active item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const executeAction = (action: QuickAction) => {
    if (action.action === 'logout') {
      logoutAdmin();
      router.replace('/admin/login');
      return;
    }
    if (action.href) {
      router.push(action.href);
    }
    setOpen(false);
  };

  // Global index counter for keyboard nav across groups.
  let globalIdx = -1;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="إجراءات سريعة"
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-2xl glow-primary transition-all duration-300 hover:scale-110 hover:shadow-purple-500/40 active:scale-95"
      >
        <Zap className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-5 items-center rounded-full bg-foreground px-1.5 text-[10px] font-black text-background">
          ⌘K
        </span>
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />

          {/* Drawer panel (slides from the right for RTL) */}
          <div
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-2 border-primary/30 bg-background-soft/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300"
            role="dialog"
            aria-label="الإجراءات السريعة"
          >
            {/* Header / search */}
            <div className="flex items-center gap-3 border-b border-border/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg">
                <Zap className="h-5 w-5" />
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-background/60 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ابحث عن إجراء..."
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <kbd className="hidden shrink-0 rounded border border-border/60 bg-card/60 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline-block">
                  ESC
                </kbd>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card/80 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Results */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-3 scrollbar-thin">
              {flat.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">
                    لا توجد نتائج لـ "{query}"
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {grouped.map((group) => (
                    <div key={group.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground/70">
                        <group.icon className="h-3.5 w-3.5" />
                        {group.label}
                      </div>
                      {group.items.map((action) => {
                        globalIdx += 1;
                        const idx = globalIdx;
                        const active = idx === activeIndex;
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.id}
                            data-idx={idx}
                            onClick={() => executeAction(action)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={cn(
                              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-all',
                              active
                                ? 'bg-brand-gradient text-white shadow-lg'
                                : 'text-foreground hover:bg-card/80'
                            )}
                          >
                            <Icon
                              className={cn(
                                'h-5 w-5 shrink-0',
                                active ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                              )}
                            />
                            <span className="flex-1 text-sm font-bold">{action.label}</span>
                            {active && (
                              <CornerDownLeft className="h-4 w-4 shrink-0 text-white/80" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border/60 bg-card/60 px-1.5 py-0.5 font-bold">↑</kbd>
                <kbd className="rounded border border-border/60 bg-card/60 px-1.5 py-0.5 font-bold">↓</kbd>
                للتنقل
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border/60 bg-card/60 px-1.5 py-0.5 font-bold">Enter</kbd>
                للاختيار
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
