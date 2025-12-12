/**
 * Settings Browser Component
 *
 * Displays settings menu for interactive selection
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { PlanningMode } from '../../../core/slash-command-handler.js';
import { configManager } from '../../../core/config/config-manager.js';
import { sessionManager } from '../../../core/session/session-manager.js';
import { LLMClient } from '../../../core/llm/llm-client.js';
import { EndpointConfig } from '../../../types/index.js';

interface SettingsBrowserProps {
  currentPlanningMode: PlanningMode;
  onPlanningModeChange: (mode: PlanningMode) => void;
  onClose: () => void;
}

interface SelectItem {
  label: string;
  value: string;
}

interface SystemStatus {
  version: string;
  sessionId: string;
  workingDir: string;
  endpointUrl: string;
  llmModel: string;
}

interface EndpointHealthStatus {
  endpointId: string;
  modelId: string;
  healthy: boolean;
  latency?: number;
  error?: string;
}

interface LLMFormData {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  modelName: string;
  maxContextLength: string;
}

type SettingsView =
  | 'main'
  | 'status'
  | 'planning-mode'
  | 'llms'
  | 'llm-add'
  | 'llm-detail'
  | 'llm-edit'
  | 'llm-delete-confirm';

type FormField = 'name' | 'baseUrl' | 'apiKey' | 'modelId' | 'modelName' | 'maxContextLength' | 'buttons';

export const SettingsBrowser: React.FC<SettingsBrowserProps> = ({
  currentPlanningMode: _currentPlanningMode, // Kept for backward compatibility but not used (always auto)
  onPlanningModeChange: _onPlanningModeChange, // Kept for backward compatibility but not used
  onClose,
}) => {
  // Note: currentPlanningMode and onPlanningModeChange are kept for interface compatibility
  // but are not used since planning mode is always 'auto'
  void _currentPlanningMode;
  void _onPlanningModeChange;
  const [view, setView] = useState<SettingsView>('main');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // LLMs state
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>([]);
  const [healthStatus, setHealthStatus] = useState<EndpointHealthStatus[]>([]);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointConfig | null>(null);

  // Form state
  const [formData, setFormData] = useState<LLMFormData>({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelId: '',
    modelName: '',
    maxContextLength: '128000',
  });
  const [formField, setFormField] = useState<FormField>('name');
  const [formButtonIndex, setFormButtonIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Load endpoints
  const loadEndpoints = useCallback(() => {
    setEndpoints(configManager.getAllEndpoints());
  }, []);

  // Run health check
  const runHealthCheck = useCallback(async () => {
    setIsHealthChecking(true);
    try {
      const results = await LLMClient.healthCheckAll();
      const statusList: EndpointHealthStatus[] = [];

      for (const [endpointId, modelResults] of results) {
        for (const result of modelResults) {
          statusList.push({
            endpointId,
            modelId: result.modelId,
            healthy: result.healthy,
            latency: result.latency,
            error: result.error,
          });
        }
      }

      setHealthStatus(statusList);

      // Update config with health status
      await configManager.updateAllHealthStatus(results);
    } catch {
      // Ignore health check errors
    } finally {
      setIsHealthChecking(false);
    }
  }, []);

  // Load system status when status view is shown
  useEffect(() => {
    if (view === 'status') {
      const loadStatus = async () => {
        const endpoint = configManager.getCurrentEndpoint();
        const model = configManager.getCurrentModel();
        const cwd = process.cwd();

        // Read package.json for version
        let version = '0.1.0';
        try {
          const { readFile } = await import('fs/promises');
          const { fileURLToPath } = await import('url');
          const { dirname, join } = await import('path');
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);
          const packageJsonPath = join(__dirname, '../../../package.json');
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
          version = packageJson.version;
        } catch {
          // Use default version
        }

        setSystemStatus({
          version,
          sessionId: sessionManager.getCurrentSessionId() || 'No active session',
          workingDir: cwd,
          endpointUrl: endpoint?.baseUrl || 'Not configured',
          llmModel: model ? `${model.name} (${model.id})` : 'Not configured',
        });
      };

      loadStatus();
    }
  }, [view]);

  // Load endpoints and run health check when LLMs view is shown
  useEffect(() => {
    if (view === 'llms') {
      loadEndpoints();
      runHealthCheck();
    }
  }, [view, loadEndpoints, runHealthCheck]);

  // Get health status for endpoint
  const getEndpointHealth = useCallback(
    (endpointId: string): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' => {
      const statuses = healthStatus.filter((s) => s.endpointId === endpointId);
      if (statuses.length === 0) return 'unknown';

      const healthyCount = statuses.filter((s) => s.healthy).length;
      if (healthyCount === statuses.length) return 'healthy';
      if (healthyCount > 0) return 'degraded';
      return 'unhealthy';
    },
    [healthStatus]
  );

  // Get health icon
  const getHealthIcon = (status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'): string => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'degraded':
        return '⚠';
      case 'unhealthy':
        return '✗';
      default:
        return '?';
    }
  };

  // Get health color
  const getHealthColor = (
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  ): string => {
    switch (status) {
      case 'healthy':
        return 'green';
      case 'degraded':
        return 'yellow';
      case 'unhealthy':
        return 'red';
      default:
        return 'gray';
    }
  };

  // Handle form field navigation with Tab, Arrow keys, and Enter
  const handleFormNavigation = useCallback(
    (key: { tab?: boolean; shift?: boolean; return?: boolean; upArrow?: boolean; downArrow?: boolean }) => {
      const fields: FormField[] = ['name', 'baseUrl', 'apiKey', 'modelId', 'modelName', 'maxContextLength', 'buttons'];
      const currentIndex = fields.indexOf(formField);

      // Tab or Enter to move to next field (except on buttons where Enter submits)
      if (key.tab || (key.return && formField !== 'buttons')) {
        if (key.shift) {
          // Previous field
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : fields.length - 1;
          setFormField(fields[prevIndex]!);
        } else {
          // Next field
          const nextIndex = currentIndex < fields.length - 1 ? currentIndex + 1 : 0;
          setFormField(fields[nextIndex]!);
        }
        return true; // Handled
      }

      // Arrow keys for navigation
      if (key.upArrow) {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : fields.length - 1;
        if (formField === 'buttons') {
          // In buttons, up/down toggles between buttons
          setFormButtonIndex((prev) => (prev === 0 ? 1 : 0));
        } else {
          setFormField(fields[prevIndex]!);
        }
        return true;
      }

      if (key.downArrow) {
        const nextIndex = currentIndex < fields.length - 1 ? currentIndex + 1 : 0;
        if (formField === 'buttons') {
          // In buttons, up/down toggles between buttons
          setFormButtonIndex((prev) => (prev === 0 ? 1 : 0));
        } else {
          setFormField(fields[nextIndex]!);
        }
        return true;
      }

      return false;
    },
    [formField]
  );

  // Handle form submit
  const handleFormSubmit = useCallback(async () => {
    if (formButtonIndex === 1) {
      // Cancel
      setView('llms');
      return;
    }

    // Validate
    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formData.baseUrl.trim()) {
      setFormError('Base URL is required');
      return;
    }
    if (!formData.modelId.trim()) {
      setFormError('Model ID is required');
      return;
    }

    // Check for duplicate: same provider name AND same model ID
    const isDuplicate = endpoints.some((ep) => {
      // Skip the current endpoint when editing
      if (view === 'llm-edit' && selectedEndpoint && ep.id === selectedEndpoint.id) {
        return false;
      }
      // Check if provider name AND model ID both match
      return ep.name === formData.name.trim() && ep.models.some((m) => m.id === formData.modelId.trim());
    });

    if (isDuplicate) {
      setFormError(`Duplicate: Provider "${formData.name}" with Model ID "${formData.modelId}" already exists`);
      return;
    }

    // Test connection
    setIsTesting(true);
    setFormError(null);

    try {
      const result = await LLMClient.testConnection(
        formData.baseUrl,
        formData.apiKey,
        formData.modelId
      );

      if (!result.success) {
        setFormError(result.error || 'Connection failed');
        setIsTesting(false);
        return;
      }

      // Save endpoint
      const modelDisplayName = formData.modelName.trim() || formData.modelId;
      const maxTokens = parseInt(formData.maxContextLength, 10) || 128000;
      const newEndpoint: EndpointConfig = {
        id: `ep-${Date.now()}`,
        name: formData.name,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey || undefined,
        models: [
          {
            id: formData.modelId,
            name: modelDisplayName,
            maxTokens: maxTokens,
            enabled: true,
            healthStatus: 'healthy',
            lastHealthCheck: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (view === 'llm-edit' && selectedEndpoint) {
        // Update existing
        await configManager.updateEndpoint(selectedEndpoint.id, {
          name: formData.name,
          baseUrl: formData.baseUrl,
          apiKey: formData.apiKey || undefined,
          models: [
            {
              id: formData.modelId,
              name: modelDisplayName,
              maxTokens: maxTokens,
              enabled: true,
              healthStatus: 'healthy',
              lastHealthCheck: new Date(),
            },
          ],
        });
      } else {
        // Add new
        await configManager.addEndpoint(newEndpoint);

        // If this is the first endpoint, set it as current
        if (endpoints.length === 0) {
          await configManager.setCurrentEndpoint(newEndpoint.id);
        }
      }

      setIsTesting(false);
      setView('llms');
      loadEndpoints();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unknown error');
      setIsTesting(false);
    }
  }, [formData, formButtonIndex, view, selectedEndpoint, endpoints.length, loadEndpoints]);

  // Custom keyboard handling
  useInput((_inputChar, key) => {
    if (key.escape) {
      if (view === 'llm-add' || view === 'llm-edit') {
        setView('llms');
        setFormError(null);
      } else if (view === 'llm-detail' || view === 'llm-delete-confirm') {
        setView('llms');
      } else if (view === 'llms' || view === 'planning-mode' || view === 'status') {
        setView('main');
      } else {
        onClose();
      }
      return;
    }

    // Form navigation for add/edit views
    if (view === 'llm-add' || view === 'llm-edit') {
      // Handle Tab, Arrow keys, and Enter for navigation
      if (key.tab || key.upArrow || key.downArrow) {
        handleFormNavigation({
          tab: key.tab,
          shift: key.shift,
          upArrow: key.upArrow,
          downArrow: key.downArrow
        });
        return;
      }

      // Enter key handling
      if (key.return) {
        if (formField === 'buttons') {
          // Submit form when on buttons
          handleFormSubmit();
        } else {
          // Move to next field when on text inputs
          handleFormNavigation({ return: true });
        }
        return;
      }
    }
  });

  // Main menu items (Planning Mode and LLMs removed - models are managed by Admin Server)
  const mainMenuItems: SelectItem[] = [
    {
      label: '0. Status',
      value: 'status',
    },
  ];

  // Planning mode options - kept for backward compatibility but not used
  // Planning mode is always 'auto'
  const planningModeItems: SelectItem[] = [
    {
      label: 'auto ✓',
      value: 'auto',
    },
  ];

  // LLMs menu items
  const llmsMenuItems: SelectItem[] = [
    { label: '+ Add new endpoint...', value: 'add' },
    ...endpoints.map((ep) => {
      const health = getEndpointHealth(ep.id);
      const icon = getHealthIcon(health);
      const currentEndpoint = configManager.getCurrentEndpoint();
      const isCurrent = currentEndpoint?.id === ep.id;
      const modelName = ep.models[0]?.id || ep.models[0]?.name || 'unknown';
      return {
        label: `  ${modelName} (${ep.name})${isCurrent ? ' *' : ''} ${icon}`,
        value: ep.id,
      };
    }),
  ];

  // Detail menu items
  const detailMenuItems: SelectItem[] = [
    { label: 'Edit', value: 'edit' },
    { label: 'Delete', value: 'delete' },
    { label: 'Set as Current', value: 'set-current' },
    { label: 'Refresh Health', value: 'refresh' },
  ];

  // Delete confirm items
  const deleteConfirmItems: SelectItem[] = [
    { label: 'Yes, delete', value: 'confirm' },
    { label: 'Cancel', value: 'cancel' },
  ];

  // Handle main menu selection
  const handleMainSelect = (item: SelectItem) => {
    if (item.value === 'status') {
      setView('status');
    }
  };

  // Handle planning mode selection (kept for backward compatibility but not used)
  // Planning mode is always 'auto'
  const handlePlanningModeSelect = (_item: SelectItem) => {
    // No-op: planning mode is always 'auto'
    onClose();
  };

  // Handle LLMs menu selection
  const handleLLMsSelect = (item: SelectItem) => {
    if (item.value === 'add') {
      setFormData({ name: '', baseUrl: '', apiKey: '', modelId: '', modelName: '', maxContextLength: '128000' });
      setFormField('name');
      setFormButtonIndex(0);
      setFormError(null);
      setView('llm-add');
    } else {
      const endpoint = endpoints.find((ep) => ep.id === item.value);
      if (endpoint) {
        setSelectedEndpoint(endpoint);
        setView('llm-detail');
      }
    }
  };

  // Handle detail menu selection
  const handleDetailSelect = async (item: SelectItem) => {
    if (!selectedEndpoint) return;

    switch (item.value) {
      case 'edit':
        setFormData({
          name: selectedEndpoint.name,
          baseUrl: selectedEndpoint.baseUrl,
          apiKey: selectedEndpoint.apiKey || '',
          modelId: selectedEndpoint.models[0]?.id || '',
          modelName: selectedEndpoint.models[0]?.name || '',
          maxContextLength: String(selectedEndpoint.models[0]?.maxTokens || 128000),
        });
        setFormField('name');
        setFormButtonIndex(0);
        setFormError(null);
        setView('llm-edit');
        break;
      case 'delete':
        setView('llm-delete-confirm');
        break;
      case 'set-current':
        await configManager.setCurrentEndpoint(selectedEndpoint.id);
        setView('llms');
        loadEndpoints();
        break;
      case 'refresh':
        await runHealthCheck();
        break;
    }
  };

  // Handle delete confirm
  const handleDeleteConfirm = async (item: SelectItem) => {
    if (item.value === 'confirm' && selectedEndpoint) {
      await configManager.removeEndpoint(selectedEndpoint.id);
      setSelectedEndpoint(null);
      setView('llms');
      loadEndpoints();
    } else {
      setView('llm-detail');
    }
  };

  // Main settings menu view
  if (view === 'main') {
    return (
      <Box flexDirection="column">
        {/* Header */}
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text color="cyan" bold>
            Settings
          </Text>
        </Box>

        {/* Menu List */}
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <SelectInput items={mainMenuItems} onSelect={handleMainSelect} />
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Text dimColor>↑↓: move | Enter: select | ESC: close</Text>
        </Box>
      </Box>
    );
  }

  // Status view
  if (view === 'status') {
    return (
      <Box flexDirection="column">
        {/* Header */}
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text color="cyan" bold>
            Settings &gt; Status
          </Text>
        </Box>

        {/* Status Information */}
        <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
          {systemStatus ? (
            <>
              <Box>
                <Text color="yellow">Version: </Text>
                <Text>{systemStatus.version}</Text>
              </Box>
              <Box>
                <Text color="yellow">Session ID: </Text>
                <Text>{systemStatus.sessionId}</Text>
              </Box>
              <Box>
                <Text color="yellow">Working Dir: </Text>
                <Text>{systemStatus.workingDir}</Text>
              </Box>
              <Box>
                <Text color="yellow">Endpoint URL: </Text>
                <Text>{systemStatus.endpointUrl}</Text>
              </Box>
              <Box>
                <Text color="yellow">LLM Model: </Text>
                <Text>{systemStatus.llmModel}</Text>
              </Box>
            </>
          ) : (
            <Text color="gray">Loading status...</Text>
          )}
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Text dimColor>ESC: back</Text>
        </Box>
      </Box>
    );
  }

  // Planning mode selection view
  if (view === 'planning-mode') {
    return (
      <Box flexDirection="column">
        {/* Header */}
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text color="cyan" bold>
            Settings &gt; Planning Mode
          </Text>
        </Box>

        {/* Description */}
        <Box paddingX={1} marginBottom={1}>
          <Text color="gray">Select the planning mode for task execution:</Text>
        </Box>

        {/* Mode descriptions */}
        <Box paddingX={1} marginBottom={1} flexDirection="column">
          <Text color="yellow">• planning: </Text>
          <Text color="gray"> Always create TODO list before execution</Text>
          <Text color="yellow">• no-planning: </Text>
          <Text color="gray"> Execute directly without planning</Text>
          <Text color="yellow">• auto: </Text>
          <Text color="gray"> Automatically decide based on task complexity</Text>
        </Box>

        {/* Options List */}
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <SelectInput items={planningModeItems} onSelect={handlePlanningModeSelect} />
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Text dimColor>↑↓: move | Enter: select | ESC: back</Text>
        </Box>
      </Box>
    );
  }

  // LLMs list view
  if (view === 'llms') {
    return (
      <Box flexDirection="column">
        {/* Header */}
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text color="cyan" bold>
            Settings &gt; LLM Endpoints
          </Text>
          {isHealthChecking && (
            <Text color="yellow"> (checking health...)</Text>
          )}
        </Box>

        {/* Endpoints List */}
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          {endpoints.length === 0 && !llmsMenuItems.find((i) => i.value === 'add') ? (
            <Text color="gray">No endpoints configured</Text>
          ) : (
            <SelectInput items={llmsMenuItems} onSelect={handleLLMsSelect} />
          )}
        </Box>

        {/* Health Legend */}
        <Box marginTop={1} paddingX={1}>
          <Text color="green">✓ healthy </Text>
          <Text color="yellow">⚠ degraded </Text>
          <Text color="red">✗ unhealthy</Text>
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Text dimColor>↑↓: move | Enter: select | ESC: back</Text>
        </Box>
      </Box>
    );
  }

  // LLM Detail view
  if (view === 'llm-detail' && selectedEndpoint) {
    const health = getEndpointHealth(selectedEndpoint.id);
    const healthColor = getHealthColor(health);
    const healthIcon = getHealthIcon(health);
    const modelStatus = healthStatus.find(
      (s) => s.endpointId === selectedEndpoint.id
    );

    return (
      <Box flexDirection="column">
        {/* Header */}
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text color="cyan" bold>
            {selectedEndpoint.name}
          </Text>
          <Text> </Text>
          <Text color={healthColor}>{healthIcon} {health}</Text>
        </Box>

        {/* Endpoint Info */}
        <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color="yellow">URL: </Text>
            <Text>{selectedEndpoint.baseUrl}</Text>
          </Box>
          <Box>
            <Text color="yellow">Model: </Text>
            <Text>{selectedEndpoint.models[0]?.id || 'N/A'}</Text>
          </Box>
          <Box>
            <Text color="yellow">API Key: </Text>
            <Text>{selectedEndpoint.apiKey ? '••••••••' : '(not set)'}</Text>
          </Box>
          {modelStatus?.latency && (
            <Box>
              <Text color="yellow">Latency: </Text>
              <Text>{modelStatus.latency}ms</Text>
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <SelectInput items={detailMenuItems} onSelect={handleDetailSelect} />
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Text dimColor>↑↓: move | Enter: select | ESC: back</Text>
        </Box>
      </Box>
    );
  }

  // Delete confirm view
  if (view === 'llm-delete-confirm' && selectedEndpoint) {
    return (
      <Box flexDirection="column">
        {/* Header */}
        <Box borderStyle="single" borderColor="red" paddingX={1} marginBottom={1}>
          <Text color="red" bold>
            Delete Endpoint
          </Text>
        </Box>

        {/* Confirmation */}
        <Box paddingX={1} marginBottom={1}>
          <Text>
            Are you sure you want to delete <Text color="yellow">{selectedEndpoint.name}</Text>?
          </Text>
        </Box>

        {/* Options */}
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <SelectInput items={deleteConfirmItems} onSelect={handleDeleteConfirm} />
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Text dimColor>↑↓: move | Enter: select | ESC: cancel</Text>
        </Box>
      </Box>
    );
  }

  // LLM Add/Edit form view
  if (view === 'llm-add' || view === 'llm-edit') {
    const isEdit = view === 'llm-edit';

    return (
      <Box flexDirection="column">
        {/* Header */}
        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text color="cyan" bold>
            {isEdit ? 'Edit Endpoint' : 'Add New Endpoint'}
          </Text>
        </Box>

        {/* Form */}
        <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
          {/* Name Field */}
          <Box>
            <Text color={formField === 'name' ? 'cyan' : 'yellow'}>
              {formField === 'name' ? '> ' : '  '}Name:
            </Text>
            {formField === 'name' ? (
              <TextInput
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder="My LLM Endpoint"
              />
            ) : (
              <Text>{formData.name || '(empty)'}</Text>
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
              <Text>{formData.baseUrl || '(empty)'}</Text>
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
              <Text>{formData.apiKey ? '••••••••' : '(optional)'}</Text>
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
              <Text>{formData.modelId || '(empty)'}</Text>
            )}
          </Box>

          {/* Model Name Field (Display Name) */}
          <Box>
            <Text color={formField === 'modelName' ? 'cyan' : 'yellow'}>
              {formField === 'modelName' ? '> ' : '  '}Model Name:
            </Text>
            {formField === 'modelName' ? (
              <TextInput
                value={formData.modelName}
                onChange={(value) => setFormData({ ...formData, modelName: value })}
                placeholder="(optional, defaults to Model ID)"
              />
            ) : (
              <Text>{formData.modelName || '(uses Model ID)'}</Text>
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
              <Text>{formData.maxContextLength || '128000'}</Text>
            )}
          </Box>
        </Box>

        {/* Error Message */}
        {formError && (
          <Box marginTop={1} paddingX={1}>
            <Text color="red">Error: {formError}</Text>
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
              Cancel
            </Text>
          </Box>
        </Box>

        {/* Footer */}
        <Box marginTop={1}>
          <Text dimColor>↑↓/Tab: move | Enter: next/submit | ESC: cancel</Text>
        </Box>
      </Box>
    );
  }

  // Fallback
  return null;
};
