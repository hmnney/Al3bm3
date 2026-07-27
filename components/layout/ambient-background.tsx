'use client';

/**
 * Decorative full-screen background shared by every page.
 * Purely presentational — sits behind all content (z-0) and never blocks
 * pointer events.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Deep base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background-soft" />

      {/* Animated brand glows */}
      <div className="absolute -top-40 right-[-10%] h-[55vh] w-[55vh] rounded-full bg-primary/25 blur-[120px] animate-pulse-glow" />
      <div
        className="absolute top-1/3 left-[-15%] h-[60vh] w-[60vh] rounded-full bg-secondary/20 blur-[130px] animate-pulse-glow"
        style={{ animationDelay: '1.5s' }}
      />
      <div
        className="absolute bottom-[-20%] right-1/4 h-[50vh] w-[50vh] rounded-full bg-primary-glow/15 blur-[140px] animate-pulse-glow"
        style={{ animationDelay: '3s' }}
      />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-grid opacity-40" />

      {/* Top vignette for legibility */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/80 to-transparent" />
    </div>
  );
}
