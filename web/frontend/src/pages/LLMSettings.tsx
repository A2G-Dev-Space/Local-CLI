import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Cpu, Save, Play, Loader2, CheckCircle2, XCircle, Eye, EyeOff,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

interface LLMConfig {
  endpointUrl: string;
  apiKey: string;
  modelId: string;
  maxTokens: number;
}

interface TestResult {
  success: boolean;
  error?: string;
  models?: string[];
  modelFound?: boolean;
}

export default function LLMSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<LLMConfig>({
    endpointUrl: '',
    apiKey: '',
    modelId: '',
    maxTokens: 16384,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    api.get<LLMConfig>('/api/llm-settings')
      .then((data) => setConfig(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/llm-settings', config);
      toast.success(t('llm.saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<TestResult>('/api/llm-settings/test', config);
      setTestResult(result);
      if (result.success) {
        toast.success(t('llm.connectionSuccess'));
      } else {
        toast.error(result.error || t('llm.connectionFailed'));
      }
    } catch (e) {
      setTestResult({ success: false, error: e instanceof Error ? e.message : 'Test failed' });
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
          <Cpu size={24} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('llm.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('llm.subtitle')}</p>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        {/* Endpoint URL */}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
            {t('llm.endpointUrl')}
          </label>
          <input
            className="input font-mono text-sm"
            value={config.endpointUrl}
            onChange={(e) => setConfig({ ...config, endpointUrl: e.target.value })}
            placeholder="http://localhost:11434/v1"
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {t('llm.endpointHint')}
          </p>
        </div>

        {/* API Key */}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
            {t('llm.apiKey')}
          </label>
          <div className="relative">
            <input
              className="input font-mono text-sm pr-10"
              type={showApiKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder={t('llm.apiKeyPlaceholder')}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {t('llm.apiKeyHint')}
          </p>
        </div>

        {/* Model ID */}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
            {t('llm.modelId')}
          </label>
          <input
            className="input text-sm"
            value={config.modelId}
            onChange={(e) => setConfig({ ...config, modelId: e.target.value })}
            placeholder="qwen2.5-coder:32b"
          />
          {testResult?.models && testResult.models.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {testResult.models.map((m) => (
                <button
                  key={m}
                  onClick={() => setConfig({ ...config, modelId: m })}
                  className={clsx(
                    'px-2 py-0.5 rounded-md text-xs font-mono transition-colors',
                    config.modelId === m
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Max Tokens */}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
            {t('llm.maxTokens')}
          </label>
          <input
            className="input text-sm"
            type="number"
            min={1}
            max={1048576}
            value={config.maxTokens}
            onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 16384 })}
          />
        </div>

        {/* Test Result */}
        {testResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={clsx(
              'border rounded-xl p-4',
              testResult.success
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5',
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {testResult.success ? (
                <CheckCircle2 size={16} className="text-green-400" />
              ) : (
                <XCircle size={16} className="text-red-400" />
              )}
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {testResult.success ? t('llm.connectionSuccess') : t('llm.connectionFailed')}
              </span>
            </div>
            {testResult.error && (
              <p className="text-xs text-[var(--text-secondary)] font-mono mt-1">{testResult.error}</p>
            )}
            {testResult.success && testResult.models && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('llm.modelsFound', { count: testResult.models.length })}
                {testResult.modelFound === false && config.modelId && (
                  <span className="text-yellow-400 ml-2">
                    ({t('llm.modelNotFound', { model: config.modelId })})
                  </span>
                )}
              </p>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
          <button
            onClick={handleTest}
            disabled={testing || !config.endpointUrl}
            className="btn-secondary flex items-center gap-2"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {t('llm.testConnection')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('llm.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
