'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, Dices, BookOpen, Settings, Sparkles, Lock } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { authenticateAdmin } from '@/app/admin/_lib/auth';

interface HomeAction {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
}

const ACTIONS: HomeAction[] = [
  {
    href: '/teams',
    label: 'ابدأ اللعبة',
    description: 'جهّز الفريقين وابدأ المباراة',
    icon: Play,
    variant: 'primary',
  },
  {
    href: '/roulette',
    label: 'روليت',
    description: 'وزّع اللاعبين عشوائياً على فريقين',
    icon: Dices,
    variant: 'secondary',
  },
  {
    href: '/how-to-play',
    label: 'طريقة اللعب',
    description: 'تعرّف على القواعد قبل البدء',
    icon: BookOpen,
    variant: 'outline',
  },
  {
    href: '/settings',
    label: 'الإعدادات',
    description: 'الصوت، الموسيقى، والمؤقت',
    icon: Settings,
    variant: 'outline',
  },
];

const variantClasses: Record<HomeAction['variant'], string> = {
  primary: 'bg-brand-gradient text-white glow-primary hover:brightness-110',
  secondary: 'bg-secondary text-secondary-foreground glow-secondary hover:brightness-110',
  outline: 'border-2 border-primary/50 bg-card/40 text-foreground backdrop-blur hover:border-primary hover:bg-primary/10',
  ghost: 'bg-card/40 text-muted-foreground backdrop-blur hover:bg-card/80 hover:text-foreground',
};

export default function HomePage() {
  const router = useRouter();
  const [adminOpen, setAdminOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAdminAccess = () => {
    if (authenticateAdmin(password)) {
      setAdminOpen(false);
      setPassword('');
      setError('');
      router.push('/admin');
    } else {
      setError('كلمة المرور غير صحيحة');
    }
  };

  return (
    <PageShell className="items-center justify-center text-center">
      {/* Floating sparkle accents */}
      <Sparkles className="mb-6 h-10 w-10 text-primary animate-float" />

      {/* Title */}
      <h1 className="bg-gradient-to-l from-primary via-primary-glow to-secondary bg-clip-text text-6xl font-black leading-[1.05] text-transparent drop-shadow-[0_0_40px_rgba(168,85,247,0.35)] sm:text-7xl md:text-8xl lg:text-9xl">
        العب مع شلتك
      </h1>

      {/* Subtitle */}
      <p className="mt-5 text-xl font-semibold text-muted-foreground sm:text-2xl md:text-3xl">
        كل جلسة لها تحدي
      </p>

      {/* Decorative divider */}
      <div className="mt-8 flex items-center gap-3">
        <span className="h-px w-12 bg-gradient-to-l from-primary to-transparent" />
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="h-px w-12 bg-gradient-to-r from-secondary to-transparent" />
      </div>

      {/* Actions */}
      <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {ACTIONS.map((action, i) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-right transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl animate-fade-up ${variantClasses[action.variant]}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur transition-transform group-hover:scale-110">
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-1 flex-col items-start">
                <span className="text-2xl font-black sm:text-3xl">
                  {action.label}
                </span>
                <span className="text-sm font-medium opacity-80">
                  {action.description}
                </span>
              </div>
              {/* hover sweep */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="mt-12 text-xs font-medium text-muted-foreground/70">
        لعبة جماعية — شاشة واحدة، فريقان، وتحدي لا يُنسى
      </p>

      {/* Subtle admin access */}
      <button
        type="button"
        onClick={() => setAdminOpen(true)}
        aria-label="إدارة"
        className="fixed top-4 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground/30 transition-all duration-300 hover:text-muted-foreground"
      >
        <Settings className="h-4 w-4" />
      </button>

      {/* Admin password dialog */}
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              دخول الإدارة
            </DialogTitle>
            <DialogDescription>
              أدخل كلمة المرور للوصول إلى لوحة الإدارة
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdminAccess();
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="كلمة المرور"
              autoFocus
              className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            {error && (
              <p className="mt-2 text-sm font-medium text-destructive">{error}</p>
            )}
            <DialogFooter className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setAdminOpen(false);
                  setPassword('');
                  setError('');
                }}
                className="rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90"
              >
                دخول
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
