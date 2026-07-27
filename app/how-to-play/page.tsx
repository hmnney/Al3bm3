import { PageShell } from '@/components/layout/page-shell';
import { SectionHeader } from '@/components/layout/section-header';
import { BackButton } from '@/components/layout/back-button';
import {
  Users,
  ListChecks,
  Grid3x3,
  Trophy,
  Timer,
  Sparkles,
} from 'lucide-react';

interface Step {
  icon: React.ElementType;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    icon: Users,
    title: 'جهّزوا الفريقين',
    text: 'سمّوا فريقكم واختاروا لوناً مميزاً لكل فريق من الألوان المتاحة.',
  },
  {
    icon: ListChecks,
    title: 'اختاروا 6 تصنيفات',
    text: 'من قائمة التصنيفات الكاملة، اختاروا 6 تصنيفات بالضبط لتحدّد محاور المباراة.',
  },
  {
    icon: Grid3x3,
    title: 'على لوحة المباراة',
    text: 'تظهر التصنيفات الستة كبطاقات كبيرة، وكل بطاقة تضم نقاط 250 و 500 و 750 لكلا الفريقين.',
  },
  {
    icon: Trophy,
    title: 'نقاط ونتيجة',
    text: 'كل فريق يختار سؤالاً وفق النقاط. الأسئلة المنتهية تتحول للرمادي وتُقفل.',
  },
  {
    icon: Timer,
    title: 'ضد الوقت',
    text: 'المؤقت والنوافذ المنبثقة للأسئلة قادمة قريباً كميزات إضافية.',
  },
  {
    icon: Sparkles,
    title: 'ليكون الفائز',
    text: 'في نهاية المباراة، الفريق صاحب أعلى نقاط هو البطل. إنهاء المباراة يعيدكم للرئيسية.',
  },
];

export default function HowToPlayPage() {
  return (
    <PageShell>
      <div className="mb-8 flex items-center justify-between">
        <BackButton href="/" />
      </div>

      <SectionHeader
        title="طريقة اللعب"
        subtitle="دليل سريع للقواعد — من تجهيز الفريقين حتى إعلان الفائز"
      />

      <div className="mx-auto mt-10 grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="group relative flex gap-4 rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40 animate-fade-up"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg">
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-primary">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-lg font-bold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
