/**
 * Custom Text Input Component
 *
 * Replaces ink-text-input with full control over cursor positioning and keyboard shortcuts
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useStdin } from 'ink';

interface CustomTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
}

export const CustomTextInput: React.FC<CustomTextInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  focus = true,
}) => {
  const { stdin, setRawMode } = useStdin();
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const previousValueLength = useRef<number>(value.length);

  // Use refs to access latest values without recreating handleData
  const valueRef = useRef(value);
  const cursorPositionRef = useRef(cursorPosition);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);

  // Keep refs in sync
  useEffect(() => {
    valueRef.current = value;
    cursorPositionRef.current = cursorPosition;
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
  });

  // Synchronize cursor position when value changes externally
  useEffect(() => {
    // When value is cleared, reset cursor to start
    if (value.length === 0) {
      setCursorPosition(0);
      previousValueLength.current = 0;
      return;
    }

    // When value increases (e.g., file inserted), move cursor to end
    if (value.length > previousValueLength.current) {
      setCursorPosition(value.length);
      previousValueLength.current = value.length;
      return;
    }

    // When value decreases (e.g., external deletion), adjust cursor if needed
    if (value.length < cursorPosition) {
      setCursorPosition(value.length);
    }

    previousValueLength.current = value.length;
  }, [value, cursorPosition]);

  // Store handleData in a ref so it doesn't cause useEffect re-runs
  const handleDataRef = useRef((data: Buffer) => {
    const str = data.toString();
    const currentValue = valueRef.current;
    const currentCursor = cursorPositionRef.current;

    // Helper: Delete word before cursor (shared by Alt+Backspace, Ctrl+Backspace, Ctrl+W)
    const deleteWordBeforeCursor = (value: string, cursor: number) => {
      if (cursor > 0) {
        const beforeCursor = value.slice(0, cursor);
        const afterCursor = value.slice(cursor);

        // Find start of current word
        let newPos = cursor - 1;
        // Skip trailing spaces
        while (newPos > 0 && beforeCursor[newPos] === ' ') {
          newPos--;
        }
        // Delete until space or start
        while (newPos > 0 && beforeCursor[newPos - 1] !== ' ') {
          newPos--;
        }

        const newValue = beforeCursor.slice(0, newPos) + afterCursor;
        onChangeRef.current(newValue);
        setCursorPosition(newPos);
      }
    };

    // Handle different key sequences
    // Check for special escape sequences first
    if (str.startsWith('\x1b')) {
      // Alt + Enter - insert newline (multi-line input)
      // Alt+Enter sends ESC + CR (\x1b\r) or ESC + LF (\x1b\n)
      if (str === '\x1b\r' || str === '\x1b\n') {
        const newValue = currentValue.slice(0, currentCursor) + '\n' + currentValue.slice(currentCursor);
        onChangeRef.current(newValue);
        setCursorPosition(currentCursor + 1);
        return;
      }

      // ESC sequences (arrow keys, home, end, etc.)
      if (str === '\x1b[H' || str === '\x1b[1~') {
        // Home key
        setCursorPosition(0);
        return;
      }
      if (str === '\x1b[F' || str === '\x1b[4~') {
        // End key
        setCursorPosition(currentValue.length);
        return;
      }
      if (str === '\x1b[3~') {
        // Delete key - delete character after cursor
        if (currentCursor < currentValue.length) {
          const newValue = currentValue.slice(0, currentCursor) + currentValue.slice(currentCursor + 1);
          onChangeRef.current(newValue);
        }
        return;
      }
      if (str === '\x1b[D') {
        // Left arrow
        setCursorPosition(Math.max(0, currentCursor - 1));
        return;
      }
      if (str === '\x1b[C') {
        // Right arrow
        setCursorPosition(Math.min(currentValue.length, currentCursor + 1));
        return;
      }
      if (str === '\x1b\x7f' || str === '\x1b\x08') {
        // Alt + Backspace - delete word before cursor (handled below with Ctrl+Backspace)
        deleteWordBeforeCursor(currentValue, currentCursor);
        return;
      }
      // Ignore other escape sequences
      return;
    }

    // Ctrl+A - move to start of line (like Home)
    if (str === '\x01') {
      setCursorPosition(0);
      return;
    }

    // Ctrl+E - move to end of line (like End)
    if (str === '\x05') {
      setCursorPosition(currentValue.length);
      return;
    }

    // Ctrl+C is handled by parent component's useInput hook
    if (str === '\x03') {
      // Ignore Ctrl+C in custom input, let parent handle it
      return;
    }

    // Ctrl+W / Ctrl+Backspace - delete word before cursor
    if (str === '\x17') {
      deleteWordBeforeCursor(currentValue, currentCursor);
      return;
    }

    // Regular backspace
    if (str === '\x7f' || str === '\x08') {
      if (currentCursor > 0) {
        const newValue = currentValue.slice(0, currentCursor - 1) + currentValue.slice(currentCursor);
        onChangeRef.current(newValue);
        setCursorPosition(currentCursor - 1);
      }
      return;
    }

    // Enter key
    if (str === '\r' || str === '\n') {
      if (onSubmitRef.current) {
        onSubmitRef.current(currentValue);
      }
      return;
    }

    // Regular character input (printable characters including multi-byte UTF-8 like 한글)
    // Filter out control characters (0x00-0x1F and 0x7F) but allow everything else
    // This allows ASCII printable chars, extended ASCII, and multi-byte UTF-8 characters
    const charCode = str.charCodeAt(0);
    if (charCode >= 0x20 && charCode !== 0x7F) {
      const newValue = currentValue.slice(0, currentCursor) + str + currentValue.slice(currentCursor);
      onChangeRef.current(newValue);
      setCursorPosition(currentCursor + str.length);
    }
  });

  useEffect(() => {
    if (!focus || !stdin) {
      return;
    }

    // Set raw mode to capture all keystrokes
    setRawMode?.(true);

    const handler = handleDataRef.current;
    stdin.on('data', handler);

    return () => {
      stdin.off('data', handler);
      setRawMode?.(false);
    };
  }, [focus, stdin, setRawMode]); // handleDataRef.current is stable

  // Render the input with cursor (supports multi-line)
  const renderValue = () => {
    if (value.length === 0) {
      return (
        <Text>
          {focus && <Text inverse> </Text>}
          <Text dimColor>{placeholder}</Text>
        </Text>
      );
    }

    const beforeCursor = value.slice(0, cursorPosition);
    const atCursor = value[cursorPosition] || ' ';
    const afterCursor = value.slice(cursorPosition + 1);

    // Check if content has multiple lines
    const hasNewlines = value.includes('\n');

    if (!hasNewlines) {
      // Single line rendering (original behavior)
      return (
        <Text>
          {beforeCursor}
          {focus && <Text inverse>{atCursor}</Text>}
          {!focus && atCursor !== ' ' && <Text>{atCursor}</Text>}
          {afterCursor}
        </Text>
      );
    }

    // Multi-line rendering
    // Split by newlines and render each line, placing cursor correctly
    const lines = value.split('\n');
    let charCount = 0;
    let cursorLineIndex = 0;
    let cursorPosInLine = 0;

    // Find which line the cursor is on
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineLength = line.length;
      if (charCount + lineLength >= cursorPosition) {
        cursorLineIndex = i;
        cursorPosInLine = cursorPosition - charCount;
        break;
      }
      charCount += lineLength + 1; // +1 for the newline character
    }

    return (
      <Box flexDirection="column">
        {lines.map((line, lineIndex) => {
          const isCursorLine = lineIndex === cursorLineIndex;

          if (!isCursorLine) {
            return <Text key={lineIndex}>{line || ' '}</Text>;
          }

          // Render line with cursor
          const beforeCursorInLine = line.slice(0, cursorPosInLine);
          const atCursorChar = line[cursorPosInLine] || ' ';
          const afterCursorInLine = line.slice(cursorPosInLine + 1);

          return (
            <Text key={lineIndex}>
              {beforeCursorInLine}
              {focus && <Text inverse>{atCursorChar}</Text>}
              {!focus && atCursorChar !== ' ' && <Text>{atCursorChar}</Text>}
              {afterCursorInLine}
            </Text>
          );
        })}
      </Box>
    );
  };

  return renderValue();
};

export default CustomTextInput;
