import type { Category, TeamColor, PointValue } from './types';

/**
 * The full catalog of available categories.
 *
 * IMPORTANT: Question content is NOT included here (or anywhere) — the
 * question bank is a future feature. Each category only carries display
 * metadata (name, glyph, gradient) used by the cards and game board.
 *
 * To add a category in the future, append an entry here and add its id to
 * the `CategoryId` union in `lib/types.ts`. No other file needs to change.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'conan',
    name: 'كونان',
    description: 'ألغاز الجريمة وحلول المحقق',
    glyph: '🕵️',
    gradient: 'from-indigo-500/80 to-blue-700/80',
  },
  {
    id: 'movie-posters',
    name: 'بوسترات أفلام ومسلسلات',
    description: 'تعرّف على العمل من البوستر',
    glyph: '🎬',
    gradient: 'from-rose-500/80 to-red-700/80',
  },
  {
    id: 'anime-posters',
    name: 'بوسترات أنمي',
    description: 'شخصيات وأعمال الأنمي',
    glyph: '🌸',
    gradient: 'from-pink-500/80 to-fuchsia-700/80',
  },
  {
    id: 'game-posters',
    name: 'بوسترات ألعاب',
    description: 'أشهر الألعاب الإلكترونية',
    glyph: '🎮',
    gradient: 'from-violet-500/80 to-purple-700/80',
  },
  {
    id: 'football',
    name: 'كرة القدم',
    description: 'نجوم وأندية وإنجازات',
    glyph: '⚽',
    gradient: 'from-green-500/80 to-emerald-700/80',
  },
  {
    id: 'saudi-league',
    name: 'الدوري السعودي',
    description: 'فرسان الشمال والنجوم المحليون',
    glyph: '🇸🇦',
    gradient: 'from-emerald-500/80 to-teal-700/80',
  },
  {
    id: 'wrestling',
    name: 'المصارعة',
    description: 'نجوم الحلبات والبطولات',
    glyph: '🤼',
    gradient: 'from-amber-500/80 to-orange-700/80',
  },
  {
    id: 'order-events',
    name: 'رتب الأحداث',
    description: 'رتّب الأحداث حسب تسلسلها الزمني',
    glyph: '🔢',
    gradient: 'from-sky-500/80 to-cyan-700/80',
  },
  {
    id: 'story-says',
    name: 'القصة تقول',
    description: 'أكمل القصة أو خمّن نهايتها',
    glyph: '📖',
    gradient: 'from-yellow-500/80 to-amber-700/80',
  },
  {
    id: 'guess-image',
    name: 'خمن الصورة',
    description: 'اعرف الإجابة من الصورة',
    glyph: '🖼️',
    gradient: 'from-teal-500/80 to-green-700/80',
  },
  {
    id: 'general',
    name: 'أسئلة عامة',
    description: 'معلومات عامة متنوعة',
    glyph: '🧠',
    gradient: 'from-blue-500/80 to-indigo-700/80',
  },
  {
    id: 'friends',
    name: 'فريندز',
    description: 'أسئلة عن الأصدقاء أنفسهم',
    glyph: '👥',
    gradient: 'from-fuchsia-500/80 to-pink-700/80',
  },
  {
    id: 'who-celebrity',
    name: 'مين المشهور',
    description: 'تعرّف على المشهور من الوصف',
    glyph: '🌟',
    gradient: 'from-purple-500/80 to-violet-700/80',
  },
  {
    id: 'guess-celebration',
    name: 'خمن احتفالية اللاعب',
    description: 'اعرف اللاعب من احتفاله',
    glyph: '🎉',
    gradient: 'from-orange-500/80 to-red-700/80',
  },
  {
    id: 'guess-voice',
    name: 'خمن اللاعب من صوته',
    description: 'استمع وخمّن صاحب الصوت',
    glyph: '🎙️',
    gradient: 'from-cyan-500/80 to-blue-700/80',
  },
];

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);

/** The exact number of categories a match requires. */
export const REQUIRED_CATEGORY_COUNT = 6;

/** Point values available on the game board, shown on both team sides. */
export const POINT_VALUES: PointValue[] = [250, 500, 750];

/**
 * Predefined team colors. Players pick one color per team on the Teams page.
 * The `hsl` string is consumed directly by inline styles so it stays in sync
 * with the brand palette without hardcoding hex values.
 */
export const TEAM_COLORS: TeamColor[] = [
  {
    id: 'purple',
    name: 'بنفسجي',
    hsl: '271 91% 65%',
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    id: 'blue',
    name: 'أزرق',
    hsl: '217 91% 60%',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'emerald',
    name: 'أخضر',
    hsl: '152 76% 46%',
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    id: 'rose',
    name: 'وردي',
    hsl: '346 77% 60%',
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    id: 'amber',
    name: 'ذهبي',
    hsl: '38 92% 50%',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'cyan',
    name: 'فيروزي',
    hsl: '189 94% 55%',
    gradient: 'from-cyan-500 to-sky-600',
  },
];

export const TEAM_COLOR_MAP: Record<string, TeamColor> = Object.fromEntries(
  TEAM_COLORS.map((c) => [c.id, c])
);

/** The two default team slots shown on the Teams page. */
export const DEFAULT_TEAM_NAMES: [string, string] = ['الفريق الأول', 'الفريق الثاني'];
