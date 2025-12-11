/**
 * useCommandBrowserState Hook
 *
 * Manages command browser state for slash commands
 */

import { useState, useEffect, useCallback } from 'react';
import { detectSlashTrigger, insertSlashCommand } from './slashCommandProcessor.js';

export interface CommandBrowserState {
  showCommandBrowser: boolean;
  partialCommand: string;
  commandArgs: string;
}

export interface CommandBrowserActions {
  handleCommandSelect: (command: string, shouldSubmit: boolean, input: string, onSubmit: (value: string) => void) => string | null;
  handleCommandBrowserCancel: () => void;
  resetCommandBrowser: () => void;
}

export function useCommandBrowserState(
  input: string,
  isProcessing: boolean
): CommandBrowserState & CommandBrowserActions {
  const [showCommandBrowser, setShowCommandBrowser] = useState(false);
  const [partialCommand, setPartialCommand] = useState('');
  const [commandArgs, setCommandArgs] = useState('');

  // Monitor input for '/' slash command trigger
  useEffect(() => {
    if (isProcessing) {
      return;
    }

    if (!input) {
      if (showCommandBrowser) {
        setShowCommandBrowser(false);
        setPartialCommand('');
        setCommandArgs('');
      }
      return;
    }

    const slashInfo = detectSlashTrigger(input);

    if (slashInfo.detected && !showCommandBrowser) {
      setShowCommandBrowser(true);
      setPartialCommand(slashInfo.partialCommand);
      setCommandArgs(slashInfo.args);
    } else if (slashInfo.detected && showCommandBrowser) {
      setPartialCommand(slashInfo.partialCommand);
      setCommandArgs(slashInfo.args);
    } else if (!slashInfo.detected && showCommandBrowser) {
      setShowCommandBrowser(false);
      setPartialCommand('');
      setCommandArgs('');
    }
  }, [input, isProcessing, showCommandBrowser]);

  const handleCommandSelect = useCallback(
    (command: string, shouldSubmit: boolean, currentInput: string, onSubmit: (value: string) => void): string | null => {
      setShowCommandBrowser(false);
      setPartialCommand('');
      setCommandArgs('');

      if (shouldSubmit) {
        onSubmit(command);
        return null;
      } else {
        return insertSlashCommand(currentInput, command);
      }
    },
    []
  );

  const handleCommandBrowserCancel = useCallback(() => {
    setShowCommandBrowser(false);
    setPartialCommand('');
    setCommandArgs('');
  }, []);

  const resetCommandBrowser = useCallback(() => {
    setShowCommandBrowser(false);
    setPartialCommand('');
    setCommandArgs('');
  }, []);

  return {
    showCommandBrowser,
    partialCommand,
    commandArgs,
    handleCommandSelect,
    handleCommandBrowserCancel,
    resetCommandBrowser,
  };
}
