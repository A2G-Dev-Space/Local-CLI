/**
 * Color System (Android)
 *
 * 감동적인 UI를 위한 테마 색상 시스템
 * Electron의 ColorPalette 개념을 확장한 모바일 최적화 컬러 팔레트
 */

export type ColorPalette = 'default' | 'rose' | 'mint' | 'lavender' | 'peach' | 'sky';

export interface ThemeColors {
  // Background layers
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Primary accent
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryGlow: string;

  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;

  // Chat bubbles
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  assistantBubbleText: string;

  // UI elements
  border: string;
  borderLight: string;
  separator: string;
  inputBackground: string;
  inputBorder: string;
  placeholder: string;

  // Status bar
  statusBar: string;

  // Gradient (for headers and accents)
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;

  // Tool execution
  toolBackground: string;
  toolBorder: string;
  toolIcon: string;

  // TODO status
  todoPending: string;
  todoInProgress: string;
  todoCompleted: string;
  todoFailed: string;
}

const darkBase: ThemeColors = {
  background: '#0A0A12',
  surface: '#12121E',
  surfaceElevated: '#1A1A2E',
  card: '#16162A',

  text: '#F0F0F8',
  textSecondary: '#A0A0B8',
  textTertiary: '#6B6B82',
  textInverse: '#0A0A12',

  primary: '#7C5CFC',
  primaryLight: '#9B82FF',
  primaryDark: '#5A3AD8',
  primaryGlow: 'rgba(124, 92, 252, 0.15)',

  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',

  userBubble: '#7C5CFC',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#1E1E36',
  assistantBubbleText: '#F0F0F8',

  border: '#2A2A42',
  borderLight: '#1E1E36',
  separator: '#1A1A2E',
  inputBackground: '#16162A',
  inputBorder: '#2A2A42',
  placeholder: '#5A5A72',

  statusBar: '#0A0A12',

  gradientStart: '#7C5CFC',
  gradientMid: '#A855F7',
  gradientEnd: '#EC4899',

  toolBackground: '#12122A',
  toolBorder: '#2A2A48',
  toolIcon: '#9B82FF',

  todoPending: '#6B6B82',
  todoInProgress: '#60A5FA',
  todoCompleted: '#34D399',
  todoFailed: '#F87171',
};

const lightBase: ThemeColors = {
  background: '#FAFAFE',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#F5F5FC',

  text: '#1A1A2E',
  textSecondary: '#5A5A72',
  textTertiary: '#9090A8',
  textInverse: '#FFFFFF',

  primary: '#7C5CFC',
  primaryLight: '#9B82FF',
  primaryDark: '#5A3AD8',
  primaryGlow: 'rgba(124, 92, 252, 0.08)',

  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',

  userBubble: '#7C5CFC',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#F0F0FA',
  assistantBubbleText: '#1A1A2E',

  border: '#E5E5F0',
  borderLight: '#F0F0FA',
  separator: '#F0F0FA',
  inputBackground: '#F5F5FC',
  inputBorder: '#E0E0F0',
  placeholder: '#9090A8',

  statusBar: '#FFFFFF',

  gradientStart: '#7C5CFC',
  gradientMid: '#A855F7',
  gradientEnd: '#EC4899',

  toolBackground: '#F5F5FF',
  toolBorder: '#E0E0F0',
  toolIcon: '#7C5CFC',

  todoPending: '#9090A8',
  todoInProgress: '#2563EB',
  todoCompleted: '#059669',
  todoFailed: '#DC2626',
};

// Palette accent overrides
const paletteOverrides: Record<ColorPalette, Partial<ThemeColors>> = {
  default: {},
  rose: {
    primary: '#F43F5E',
    primaryLight: '#FB7185',
    primaryDark: '#E11D48',
    primaryGlow: 'rgba(244, 63, 94, 0.15)',
    userBubble: '#F43F5E',
    gradientStart: '#F43F5E',
    gradientMid: '#FB7185',
    gradientEnd: '#FBBF24',
    toolIcon: '#FB7185',
  },
  mint: {
    primary: '#10B981',
    primaryLight: '#34D399',
    primaryDark: '#059669',
    primaryGlow: 'rgba(16, 185, 129, 0.15)',
    userBubble: '#10B981',
    gradientStart: '#10B981',
    gradientMid: '#06B6D4',
    gradientEnd: '#3B82F6',
    toolIcon: '#34D399',
  },
  lavender: {
    primary: '#A855F7',
    primaryLight: '#C084FC',
    primaryDark: '#9333EA',
    primaryGlow: 'rgba(168, 85, 247, 0.15)',
    userBubble: '#A855F7',
    gradientStart: '#A855F7',
    gradientMid: '#EC4899',
    gradientEnd: '#F43F5E',
    toolIcon: '#C084FC',
  },
  peach: {
    primary: '#F97316',
    primaryLight: '#FB923C',
    primaryDark: '#EA580C',
    primaryGlow: 'rgba(249, 115, 22, 0.15)',
    userBubble: '#F97316',
    gradientStart: '#F97316',
    gradientMid: '#F43F5E',
    gradientEnd: '#A855F7',
    toolIcon: '#FB923C',
  },
  sky: {
    primary: '#0EA5E9',
    primaryLight: '#38BDF8',
    primaryDark: '#0284C7',
    primaryGlow: 'rgba(14, 165, 233, 0.15)',
    userBubble: '#0EA5E9',
    gradientStart: '#0EA5E9',
    gradientMid: '#6366F1',
    gradientEnd: '#A855F7',
    toolIcon: '#38BDF8',
  },
};

export function getThemeColors(
  mode: 'dark' | 'light',
  palette: ColorPalette = 'default'
): ThemeColors {
  const base = mode === 'dark' ? { ...darkBase } : { ...lightBase };
  const overrides = paletteOverrides[palette] || {};
  return { ...base, ...overrides };
}
