/**
 * Terminal Width Hook & Utilities
 *
 * Provides reactive terminal width tracking and text clamping utilities
 * to prevent line-wrap overflow in Ink's dynamic render area.
 */

import { useState, useEffect } from 'react';

/**
 * React hook that tracks terminal column width in real-time.
 * Re-renders the component when the terminal is resized.
 */
export function useTerminalWidth(): number {
  const [width, setWidth] = useState(process.stdout.columns || 80);

  useEffect(() => {
    const onResize = () => {
      setWidth(process.stdout.columns || 80);
    };
    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
    };
  }, []);

  return width;
}

/**
 * Clamp a single-line string so it never exceeds `maxWidth` visible characters.
 * Appends ellipsis when truncated.
 */
export function clampText(text: string, maxWidth: number): string {
  if (maxWidth < 4) return text.slice(0, maxWidth);
  if (text.length <= maxWidth) return text;
  return text.slice(0, maxWidth - 1) + '\u2026'; // ellipsis character
}

/**
 * Generate a horizontal separator line (e.g. '───') that fits the terminal.
 * @param termWidth - current terminal width
 * @param padding - total horizontal padding/margin to subtract (default 6)
 */
export function separatorLine(termWidth: number, padding: number = 6): string {
  const len = Math.max(10, termWidth - padding);
  return '\u2500'.repeat(len);
}
