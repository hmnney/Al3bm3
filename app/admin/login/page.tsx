'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowRight, Home } from 'lucide-react';
import { authenticateAdmin, ADMIN_PASSWORD } from '../_lib/auth';

/**
 * Admin login page. A lightweight password gate — not real security, just keeps
 * the panel out of casual reach. Future work can swap for Supabase auth without
 * changing the panel UI.
 *
 * The default password is shown as a hint to make this demo self-service.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authenticateAdmin(password)) {
      router.replace('/admin');
    } else {
      setError(true);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-fade-up">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg glow-primary">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="bg-gradient-to-l from-primary via-primary-glow to-secondary bg-clip-text text-3xl font-black text-transparent">
            لوحة الإدارة
          </h1>
          <p className="text-sm text-muted-foreground">
            أدخل كلمة المرور للوصول إلى لوحة التحكم
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur sm:p-8"
        >
          <label className="mb-2 block text-sm font-bold text-foreground">
            كلمة المرور
          </label>
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="••••••••"
            className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {error && (
            <p className="mt-2 text-xs font-semibold text-destructive">
              كلمة المرور غير صحيحة
            </p>
          )}

          <button
            type="submit"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient py-3 text-base font-bold text-white shadow-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
          >
            دخول
            <ArrowRight className="h-5 w-5" />
          </button>

          {/* Hint */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            كلمة المرور الافتراضية: <span className="font-bold">{ADMIN_PASSWORD}</span>
          </p>
        </form>

        {/* Back to game */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur transition-all hover:border-primary/50 hover:bg-card/70 hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            العودة للعبة
          </Link>
        </div>
      </div>
    </div>
  );
}
