/**
 * Theme Context (Android)
 *
 * 앱 전체 테마 관리
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeColors, type ThemeColors, type ColorPalette } from './colors';
import { STORAGE_KEY_THEME } from '../../core/constants';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedMode: 'dark' | 'light';
  palette: ColorPalette;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [palette, setPaletteState] = useState<ColorPalette>('default');

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_THEME);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.mode) setModeState(parsed.mode);
          if (parsed.palette) setPaletteState(parsed.palette);
        }
      } catch {}
    })();
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY_THEME, JSON.stringify({ mode: newMode, palette })).catch(() => {});
  };

  const setPalette = (newPalette: ColorPalette) => {
    setPaletteState(newPalette);
    AsyncStorage.setItem(STORAGE_KEY_THEME, JSON.stringify({ mode, palette: newPalette })).catch(() => {});
  };

  const resolvedMode = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  const colors = useMemo(() => getThemeColors(resolvedMode, palette), [resolvedMode, palette]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, palette, colors, setMode, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
