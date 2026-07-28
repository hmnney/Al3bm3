'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  FolderTree,
  Database,
  ImageIcon,
  AudioLines,
  Video,
  ArrowLeft,
} from 'lucide-react';
import { useAdmin } from './_lib/admin-context';
import { AdminPageHeader } from './_components/admin-page-header';
import { StatCard } from './_components/stat-card';

/**
 * Admin dashboard. Shows high-level counts as statistic cards: total
 * categories, total questions, and per-media-type counts (image / audio /
 * video). All derived from the local admin store.
 */
export default function AdminDashboardPage() {
  const { data, ready } = useAdmin();

  const stats = useMemo(() => {
    const totalCategories = data.categories.length;
    const totalQuestions = data.questions.length;
    const imagesCount = data.questions.filter((q) => Boolean(q.image)).length;
    const audioCount = data.questions.filter((q) => Boolean(q.audio)).length;
    const videoCount = data.questions.filter((q) => Boolean(q.video)).length;
    return { totalCategories, totalQuestions, imagesCount, audioCount, videoCount };
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="لوحة التحكم"
        subtitle="نظرة عامة على محتوى اللعبة"
        actions={
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur transition-all hover:border-primary/50 hover:bg-card/70 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للعبة
          </Link>
        }
      />

      {!ready ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border-2 border-border/40 bg-card/30"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="إجمالي التصنيفات"
              value={stats.totalCategories}
              icon={FolderTree}
              gradient="from-purple-500 to-violet-600"
            />
            <StatCard
              label="إجمالي الأسئلة"
              value={stats.totalQuestions}
              icon={Database}
              gradient="from-blue-500 to-indigo-600"
            />
            <StatCard
              label="أسئلة بصور"
              value={stats.imagesCount}
              icon={ImageIcon}
              gradient="from-cyan-500 to-sky-600"
            />
            <StatCard
              label="أسئلة بأصوات"
              value={stats.audioCount}
              icon={AudioLines}
              gradient="from-emerald-500 to-green-600"
            />
            <StatCard
              label="أسئلة بفيديو"
              value={stats.videoCount}
              icon={Video}
              gradient="from-rose-500 to-pink-600"
            />
          </div>

          {/* Quick links */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/admin/categories"
              className="group flex items-center gap-4 rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur transition-all hover:border-primary/40 hover:shadow-xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg">
                <FolderTree className="h-6 w-6" />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-lg font-black text-foreground">
                  إدارة التصنيفات
                </span>
                <span className="text-sm text-muted-foreground">
                  أضف وعدّل واحذف تصنيفات اللعبة
                </span>
              </div>
              <ArrowLeft className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-x-1" />
            </Link>
            <Link
              href="/admin/questions"
              className="group flex items-center gap-4 rounded-2xl border-2 border-border/50 bg-card/50 p-6 backdrop-blur transition-all hover:border-primary/40 hover:shadow-xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <Database className="h-6 w-6" />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-lg font-black text-foreground">
                  بنك الأسئلة
                </span>
                <span className="text-sm text-muted-foreground">
                  ابحث وصفِّ أسئلة اللعبة
                </span>
              </div>
              <ArrowLeft className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-x-1" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
