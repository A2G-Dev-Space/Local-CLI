/**
 * File Browser Component
 *
 * Displays a file list for @ file inclusion
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { useFileList, FileItem } from '../hooks/useFileList.js';

interface FileBrowserProps {
  filter: string;
  onSelect: (filePaths: string[]) => void;
  onCancel: () => void;
  cachedFiles?: FileItem[]; // Pre-loaded file list for instant display
}

interface SelectItem {
  label: string;
  value: string;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  filter,
  onSelect,
  onCancel,
  cachedFiles = [],
}) => {
  const { files } = useFileList({
    filter,
    maxResults: 100, // Get more files for scrolling, but display limit is 10
    cachedFiles, // Pass cached files for instant filtering
  });

  // Convert FileItem to SelectItem format
  const items: SelectItem[] = files.map((file) => {
    // TODO: When directory navigation is enabled, uncomment the line below
    // const icon = file.type === 'directory' ? '📁' : '📄';
    const icon = '📄'; // Currently only files are shown (directories are filtered out)
    return {
      label: `${icon} ${file.path}`,
      value: file.path,
    };
  });

  // Custom keyboard handling
  useInput((_inputChar, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    // Tab key for autocomplete (select first file)
    if (key.tab && items.length > 0) {
      const firstFile = items[0];
      if (firstFile) {
        onSelect([firstFile.value]);
      }
      return;
    }
  });

  // Handle Enter key from SelectInput
  const handleSelect = (item: SelectItem) => {
    onSelect([item.value]);
  };

  // No loading state needed - files are pre-loaded externally
  // Error state is also not relevant as loading happens at app startup

  if (items.length === 0) {
    return (
      <Box borderStyle="single" borderColor="yellow" paddingX={1} flexDirection="column">
        <Text color="yellow">No files found matching: {filter || '(all files)'}</Text>
        <Text dimColor>Press ESC to cancel</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* File List */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <SelectInput
          items={items}
          onSelect={handleSelect}
          limit={10}
        />
      </Box>
    </Box>
  );
};
