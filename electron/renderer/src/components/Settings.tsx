/**
 * Settings Component
 * LLM Endpoint management and system configuration
 * Matches CLI's settings functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import './Settings.css';

// Types matching CLI
export interface ModelInfo {
  id: string;
  name: string;
  maxTokens: number;
  enabled: boolean;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck?: Date;
}

export interface EndpointConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelInfo[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsView = 'main' | 'status' | 'llms' | 'llm-add' | 'llm-edit' | 'llm-delete';

interface FormData {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  modelName: string;
  maxContextLength: string;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<SettingsView>('main');
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>([]);
  const [currentEndpointId, setCurrentEndpointId] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelId: '',
    modelName: '',
    maxContextLength: '128000',
  });

  // System status
  const [systemStatus, setSystemStatus] = useState<{
    version: string;
    sessionId: string;
    workingDir: string;
    endpointUrl: string;
    llmModel: string;
    configPath: string;
  } | null>(null);

  // Load endpoints
  const loadEndpoints = useCallback(async () => {
    if (!window.electronAPI?.llm) {
      setError('LLM API not available');
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electronAPI.llm.getEndpoints();
      if (result.success && result.endpoints) {
        setEndpoints(result.endpoints);
        setCurrentEndpointId(result.currentEndpointId || null);
      }
    } catch (err) {
      console.error('Failed to load endpoints:', err);
      setError('Failed to load endpoints');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load status
  const loadStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.llm.getStatus();
      if (result.success && result.status) {
        setSystemStatus(result.status);
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadEndpoints();
      setView('main');
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, loadEndpoints]);

  // Load status when viewing status
  useEffect(() => {
    if (view === 'status') {
      loadStatus();
    }
  }, [view, loadStatus]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'main') {
          onClose();
        } else {
          setView('main');
          setError(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, onClose]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      baseUrl: '',
      apiKey: '',
      modelId: '',
      modelName: '',
      maxContextLength: '128000',
    });
    setError(null);
  }, []);

  // Open add form
  const handleAddEndpoint = useCallback(() => {
    resetForm();
    setSelectedEndpoint(null);
    setView('llm-add');
  }, [resetForm]);

  // Open edit form
  const handleEditEndpoint = useCallback((endpoint: EndpointConfig) => {
    setSelectedEndpoint(endpoint);
    setFormData({
      name: endpoint.name,
      baseUrl: endpoint.baseUrl,
      apiKey: endpoint.apiKey || '',
      modelId: endpoint.models[0]?.id || '',
      modelName: endpoint.models[0]?.name || '',
      maxContextLength: String(endpoint.models[0]?.maxTokens || 128000),
    });
    setError(null);
    setView('llm-edit');
  }, []);

  // Open delete confirmation
  const handleDeletePrompt = useCallback((endpoint: EndpointConfig) => {
    setSelectedEndpoint(endpoint);
    setView('llm-delete');
  }, []);

  // Test and save endpoint
  const handleSaveEndpoint = useCallback(async () => {
    // Validation
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

    setIsTesting(true);
    setError(null);

    try {
      // Test connection
      const testResult = await window.electronAPI.llm.testConnection(
        formData.baseUrl,
        formData.apiKey,
        formData.modelId
      );

      if (!testResult.success) {
        setError(testResult.error || 'Connection test failed');
        setIsTesting(false);
        return;
      }

      // Save endpoint
      const endpointData: Omit<EndpointConfig, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name.trim(),
        baseUrl: formData.baseUrl.trim(),
        apiKey: formData.apiKey.trim() || undefined,
        models: [{
          id: formData.modelId.trim(),
          name: formData.modelName.trim() || formData.modelId.trim(),
          maxTokens: parseInt(formData.maxContextLength) || 128000,
          enabled: true,
          healthStatus: 'healthy',
        }],
      };

      let result;
      if (view === 'llm-edit' && selectedEndpoint) {
        result = await window.electronAPI.llm.updateEndpoint(selectedEndpoint.id, endpointData);
      } else {
        result = await window.electronAPI.llm.addEndpoint(endpointData);
      }

      if (result.success) {
        setSuccessMessage(view === 'llm-edit' ? 'Endpoint updated' : 'Endpoint added');
        setTimeout(() => setSuccessMessage(null), 2000);
        await loadEndpoints();
        setView('llms');
      } else {
        setError(result.error || 'Failed to save endpoint');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsTesting(false);
    }
  }, [formData, view, selectedEndpoint, loadEndpoints]);

  // Delete endpoint
  const handleDeleteEndpoint = useCallback(async () => {
    if (!selectedEndpoint) return;

    try {
      const result = await window.electronAPI.llm.removeEndpoint(selectedEndpoint.id);
      if (result.success) {
        setSuccessMessage('Endpoint deleted');
        setTimeout(() => setSuccessMessage(null), 2000);
        await loadEndpoints();
        setView('llms');
      } else {
        setError(result.error || 'Failed to delete endpoint');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [selectedEndpoint, loadEndpoints]);

  // Set current endpoint
  const handleSetCurrent = useCallback(async (endpointId: string) => {
    try {
      const result = await window.electronAPI.llm.setCurrentEndpoint(endpointId);
      if (result.success) {
        setCurrentEndpointId(endpointId);
        setSuccessMessage('Current endpoint updated');
        setTimeout(() => setSuccessMessage(null), 2000);
      }
    } catch (err) {
      console.error('Failed to set current endpoint:', err);
    }
  }, []);

  // Health check
  const handleHealthCheck = useCallback(async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.llm.healthCheckAll();
      await loadEndpoints();
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadEndpoints]);

  // Get health icon and color
  const getHealthDisplay = (status?: string) => {
    switch (status) {
      case 'healthy':
        return { icon: '\u2713', color: 'var(--color-success)', label: 'Healthy' };
      case 'degraded':
        return { icon: '\u26A0', color: 'var(--color-warning)', label: 'Degraded' };
      case 'unhealthy':
        return { icon: '\u2717', color: 'var(--color-error)', label: 'Unhealthy' };
      default:
        return { icon: '?', color: 'var(--color-text-muted)', label: 'Unknown' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <div className="settings-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            <span>
              {view === 'main' && 'Settings'}
              {view === 'status' && 'Settings > Status'}
              {view === 'llms' && 'Settings > LLM Endpoints'}
              {view === 'llm-add' && 'Add New Endpoint'}
              {view === 'llm-edit' && 'Edit Endpoint'}
              {view === 'llm-delete' && 'Delete Endpoint'}
            </span>
          </div>
          <button className="settings-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="settings-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="settings-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="settings-content">
          {/* Main Menu */}
          {view === 'main' && (
            <div className="settings-menu">
              <button className="menu-item" onClick={() => setView('status')}>
                <div className="menu-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/>
                  </svg>
                </div>
                <div className="menu-content">
                  <span className="menu-label">Status</span>
                  <span className="menu-description">View system information</span>
                </div>
                <svg className="menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
              </button>

              <button className="menu-item" onClick={() => { setView('llms'); loadEndpoints(); }}>
                <div className="menu-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
                  </svg>
                </div>
                <div className="menu-content">
                  <span className="menu-label">LLM Endpoints</span>
                  <span className="menu-description">Manage AI model connections</span>
                </div>
                <span className="menu-badge">{endpoints.length}</span>
                <svg className="menu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
              </button>
            </div>
          )}

          {/* Status View */}
          {view === 'status' && (
            <div className="status-view">
              {systemStatus ? (
                <div className="status-list">
                  <div className="status-item">
                    <span className="status-label">Version</span>
                    <span className="status-value">{systemStatus.version}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Session ID</span>
                    <span className="status-value mono">{systemStatus.sessionId || 'No active session'}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Working Directory</span>
                    <span className="status-value mono">{systemStatus.workingDir}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Endpoint URL</span>
                    <span className="status-value mono">{systemStatus.endpointUrl || 'Not configured'}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">LLM Model</span>
                    <span className="status-value">{systemStatus.llmModel || 'Not configured'}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Config Path</span>
                    <span className="status-value mono">{systemStatus.configPath}</span>
                  </div>
                </div>
              ) : (
                <div className="loading-spinner">Loading...</div>
              )}
              <button className="back-button" onClick={() => setView('main')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                Back
              </button>
            </div>
          )}

          {/* LLMs List View */}
          {view === 'llms' && (
            <div className="llms-view">
              <div className="llms-header">
                <button className="add-endpoint-btn" onClick={handleAddEndpoint}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Add Endpoint
                </button>
                <button
                  className="refresh-btn"
                  onClick={handleHealthCheck}
                  disabled={isLoading}
                  title="Health Check"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={isLoading ? 'spinning' : ''}>
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                </button>
              </div>

              {endpoints.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
                  </svg>
                  <p>No endpoints configured</p>
                  <span>Add an endpoint to connect to an LLM</span>
                </div>
              ) : (
                <div className="endpoints-list">
                  {endpoints.map((endpoint) => {
                    const health = getHealthDisplay(endpoint.models[0]?.healthStatus);
                    const isCurrent = endpoint.id === currentEndpointId;

                    return (
                      <div key={endpoint.id} className={`endpoint-item ${isCurrent ? 'current' : ''}`}>
                        <div className="endpoint-info">
                          <div className="endpoint-header">
                            <span className="endpoint-name">
                              {endpoint.models[0]?.id || endpoint.name}
                              {isCurrent && <span className="current-badge">Current</span>}
                            </span>
                            <span
                              className="health-indicator"
                              style={{ color: health.color }}
                              title={health.label}
                            >
                              {health.icon}
                            </span>
                          </div>
                          <div className="endpoint-details">
                            <span className="endpoint-provider">{endpoint.name}</span>
                            <span className="endpoint-url">{endpoint.baseUrl}</span>
                          </div>
                        </div>
                        <div className="endpoint-actions">
                          {!isCurrent && (
                            <button
                              className="action-btn"
                              onClick={() => handleSetCurrent(endpoint.id)}
                              title="Set as Current"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                            </button>
                          )}
                          <button
                            className="action-btn"
                            onClick={() => handleEditEndpoint(endpoint)}
                            title="Edit"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          <button
                            className="action-btn danger"
                            onClick={() => handleDeletePrompt(endpoint)}
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button className="back-button" onClick={() => setView('main')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                Back
              </button>
            </div>
          )}

          {/* Add/Edit Endpoint Form */}
          {(view === 'llm-add' || view === 'llm-edit') && (
            <div className="endpoint-form">
              <div className="form-group">
                <label>Provider Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Ollama Local, OpenAI, LiteLLM"
                />
              </div>

              <div className="form-group">
                <label>Base URL</label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="e.g., http://localhost:11434/v1"
                />
              </div>

              <div className="form-group">
                <label>API Key <span className="optional">(optional)</span></label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </div>

              <div className="form-group">
                <label>Model ID</label>
                <input
                  type="text"
                  value={formData.modelId}
                  onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                  placeholder="e.g., qwen2.5-coder:32b, gpt-4"
                />
              </div>

              <div className="form-group">
                <label>Model Display Name <span className="optional">(optional)</span></label>
                <input
                  type="text"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                  placeholder="Defaults to Model ID"
                />
              </div>

              <div className="form-group">
                <label>Max Context Length</label>
                <input
                  type="number"
                  value={formData.maxContextLength}
                  onChange={(e) => setFormData({ ...formData, maxContextLength: e.target.value })}
                  placeholder="128000"
                />
              </div>

              <div className="form-actions">
                <button className="cancel-btn" onClick={() => setView('llms')}>
                  Cancel
                </button>
                <button
                  className="save-btn"
                  onClick={handleSaveEndpoint}
                  disabled={isTesting}
                >
                  {isTesting ? 'Testing...' : 'Test & Save'}
                </button>
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {view === 'llm-delete' && selectedEndpoint && (
            <div className="delete-confirm">
              <div className="delete-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              </div>
              <h3>Delete Endpoint?</h3>
              <p>
                Are you sure you want to delete <strong>{selectedEndpoint.name}</strong>?
                This action cannot be undone.
              </p>
              <div className="delete-actions">
                <button className="cancel-btn" onClick={() => setView('llms')}>
                  Cancel
                </button>
                <button className="delete-btn" onClick={handleDeleteEndpoint}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <span className="keyboard-hint">ESC to {view === 'main' ? 'close' : 'go back'}</span>
        </div>
      </div>
    </div>
  );
};

export default Settings;
