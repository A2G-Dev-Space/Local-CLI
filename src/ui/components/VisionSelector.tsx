/**
 * Vision Model Selector Component
 *
 * Allows selecting which vision model to use for read_image via /vision command
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { configManager } from '../../core/config/config-manager.js';
import { getAllVisionModels } from '../../tools/llm/simple/read-image-tool.js';

interface VisionSelectorProps {
  onSelect: (endpointId: string, modelId: string) => void;
  onCancel: () => void;
}

interface SelectItem {
  label: string;
  value: string;
}

export const VisionSelector: React.FC<VisionSelectorProps> = ({ onSelect, onCancel }) => {
  const [items, setItems] = useState<SelectItem[]>([]);

  useEffect(() => {
    const visionModels = getAllVisionModels();
    const config = configManager.getConfig();
    const currentVisionId = config.visionModelId;

    const selectItems: SelectItem[] = visionModels.map(vm => {
      const isCurrent = vm.modelId === currentVisionId;
      return {
        label: `${isCurrent ? '● ' : '  '}${vm.modelName} (${vm.endpointName})`,
        value: `${vm.endpointId}::${vm.modelId}`,
      };
    });

    if (selectItems.length === 0) {
      selectItems.push({ label: '  No vision models available', value: '' });
    }

    setItems(selectItems);
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const handleSelect = (item: SelectItem) => {
    if (!item.value) {
      onCancel();
      return;
    }
    const parts = item.value.split('::');
    onSelect(parts[0] || '', parts[1] || '');
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Select Vision Model</Text>
        <Text color="gray"> (for image analysis)</Text>
      </Box>
      {items.length > 0 && (
        <SelectInput items={items} onSelect={handleSelect} />
      )}
      <Box marginTop={1}>
        <Text color="gray">ESC to cancel</Text>
      </Box>
    </Box>
  );
};
