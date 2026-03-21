/**
 * Theme Context — iOS system appearance 대응
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeColors, type ThemeColors, type ColorPalette } from './colors';
import { STORAGE_KEY_THEME } from '../../core/constants';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  palette: ColorPalette;
  c: ThemeColors;  // 짧은 이름 — 모든 컴포넌트에서 c.label, c.tint 등으로 접근
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [palette, setPaletteState] = useState<ColorPalette>('default');

  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem(STORAGE_KEY_THEME);
        if (s) { const p = JSON.parse(s); setModeState(p.mode || 'dark'); setPaletteState(p.palette || 'default'); }
      } catch {}
    })();
  }, []);

  const save = (m: ThemeMode, p: ColorPalette) =>
    AsyncStorage.setItem(STORAGE_KEY_THEME, JSON.stringify({ mode: m, palette: p })).catch(() => {});

  const setMode = (m: ThemeMode) => { setModeState(m); save(m, palette); };
  const setPalette = (p: ColorPalette) => { setPaletteState(p); save(mode, p); };

  const isDark = mode === 'system' ? sys !== 'light' : mode === 'dark';
  const c = useMemo(() => getThemeColors(isDark ? 'dark' : 'light', palette), [isDark, palette]);

  return (
    <ThemeContext.Provider value={{ mode, isDark, palette, c, setMode, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
