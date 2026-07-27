'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface GameButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * The signature large pill button used across the game. Built on top of the
 * project's design tokens (brand gradient + glow) rather than the generic
 * shadcn Button so every page gets a consistent, premium feel.
 */
export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants: Record<string, string> = {
      primary:
        'bg-brand-gradient text-white glow-primary hover:brightness-110 hover:scale-[1.02]',
      secondary:
        'bg-secondary text-secondary-foreground glow-secondary hover:brightness-110 hover:scale-[1.02]',
      outline:
        'border-2 border-primary/60 bg-card/40 text-foreground backdrop-blur hover:border-primary hover:bg-primary/10',
      ghost:
        'bg-card/40 text-muted-foreground backdrop-blur hover:bg-card/80 hover:text-foreground',
    };

    const sizes: Record<string, string> = {
      sm: 'h-10 px-5 text-sm',
      md: 'h-12 px-7 text-base',
      lg: 'h-14 px-9 text-lg',
      xl: 'h-16 px-12 text-xl sm:text-2xl',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100 active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
GameButton.displayName = 'GameButton';
