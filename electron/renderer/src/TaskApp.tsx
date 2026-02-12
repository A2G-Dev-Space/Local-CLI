/**
 * Hanseol UI - Task Window
 * Displays agent TODO progress in a separate window.
 * Subscribes to IPC events independently (separate renderer process).
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../../preload/index';
import type { TodoItem } from './components/TodoList';
import { useTranslation } from './i18n/LanguageContext';
import TitleBar from './components/TitleBar';
import TodoPanel from './components/TodoPanel';
import './styles/global.css';
import './styles/App.css';

type ColorPalette = 'default' | 'rose' | 'mint' | 'lavender' | 'peach' | 'sky';

const FONT_FAMILY_MAP: Record<string, string> = {
  default: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Cafe24Syongsyong: "'Cafe24Syongsyong', -apple-system, sans-serif",
  Cafe24Dongdong: "'Cafe24Dongdong', -apple-system, sans-serif",
  Cafe24PROSlimMax: "'Cafe24PROSlimMax', -apple-system, sans-serif",
  Cafe24Oneprettynight: "'Cafe24Oneprettynight', -apple-system, sans-serif",
  Cafe24SsurroundAir: "'Cafe24SsurroundAir', -apple-system, sans-serif",
  Cafe24Moyamoya: "'Cafe24Moyamoya', -apple-system, sans-serif",
};

const TaskApp: React.FC = () => {
  const { t } = useTranslation();

  // System state
  const [theme, setTheme] = useState<Theme>('light');
  const [fontSize, setFontSize] = useState<number>(12);
  const [colorPalette, setColorPalette] = useState<ColorPalette>('default');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isPinned, setIsPinned] = useState(false);

  // Task state
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isWaitingForUser, setIsWaitingForUser] = useState(false);

  // Handle appearance change from Settings (Chat Window → broadcast → Task Window)
  const handleAppearanceChange = useCallback((data: { key: string; value: unknown }) => {
    switch (data.key) {
      case 'fontSize':
        if (typeof data.value === 'number') {
          setFontSize(data.value);
        }
        break;
      case 'colorPalette':
        if (typeof data.value === 'string') {
          setColorPalette(data.value as ColorPalette);
        }
        break;
      case 'fontFamily':
        if (typeof data.value === 'string') {
          const cssFamily = FONT_FAMILY_MAP[data.value] || FONT_FAMILY_MAP.default;
          document.documentElement.style.setProperty('--font-sans', cssFamily);
        }
        break;
      case 'theme':
        if (data.value === 'dark' || data.value === 'light') {
          setTheme(data.value);
        }
        break;
    }
  }, []);

  // Toggle pin (always on top)
  const handlePinToggle = useCallback(async () => {
    if (!window.electronAPI?.taskWindow) return;
    try {
      const newPinned = !isPinned;
      await window.electronAPI.taskWindow.setAlwaysOnTop(newPinned);
      setIsPinned(newPinned);
    } catch (error) {
      window.electronAPI?.log?.error('[TaskApp] Failed to toggle pin', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [isPinned]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      if (!window.electronAPI) return;
      try {
        const [savedTheme, maximized, initialTodos, config, pinned] = await Promise.all([
          window.electronAPI.config.getTheme(),
          window.electronAPI.window.isMaximized(),
          window.electronAPI.agent.getTodos(),
          window.electronAPI.config.getAll(),
          window.electronAPI.taskWindow?.isAlwaysOnTop?.() ?? false,
        ]);

        // Theme
        if (savedTheme === 'system') {
          const systemTheme = await window.electronAPI.theme.getSystem();
          setTheme(systemTheme);
        } else {
          setTheme(savedTheme as Theme);
        }

        // Font size, color palette, font family from config
        const configAny = config as unknown as Record<string, unknown>;
        if (configAny?.fontSize && typeof configAny.fontSize === 'number') {
          setFontSize(configAny.fontSize);
        }
        if (configAny?.colorPalette) {
          setColorPalette(configAny.colorPalette as ColorPalette);
        }
        if (configAny?.fontFamily && typeof configAny.fontFamily === 'string') {
          const cssFamily = FONT_FAMILY_MAP[configAny.fontFamily] || FONT_FAMILY_MAP.default;
          document.documentElement.style.setProperty('--font-sans', cssFamily);
        }

        setIsMaximized(maximized);
        setIsPinned(pinned);
        if (initialTodos) setTodos(initialTodos);
      } catch (error) {
        window.electronAPI?.log?.error('[TaskApp] Init failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    init();
  }, []);

  // Event listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubMaximize = window.electronAPI.window.onMaximizeChange(setIsMaximized);
    const unsubFocus = window.electronAPI.window.onFocusChange(setIsFocused);
    const unsubTheme = window.electronAPI.theme.onChange(setTheme);
    const unsubAppearance = window.electronAPI.theme.onAppearanceChange?.(handleAppearanceChange);
    const unsubTodo = window.electronAPI.agent.onTodoUpdate?.((newTodos: TodoItem[]) => {
      setTodos(newTodos);
    });

    // ask_to_user waiting indicator
    const unsubAskUser = window.electronAPI.agent.onAskUser?.(() => {
      setIsWaitingForUser(true);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubAskUserResolved = (window.electronAPI.agent as any)?.onAskUserResolved?.(() => {
      setIsWaitingForUser(false);
    });
    const unsubComplete = window.electronAPI.agent.onComplete?.(() => {
      setIsWaitingForUser(false);
    });

    return () => {
      unsubMaximize();
      unsubFocus();
      unsubTheme();
      unsubAppearance?.();
      unsubTodo?.();
      unsubAskUser?.();
      unsubAskUserResolved?.();
      unsubComplete?.();
    };
  }, [handleAppearanceChange]);

  return (
    <div
      className="app-root task-app-root"
      data-theme={theme}
      data-palette={colorPalette}
      style={{ '--user-font-size': `${fontSize}px` } as React.CSSProperties}
    >
      <TitleBar
        title={t('task.title')}
        isMaximized={isMaximized}
        isFocused={isFocused}
        onMinimize={() => window.electronAPI?.window.minimize()}
        onMaximize={() => window.electronAPI?.window.maximize()}
        onClose={() => window.electronAPI?.window.close()}
        simplified
        isPinned={isPinned}
        onPinToggle={handlePinToggle}
      />
      <div className="task-content">
        {isWaitingForUser && (
          <div className="task-waiting-banner">
            <div className="task-waiting-pulse" />
            <span>{t('task.waitingForUser')}</span>
          </div>
        )}
        {todos.length > 0 ? (
          <TodoPanel todos={todos} />
        ) : (
          <div className="task-empty">
            <div className="task-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z" />
              </svg>
            </div>
            <p className="task-empty-text">
              {t('task.emptyLine1')}
              <br />
              {t('task.emptyLine2')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskApp;
