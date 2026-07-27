import './globals.css';
import type { Metadata } from 'next';
import { GameProvider } from '@/components/providers/game-provider';
import { AmbientBackground } from '@/components/layout/ambient-background';

/**
 * Self-hosted font stack. We avoid `next/font/google` because it fetches font
 * files from Google's CDN at request time; in a sandboxed preview environment
 * that fetch can hang and produce a blank page. This stack keeps the Arabic-
 * first, rounded feel of Cairo while rendering instantly with zero network
 * dependency.
 */
const fontStack =
  "'Cairo', 'Tajawal', 'Noto Kufi Arabic', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata: Metadata = {
  title: 'العب مع شلتك',
  description: 'كل جلسة لها تحدي — لعبة أسئلة جماعية للأصدقاء',
  themeColor: '#0a0613',
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        style={{ fontFamily: fontStack }}
        suppressHydrationWarning
      >
        <GameProvider>
          <AmbientBackground />
          <main className="relative z-10 min-h-screen">{children}</main>
        </GameProvider>
      </body>
    </html>
  );
}
