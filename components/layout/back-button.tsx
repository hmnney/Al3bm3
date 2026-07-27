'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  href: string;
  label?: string;
  className?: string;
}

/**
 * RTL-aware "back" control. Because the app is right-to-left, "back" points
 * to the visual left, so we render an ArrowRight icon (which points left in
 * RTL) and keep the label first for natural reading order.
 */
export function BackButton({ href, label = 'رجوع', className }: BackButtonProps) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        // Keep it a real <Link> for SEO/prefetch, but also support browser back.
        e.preventDefault();
        router.push(href);
      }}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur transition-all hover:border-primary/50 hover:bg-card/70 hover:text-foreground',
        className
      )}
    >
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
    </Link>
  );
}
