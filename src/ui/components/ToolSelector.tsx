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
import { toolRegistry, OptionalToolGroup } from '../../tools/registry.js';

const BROWSER_TOOLS_GUIDE_URL = 'http://a2g.samsungds.net:4090/docs/guide/browser-tools.html';

/**
 * Check if Chrome/Chromium is installed
 */
function isChromeInstalled(): boolean {
  try {
    execSync('which google-chrome || which chromium-browser || which chromium', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Open URL in default browser
 */
function openUrl(url: string): void {
  try {
    // Try xdg-open (Linux), then open (macOS), then start (Windows)
    execSync(`xdg-open "${url}" 2>/dev/null || open "${url}" 2>/dev/null || start "${url}" 2>/dev/null`, { stdio: 'ignore' });
  } catch {
    // Ignore errors
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
  const [chromeWarning, setChromeWarning] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Handle keyboard input
  useInput((_input, key) => {
    if (key.escape && !isToggling) {
      onClose();
    }
  });

  // Handle tool group selection (toggle)
  const handleSelect = useCallback(
    async (item: SelectItem) => {
      if (isToggling) return;

      const groupId = item.value;
      const group = toolGroups.find(g => g.id === groupId);

      // Check Chrome installation when enabling browser tools
      if (groupId === 'browser' && group && !group.enabled) {
        if (!isChromeInstalled()) {
          setChromeWarning(`Chrome이 설치되지 않았습니다. 설치 가이드: ${BROWSER_TOOLS_GUIDE_URL}`);
          openUrl(BROWSER_TOOLS_GUIDE_URL);
          return;
        }
      }

      setChromeWarning(null);
      setIsToggling(true);

      try {
        await toolRegistry.toggleToolGroup(groupId);
        setToolGroups(toolRegistry.getOptionalToolGroups());
      } finally {
        setIsToggling(false);
      }
    },
    [toolGroups, isToggling]
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

      {/* Chrome Warning */}
      {chromeWarning && (
        <Box marginTop={1} paddingX={1} flexDirection="column">
          <Text color="red">⚠ {chromeWarning}</Text>
          <Text color="cyan">브라우저에서 가이드가 열립니다.</Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>↑↓: move | Enter: toggle | ESC: close</Text>
      </Box>
    </Box>
  );
};
