import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Server, Check, X } from 'lucide-react';
import { modelsApi } from '../services/api';

interface Model {
  id: string;
  name: string;
  displayName: string;
  endpointUrl: string;
  apiKey: string | null;
  maxTokens: number;
  enabled: boolean;
  createdAt: string;
  creator?: { loginid: string };
}

export default function Models() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const response = await modelsApi.list();
      setModels(response.data.models);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingModel(null);
    setShowModal(true);
  };

  const handleEdit = (model: Model) => {
    setEditingModel(model);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;

    try {
      await modelsApi.delete(id);
      setModels(models.filter((m) => m.id !== id));
    } catch (error) {
      console.error('Failed to delete model:', error);
      alert('Failed to delete model. Only super admins can delete models.');
    }
  };

  const handleToggleEnabled = async (model: Model) => {
    try {
      await modelsApi.update(model.id, { enabled: !model.enabled });
      setModels(models.map((m) => (m.id === model.id ? { ...m, enabled: !m.enabled } : m)));
    } catch (error) {
      console.error('Failed to update model:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexus-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Models</h1>
          <p className="text-gray-500 mt-1">Manage LLM endpoints for Nexus Coder</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-samsung-blue text-white rounded-xl hover:bg-samsung-blue-dark transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Model
        </button>
      </div>

      {/* Models Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Endpoint
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Max Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {models.map((model) => (
              <tr key={model.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-samsung-blue/10 rounded-xl">
                      <Server className="w-5 h-5 text-samsung-blue" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{model.displayName}</p>
                      <p className="text-sm text-gray-500">{model.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-600 truncate max-w-xs" title={model.endpointUrl}>
                    {model.endpointUrl}
                  </p>
                  {model.apiKey && (
                    <p className="text-xs text-gray-400">API Key: {model.apiKey}</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-600">{model.maxTokens.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleEnabled(model)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      model.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {model.enabled ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5" />
                        Disabled
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleEdit(model)}
                    className="p-2 text-gray-400 hover:text-samsung-blue transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(model.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {models.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No models configured. Click "Add Model" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <ModelModal
          model={editingModel}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            loadModels();
          }}
        />
      )}
    </div>
  );
}

interface ModelModalProps {
  model: Model | null;
  onClose: () => void;
  onSave: () => void;
}

function ModelModal({ model, onClose, onSave }: ModelModalProps) {
  const [formData, setFormData] = useState({
    name: model?.name || '',
    displayName: model?.displayName || '',
    endpointUrl: model?.endpointUrl || '',
    apiKey: '',
    maxTokens: model?.maxTokens || 128000,
    enabled: model?.enabled ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = {
        ...formData,
        apiKey: formData.apiKey || undefined,
      };

      if (model) {
        await modelsApi.update(model.id, data);
      } else {
        await modelsApi.create(data);
      }
      onSave();
    } catch (err) {
      setError('Failed to save model. Please check your inputs.');
      console.error('Save model error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {model ? 'Edit Model' : 'Add Model'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="e.g., gpt-4"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="e.g., GPT-4 Turbo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endpoint URL
            </label>
            <input
              type="url"
              value={formData.endpointUrl}
              onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="https://api.openai.com/v1/chat/completions"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key {model && '(leave empty to keep existing)'}
            </label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Tokens
            </label>
            <input
              type="number"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              min={1}
              max={1000000}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-samsung-blue rounded focus:ring-samsung-blue"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700">
              Enable this model
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-samsung-blue text-white rounded-xl hover:bg-samsung-blue-dark disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
