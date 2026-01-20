/**
 * Terminal Component
 * PowerShell terminal with ANSI color support
 * Simple passthrough mode - executes commands one at a time
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Terminal.css';

interface TerminalProps {
  currentDirectory: string;
}

interface OutputLine {
  id: number;
  type: 'stdout' | 'stderr' | 'command' | 'system';
  content: string;
  timestamp: Date;
}

// ANSI color code mapping
const ANSI_COLORS: Record<string, string> = {
  '30': 'var(--terminal-black)',
  '31': 'var(--terminal-red)',
  '32': 'var(--terminal-green)',
  '33': 'var(--terminal-yellow)',
  '34': 'var(--terminal-blue)',
  '35': 'var(--terminal-magenta)',
  '36': 'var(--terminal-cyan)',
  '37': 'var(--terminal-white)',
  '90': 'var(--terminal-bright-black)',
  '91': 'var(--terminal-bright-red)',
  '92': 'var(--terminal-bright-green)',
  '93': 'var(--terminal-bright-yellow)',
  '94': 'var(--terminal-bright-blue)',
  '95': 'var(--terminal-bright-magenta)',
  '96': 'var(--terminal-bright-cyan)',
  '97': 'var(--terminal-bright-white)',
};

const ANSI_BG_COLORS: Record<string, string> = {
  '40': 'var(--terminal-black)',
  '41': 'var(--terminal-red)',
  '42': 'var(--terminal-green)',
  '43': 'var(--terminal-yellow)',
  '44': 'var(--terminal-blue)',
  '45': 'var(--terminal-magenta)',
  '46': 'var(--terminal-cyan)',
  '47': 'var(--terminal-white)',
};

// Parse ANSI codes and return styled elements
const parseAnsi = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const ansiRegex = /\x1B\[([0-9;]+)m/g;

  let lastIndex = 0;
  let currentStyle: React.CSSProperties = {};
  let match;

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before the ANSI code
    if (match.index > lastIndex) {
      parts.push(
        <span key={`${lastIndex}-text`} style={currentStyle}>
          {text.substring(lastIndex, match.index)}
        </span>
      );
    }

    // Parse ANSI codes
    const codes = match[1].split(';');
    codes.forEach(code => {
      if (code === '0') {
        currentStyle = {};
      } else if (code === '1') {
        currentStyle = { ...currentStyle, fontWeight: 'bold' };
      } else if (code === '3') {
        currentStyle = { ...currentStyle, fontStyle: 'italic' };
      } else if (code === '4') {
        currentStyle = { ...currentStyle, textDecoration: 'underline' };
      } else if (ANSI_COLORS[code]) {
        currentStyle = { ...currentStyle, color: ANSI_COLORS[code] };
      } else if (ANSI_BG_COLORS[code]) {
        currentStyle = { ...currentStyle, backgroundColor: ANSI_BG_COLORS[code] };
      }
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`${lastIndex}-end`} style={currentStyle}>
        {text.substring(lastIndex)}
      </span>
    );
  }

  return parts.length > 0 ? parts : [<span key="plain">{text}</span>];
};

const Terminal: React.FC<TerminalProps> = ({ currentDirectory }) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lineIdRef = useRef(0);

  // Add output line
  const addOutput = useCallback((type: OutputLine['type'], content: string) => {
    const newLine: OutputLine = {
      id: lineIdRef.current++,
      type,
      content,
      timestamp: new Date(),
    };
    setOutput(prev => [...prev, newLine]);
  }, []);

  // Initialize terminal
  useEffect(() => {
    addOutput('system', 'PowerShell Terminal Ready');
    if (currentDirectory) {
      addOutput('system', `Working directory: ${currentDirectory}`);
    }
  }, [addOutput, currentDirectory]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input on click
  useEffect(() => {
    const handleClick = () => inputRef.current?.focus();
    const container = outputRef.current?.parentElement;
    container?.addEventListener('click', handleClick);
    return () => container?.removeEventListener('click', handleClick);
  }, []);

  // Execute command (one-shot mode)
  const executeCommand = async () => {
    if (!input.trim() || isExecuting) return;

    const command = input.trim();
    setInput('');
    setHistoryIndex(-1);
    setCommandHistory(prev => [command, ...prev.slice(0, 99)]);
    addOutput('command', `PS> ${command}`);

    setIsExecuting(true);
    try {
      const result = await window.electronAPI.powershell.executeOnce(command, currentDirectory);
      if (result.success) {
        if (result.stdout) addOutput('stdout', result.stdout);
        if (result.stderr) addOutput('stderr', result.stderr);
      } else {
        addOutput('stderr', result.error || 'Unknown error');
      }
    } catch (error) {
      addOutput('stderr', `Error: ${error}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Clear output
  const clearOutput = () => {
    setOutput([]);
    addOutput('system', 'Terminal cleared');
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clearOutput();
    }
  };

  // Get line class name
  const getLineClassName = (type: OutputLine['type']) => {
    const classMap: Record<OutputLine['type'], string> = {
      stdout: 'terminal-line stdout',
      stderr: 'terminal-line stderr',
      command: 'terminal-line command',
      system: 'terminal-line system',
    };
    return classMap[type];
  };

  return (
    <div className="terminal">
      {/* Terminal Toolbar */}
      <div className="terminal-toolbar">
        <div className="terminal-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>
          </svg>
          <span className="session-label">PowerShell</span>
        </div>
        <div className="terminal-actions">
          <button className="terminal-btn" onClick={clearOutput} title="Clear (Ctrl+L)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="terminal-output" ref={outputRef}>
        {output.map((line) => (
          <div key={line.id} className={getLineClassName(line.type)}>
            <span className="line-content">
              {parseAnsi(line.content)}
            </span>
          </div>
        ))}
        {isExecuting && (
          <div className="terminal-line system">
            <span className="spinner" /> Executing...
          </div>
        )}
      </div>

      {/* Terminal Input */}
      <div className="terminal-input-container">
        <span className="terminal-prompt">PS&gt;</span>
        <input
          ref={inputRef}
          type="text"
          className="terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          disabled={isExecuting}
          autoFocus
        />
        <button
          className="terminal-execute-btn"
          onClick={executeCommand}
          disabled={isExecuting || !input.trim()}
          title="Execute"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 12l6 6v-4h10v-4H8V6z" transform="rotate(180 12 12)"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Terminal;
