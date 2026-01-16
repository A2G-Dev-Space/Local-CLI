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
import Spinner from 'ink-spinner';
import { toolRegistry, OptionalToolGroup } from '../../tools/registry.js';

const BROWSER_TOOLS_GUIDE_URL = 'http://a2g.samsungds.net:4090/docs/guide/browser-tools.html';
const OFFICE_TOOLS_GUIDE_URL = 'http://a2g.samsungds.net:4090/docs/guide/office-tools.html';

// Office tool group IDs
const OFFICE_TOOL_GROUPS = ['word', 'excel', 'powerpoint'];

/**
 * Check if browser is available for CDP connection
 * CDP approach uses PowerShell to launch Chrome/Edge directly (no browser-server.exe needed)
 */
function isBrowserAvailable(): boolean {
  // Check if running in WSL
  const isWSL = fs.existsSync('/proc/version') &&
    fs.readFileSync('/proc/version', 'utf-8').toLowerCase().includes('microsoft');

  if (isWSL) {
    // WSL: browser-client.ts uses PowerShell to launch Windows Chrome/Edge
    // Actual browser detection happens at launch time
    return true;
  }

  // Native Linux: check if Chrome/Chromium is installed
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
  const [togglingGroup, setTogglingGroup] = useState<{ name: string; enabling: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<{ message: string; groupId: string } | null>(null);

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

      // Check browser availability when enabling browser tools
      if (groupId === 'browser' && group && !group.enabled) {
        if (!isBrowserAvailable()) {
          setChromeWarning(`Chrome이 설치되지 않았습니다. 설치 가이드: ${BROWSER_TOOLS_GUIDE_URL}`);
          openUrl(BROWSER_TOOLS_GUIDE_URL);
          return;
        }
      }

      setChromeWarning(null);
      setIsToggling(true);
      setTogglingGroup({ name: groupName, enabling: isEnabling });
      setErrorMessage(null);

      try {
        const result = await toolRegistry.toggleToolGroup(groupId);
        setToolGroups(toolRegistry.getOptionalToolGroups());

        // Show error if validation failed
        if (!result.success && result.error) {
          setErrorMessage({ message: result.error, groupId });
        }
      } finally {
        setIsToggling(false);
        setTogglingGroup(null);
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

      {/* Performance Notice */}
      <Box paddingX={1} marginBottom={1} flexDirection="column">
        <Text color="yellow" dimColor>
          ⚠ Too many tools can slow down performance. Enable only what you need.
        </Text>
        <Text color="yellow" dimColor>
          ⚠ 너무 많은 도구는 성능 저하를 야기합니다. 필요한 도구만 활성화하세요.
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
          <Text color="white">{errorMessage.message}</Text>
          {OFFICE_TOOL_GROUPS.includes(errorMessage.groupId) && (
            <Text color="cyan">가이드: {OFFICE_TOOLS_GUIDE_URL}</Text>
          )}
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
