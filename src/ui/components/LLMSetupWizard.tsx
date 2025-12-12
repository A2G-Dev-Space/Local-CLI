/**
 * LLM Setup Wizard Component
 *
 * Displays first-time setup wizard when no LLM endpoints are configured
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { configManager } from '../../core/config/config-manager.js';
import { LLMClient } from '../../core/llm/llm-client.js';
import { EndpointConfig } from '../../types/index.js';

interface LLMSetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface FormData {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  modelName: string;
  maxContextLength: string;
}

type FormField = 'name' | 'baseUrl' | 'apiKey' | 'modelId' | 'modelName' | 'maxContextLength' | 'buttons';

export const LLMSetupWizard: React.FC<LLMSetupWizardProps> = ({ onComplete, onSkip }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelId: '',
    modelName: '',
    maxContextLength: '128000',
  });
  const [formField, setFormField] = useState<FormField>('name');
  const [formButtonIndex, setFormButtonIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Handle form field navigation with Tab and Arrow keys
  const handleFormNavigation = useCallback(
    (key: { tab?: boolean; shift?: boolean; upArrow?: boolean; downArrow?: boolean }) => {
      const fields: FormField[] = ['name', 'baseUrl', 'apiKey', 'modelId', 'modelName', 'maxContextLength', 'buttons'];
      const currentIndex = fields.indexOf(formField);

      if (key.tab) {
        if (key.shift) {
          // Previous field
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : fields.length - 1;
          setFormField(fields[prevIndex]!);
        } else {
          // Next field
          const nextIndex = currentIndex < fields.length - 1 ? currentIndex + 1 : 0;
          setFormField(fields[nextIndex]!);
        }
      }

      // Arrow keys for navigation
      if (key.upArrow) {
        if (formField === 'buttons') {
          // In buttons, up/down toggles between buttons
          setFormButtonIndex((prev) => (prev === 0 ? 1 : 0));
        } else {
          // Move to previous field
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : fields.length - 1;
          setFormField(fields[prevIndex]!);
        }
      }

      if (key.downArrow) {
        if (formField === 'buttons') {
          // In buttons, up/down toggles between buttons
          setFormButtonIndex((prev) => (prev === 0 ? 1 : 0));
        } else {
          // Move to next field
          const nextIndex = currentIndex < fields.length - 1 ? currentIndex + 1 : 0;
          setFormField(fields[nextIndex]!);
        }
      }
    },
    [formField]
  );

  // Handle form submit
  const handleFormSubmit = useCallback(async () => {
    if (formButtonIndex === 1) {
      // Skip
      onSkip();
      return;
    }

    // Validate
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.baseUrl.trim()) {
      setError('Base URL is required');
      return;
    }
    if (!formData.modelId.trim()) {
      setError('Model ID is required');
      return;
    }

    // Test connection
    setIsTesting(true);
    setError(null);

    try {
      const result = await LLMClient.testConnection(
        formData.baseUrl,
        formData.apiKey,
        formData.modelId
      );

      if (!result.success) {
        setError(result.error || 'Connection failed');
        setIsTesting(false);
        return;
      }

      // Save endpoint
      const maxTokens = parseInt(formData.maxContextLength, 10) || 128000;
      const newEndpoint: EndpointConfig = {
        id: `ep-${Date.now()}`,
        name: formData.name,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey || undefined,
        models: [
          {
            id: formData.modelId,
            name: formData.modelName || formData.modelId,
            maxTokens: maxTokens,
            enabled: true,
            healthStatus: 'healthy',
            lastHealthCheck: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await configManager.createInitialEndpoint(newEndpoint);
      setIsTesting(false);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsTesting(false);
    }
  }, [formData, formButtonIndex, onComplete, onSkip]);

  // Keyboard handling
  useInput((_inputChar, key) => {
    if (key.tab) {
      handleFormNavigation({ tab: true, shift: key.shift });
    } else if (key.upArrow || key.downArrow) {
      handleFormNavigation({ upArrow: key.upArrow, downArrow: key.downArrow });
    } else if (key.return && formField === 'buttons') {
      handleFormSubmit();
    }
  });

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text color="cyan" bold>
          Welcome to LOCAL-CLI!
        </Text>
      </Box>

      {/* Description */}
      <Box paddingX={1} marginBottom={1} flexDirection="column">
        <Text color="yellow">No LLM endpoint configured.</Text>
        <Text color="gray">Let's set up your first LLM endpoint.</Text>
      </Box>

      {/* Form */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
        {/* Name Field */}
        <Box>
          <Text color={formField === 'name' ? 'cyan' : 'yellow'}>
            {formField === 'name' ? '> ' : '  '}Endpoint Name:
          </Text>
          {formField === 'name' ? (
            <TextInput
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="My Local LLM"
            />
          ) : (
            <Text> {formData.name || '(empty)'}</Text>
          )}
        </Box>

        {/* Base URL Field */}
        <Box>
          <Text color={formField === 'baseUrl' ? 'cyan' : 'yellow'}>
            {formField === 'baseUrl' ? '> ' : '  '}Base URL:
          </Text>
          {formField === 'baseUrl' ? (
            <TextInput
              value={formData.baseUrl}
              onChange={(value) => setFormData({ ...formData, baseUrl: value })}
              placeholder="http://localhost:11434/v1"
            />
          ) : (
            <Text> {formData.baseUrl || '(empty)'}</Text>
          )}
        </Box>

        {/* API Key Field */}
        <Box>
          <Text color={formField === 'apiKey' ? 'cyan' : 'yellow'}>
            {formField === 'apiKey' ? '> ' : '  '}API Key:
          </Text>
          {formField === 'apiKey' ? (
            <TextInput
              value={formData.apiKey}
              onChange={(value) => setFormData({ ...formData, apiKey: value })}
              placeholder="(optional)"
            />
          ) : (
            <Text> {formData.apiKey ? '••••••••' : '(optional)'}</Text>
          )}
        </Box>

        {/* Model ID Field */}
        <Box>
          <Text color={formField === 'modelId' ? 'cyan' : 'yellow'}>
            {formField === 'modelId' ? '> ' : '  '}Model ID:
          </Text>
          {formField === 'modelId' ? (
            <TextInput
              value={formData.modelId}
              onChange={(value) => setFormData({ ...formData, modelId: value })}
              placeholder="qwen2.5-coder:32b"
            />
          ) : (
            <Text> {formData.modelId || '(empty)'}</Text>
          )}
        </Box>

        {/* Model Name Field */}
        <Box>
          <Text color={formField === 'modelName' ? 'cyan' : 'yellow'}>
            {formField === 'modelName' ? '> ' : '  '}Model Name:
          </Text>
          {formField === 'modelName' ? (
            <TextInput
              value={formData.modelName}
              onChange={(value) => setFormData({ ...formData, modelName: value })}
              placeholder="Qwen 2.5 Coder 32B (optional)"
            />
          ) : (
            <Text> {formData.modelName || '(optional)'}</Text>
          )}
        </Box>

        {/* Max Context Length Field */}
        <Box>
          <Text color={formField === 'maxContextLength' ? 'cyan' : 'yellow'}>
            {formField === 'maxContextLength' ? '> ' : '  '}Max Context:
          </Text>
          {formField === 'maxContextLength' ? (
            <TextInput
              value={formData.maxContextLength}
              onChange={(value) => setFormData({ ...formData, maxContextLength: value.replace(/[^0-9]/g, '') })}
              placeholder="128000"
            />
          ) : (
            <Text> {formData.maxContextLength || '128000'}</Text>
          )}
        </Box>
      </Box>

      {/* Error Message */}
      {error && (
        <Box marginTop={1} paddingX={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Buttons */}
      <Box marginTop={1} flexDirection="column" paddingX={1}>
        <Box>
          <Text
            color={formField === 'buttons' && formButtonIndex === 0 ? 'cyan' : undefined}
            bold={formField === 'buttons' && formButtonIndex === 0}
          >
            {formField === 'buttons' && formButtonIndex === 0 ? '> ' : '  '}
            {isTesting ? 'Testing...' : 'Test & Save'}
          </Text>
        </Box>
        <Box>
          <Text
            color={formField === 'buttons' && formButtonIndex === 1 ? 'cyan' : undefined}
            bold={formField === 'buttons' && formButtonIndex === 1}
          >
            {formField === 'buttons' && formButtonIndex === 1 ? '> ' : '  '}
            Skip (configure later via /settings)
          </Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>↑↓/Tab: navigate fields | Shift+Tab: prev | Enter: select button</Text>
      </Box>
    </Box>
  );
};
