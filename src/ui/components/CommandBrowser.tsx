/**
 * Command Browser Component
 *
 * Displays available slash commands with descriptions and argument hints
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import {
  filterCommands,
} from '../hooks/slashCommandProcessor.js';
import { useTerminalWidth, clampText } from '../hooks/useTerminalWidth.js';

interface CommandBrowserProps {
  partialCommand: string;
  args: string; // Used to detect if command has arguments for hint display
  onSelect: (command: string, shouldSubmit: boolean) => void;
  onCancel: () => void;
}

interface SelectItem {
  label: string;
  value: string;
}

const MAX_VISIBLE_COMMANDS = 10;

export const CommandBrowser: React.FC<CommandBrowserProps> = ({
  partialCommand,
  args: _args,
  onSelect,
  onCancel,
}) => {
  const termWidth = useTerminalWidth();
  const commands = filterCommands(partialCommand, MAX_VISIBLE_COMMANDS);

  // Dynamic column width based on terminal size
  const commandColWidth = Math.max(15, Math.min(25, Math.floor(termWidth * 0.3)));
  const descMaxWidth = Math.max(10, termWidth - commandColWidth - 8);

  // Convert CommandMetadata to SelectItem format
  const items: SelectItem[] = commands.map((cmd) => {
    const aliasText = cmd.aliases && cmd.aliases.length > 0
      ? ` (${cmd.aliases.join(', ')})`
      : '';
    const commandPart = `${cmd.name}${aliasText}`;
    // Pad to dynamic column width for alignment
    const paddedCommand = commandPart.padEnd(commandColWidth);
    const desc = clampText(cmd.description, descMaxWidth);
    return {
      label: `${paddedCommand} ${desc}`,
      value: cmd.name,
    };
  });

  // Custom keyboard handling
  useInput((_inputChar, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    // Tab key for autocomplete (select first command, don't submit)
    if (key.tab && items.length > 0) {
      const firstCommand = items[0];
      if (firstCommand) {
        onSelect(firstCommand.value, false);
      }
      return;
    }
  });

  // Handle Enter key from SelectInput (submit command)
  const handleSelect = (item: SelectItem) => {
    onSelect(item.value, true);
  };

  // Show argument hint if command is complete and has args hint
  const currentCommand = commands.find((cmd) => cmd.name === `/${partialCommand}`);
  const argsHint = currentCommand?.argsHint;

  if (items.length === 0) {
    return (
      <Box borderStyle="single" borderColor="yellow" paddingX={1} flexDirection="column">
        <Text color="yellow">
          No commands found matching: /{partialCommand}
        </Text>
        <Text dimColor>Press ESC to cancel</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Command List */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} flexDirection="column">
        <Box>
          <SelectInput items={items} onSelect={handleSelect} limit={MAX_VISIBLE_COMMANDS} />
        </Box>
      </Box>

      {/* Argument Hint (shown when command is complete and has args) */}
      {argsHint && (
        <Box
          borderStyle="single"
          borderColor="yellow"
          paddingX={1}
          marginTop={1}
          flexDirection="column"
        >
          <Text color="yellow" bold>
            Expected Arguments:
          </Text>
          <Text color="white">{argsHint}</Text>
        </Box>
      )}
    </Box>
  );
};
