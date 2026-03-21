/**
 * Color System — iOS-level design language
 *
 * iOS Human Interface Guidelines 기반:
 * - 뮤트된 배경, 선명한 accent
 * - 시스템 그레이 스케일 (6단계)
 * - 시맨틱 컬러 (adaptable dark/light)
 * - 그림자 기반 깊이 (border 최소화)
 */

export type ColorPalette = 'default' | 'rose' | 'mint' | 'lavender' | 'peach' | 'sky';

export interface ThemeColors {
  // iOS-style layered backgrounds
  background: string;
  secondaryBackground: string;
  tertiaryBackground: string;
  groupedBackground: string;

  // Text — iOS system gray scale
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  quaternaryLabel: string;

  // Fills
  fill: string;
  secondaryFill: string;
  tertiaryFill: string;

  // Tint (primary accent)
  tint: string;
  tintLight: string;

  // Semantic
  success: string;
  warning: string;
  destructive: string;

  // Separator (iOS uses ultra-thin separators, not borders)
  separator: string;
  opaqueSeparator: string;

  // Chat
  userBubble: string;
  userBubbleText: string;
  aiBubble: string;
  aiBubbleText: string;

  // Elevated surface (for cards, modals)
  elevated: string;
  elevatedShadow: string;

  // Navigation
  navBar: string;
  navBarTitle: string;

  // Input
  searchBar: string;

  // Gradient
  gradientStart: string;
  gradientEnd: string;

  // Status
  todoPending: string;
  todoActive: string;
  todoDone: string;
  todoFailed: string;
}

const dark: ThemeColors = {
  background: '#000000',
  secondaryBackground: '#1C1C1E',
  tertiaryBackground: '#2C2C2E',
  groupedBackground: '#000000',

  label: '#FFFFFF',
  secondaryLabel: 'rgba(235,235,245,0.6)',
  tertiaryLabel: 'rgba(235,235,245,0.3)',
  quaternaryLabel: 'rgba(235,235,245,0.18)',

  fill: 'rgba(120,120,128,0.36)',
  secondaryFill: 'rgba(120,120,128,0.32)',
  tertiaryFill: 'rgba(120,120,128,0.24)',

  tint: '#0A84FF',
  tintLight: '#409CFF',

  success: '#30D158',
  warning: '#FFD60A',
  destructive: '#FF453A',

  separator: 'rgba(84,84,88,0.65)',
  opaqueSeparator: '#38383A',

  userBubble: '#0A84FF',
  userBubbleText: '#FFFFFF',
  aiBubble: '#1C1C1E',
  aiBubbleText: '#FFFFFF',

  elevated: '#1C1C1E',
  elevatedShadow: 'rgba(0,0,0,0.5)',

  navBar: 'rgba(22,22,24,0.94)',
  navBarTitle: '#FFFFFF',

  searchBar: 'rgba(120,120,128,0.24)',

  gradientStart: '#0A84FF',
  gradientEnd: '#5E5CE6',

  todoPending: 'rgba(235,235,245,0.3)',
  todoActive: '#0A84FF',
  todoDone: '#30D158',
  todoFailed: '#FF453A',
};

const light: ThemeColors = {
  background: '#FFFFFF',
  secondaryBackground: '#F2F2F7',
  tertiaryBackground: '#FFFFFF',
  groupedBackground: '#F2F2F7',

  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.6)',
  tertiaryLabel: 'rgba(60,60,67,0.3)',
  quaternaryLabel: 'rgba(60,60,67,0.18)',

  fill: 'rgba(120,120,128,0.2)',
  secondaryFill: 'rgba(120,120,128,0.16)',
  tertiaryFill: 'rgba(120,120,128,0.12)',

  tint: '#007AFF',
  tintLight: '#409CFF',

  success: '#34C759',
  warning: '#FF9500',
  destructive: '#FF3B30',

  separator: 'rgba(60,60,67,0.29)',
  opaqueSeparator: '#C6C6C8',

  userBubble: '#007AFF',
  userBubbleText: '#FFFFFF',
  aiBubble: '#E9E9EB',
  aiBubbleText: '#000000',

  elevated: '#FFFFFF',
  elevatedShadow: 'rgba(0,0,0,0.08)',

  navBar: 'rgba(249,249,249,0.94)',
  navBarTitle: '#000000',

  searchBar: 'rgba(120,120,128,0.12)',

  gradientStart: '#007AFF',
  gradientEnd: '#5856D6',

  todoPending: 'rgba(60,60,67,0.3)',
  todoActive: '#007AFF',
  todoDone: '#34C759',
  todoFailed: '#FF3B30',
};

// Palette: accent color override 만 — iOS는 tint 하나만 바꾸면 전체가 바뀜
const tints: Record<ColorPalette, { tint: string; tintLight: string; gradientStart: string; gradientEnd: string }> = {
  default: { tint: dark.tint, tintLight: dark.tintLight, gradientStart: '#0A84FF', gradientEnd: '#5E5CE6' },
  rose: { tint: '#FF375F', tintLight: '#FF6482', gradientStart: '#FF375F', gradientEnd: '#FF9F0A' },
  mint: { tint: '#00C7BE', tintLight: '#63E6BE', gradientStart: '#00C7BE', gradientEnd: '#30D158' },
  lavender: { tint: '#BF5AF2', tintLight: '#DA8FFF', gradientStart: '#BF5AF2', gradientEnd: '#FF375F' },
  peach: { tint: '#FF9F0A', tintLight: '#FFB340', gradientStart: '#FF9F0A', gradientEnd: '#FF375F' },
  sky: { tint: '#64D2FF', tintLight: '#99E0FF', gradientStart: '#64D2FF', gradientEnd: '#5E5CE6' },
};

export function getThemeColors(
  mode: 'dark' | 'light',
  palette: ColorPalette = 'default'
): ThemeColors {
  const base = mode === 'dark' ? { ...dark } : { ...light };
  const t = tints[palette];
  return {
    ...base,
    tint: t.tint,
    tintLight: t.tintLight,
    gradientStart: t.gradientStart,
    gradientEnd: t.gradientEnd,
    userBubble: t.tint,
    todoActive: t.tint,
  };
}
