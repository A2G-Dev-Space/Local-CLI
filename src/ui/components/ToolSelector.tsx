/**
 * Tool Selector Component
 *
 * Allows enabling/disabling optional tool groups via /tool command
 * UI style matches ModelSelector for consistency
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Spinner from 'ink-spinner';
import { toolRegistry, OptionalToolGroup } from '../../tools/registry.js';

/**
 * Check if Chrome/Chromium is installed (or browser-server.exe is available)
 */
function isChromeInstalled(): boolean {
  // Check if browser-server.exe exists (handles Chrome/Edge on Windows)
  const homeDir = os.homedir();
  const browserServerPaths = [
    path.join(homeDir, '.local-cli', 'repo', 'bin', 'browser-server.exe'),
    path.join(homeDir, '.local', 'bin', 'browser-server.exe'),
  ];

  for (const p of browserServerPaths) {
    if (fs.existsSync(p)) {
      return true;
    }
  }

  // Fallback: check Linux Chrome installation
  try {
    execSync('which google-chrome || which chromium-browser || which chromium', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

interface ToolSelectorProps {
  onClose: () => void;
}

interface SelectItem {
  label: string;
  value: string;
}

export const ToolSelector: React.FC<ToolSelectorProps> = ({ onClose }) => {
  const [toolGroups, setToolGroups] = useState<OptionalToolGroup[]>(() =>
    toolRegistry.getOptionalToolGroups()
  );
  const [isToggling, setIsToggling] = useState(false);
  const [togglingGroup, setTogglingGroup] = useState<{ name: string; enabling: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle keyboard input
  useInput((_input, key) => {
    if (key.escape && !isToggling) {
      onClose();
    }
    // Clear error message on any key press
    if (errorMessage) {
      setErrorMessage(null);
    }
  });

  // Handle tool group selection (toggle)
  const handleSelect = useCallback(
    async (item: SelectItem) => {
      if (isToggling) return;

      const groupId = item.value;
      const group = toolGroups.find(g => g.id === groupId);
      const groupName = group?.name || groupId;
      const isEnabling = !group?.enabled;

      // Check Chrome installation when enabling browser tools
      if (groupId === 'browser' && isEnabling && !isChromeInstalled()) {
        setErrorMessage('Chrome/browser-server.exe not found');
        return;
      }

      setIsToggling(true);
      setTogglingGroup({ name: groupName, enabling: isEnabling });
      setErrorMessage(null);

      try {
        const result = await toolRegistry.toggleToolGroup(groupId);
        setToolGroups(toolRegistry.getOptionalToolGroups());

        // Show error if validation failed
        if (!result.success && result.error) {
          setErrorMessage(result.error);
        }
      } finally {
        setIsToggling(false);
        setTogglingGroup(null);
      }
    },
    [isToggling, toolGroups]
  );

  // Build menu items
  const menuItems: SelectItem[] = toolGroups.map((group) => {
    const statusIcon = group.enabled ? '●' : '○';
    const statusText = group.enabled ? ' (enabled)' : '';
    const toolCount = group.tools.length;

    return {
      label: `${statusIcon} ${group.name} (${toolCount} tools)${statusText}`,
      value: group.id,
    };
  });

  if (toolGroups.length === 0) {
    return (
      <Box flexDirection="column">
        <Box borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text color="cyan" bold>
            Optional Tools
          </Text>
        </Box>
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text color="gray">No optional tools available.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>ESC: close</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>
          Optional Tools
        </Text>
      </Box>

      {/* Tool Groups List */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <SelectInput items={menuItems} onSelect={handleSelect} />
      </Box>

      {/* Legend */}
      <Box marginTop={1} paddingX={1}>
        <Text color="green">● enabled </Text>
        <Text color="gray">○ disabled</Text>
      </Box>

      {/* Description of selected tools */}
      {toolGroups.some((g) => g.enabled) && (
        <Box paddingX={1}>
          <Text color="yellow">Active: </Text>
          <Text color="white">
            {toolGroups
              .filter((g) => g.enabled)
              .map((g) => g.name)
              .join(', ')}
          </Text>
        </Box>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Box
          marginTop={1}
          borderStyle="single"
          borderColor="red"
          paddingX={1}
          flexDirection="column"
        >
          <Text color="red" bold>
            ✗ Enable Failed
          </Text>
          <Text color="white">{errorMessage}</Text>
        </Box>
      )}

      {/* Loading indicator with spinner */}
      {isToggling && togglingGroup && (
        <Box marginTop={1} paddingX={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="yellow">
            {' '}
            {togglingGroup.enabling
              ? `Starting ${togglingGroup.name}...`
              : `Stopping ${togglingGroup.name}...`}
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>↑↓: move | Enter: toggle | ESC: close</Text>
      </Box>
    </Box>
  );
};
