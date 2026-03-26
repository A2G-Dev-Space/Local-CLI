import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';

interface SettingsData {
  sessionTtlHours: number;
  maxSessionsPerUser: number;
  containerCpuLimit: number;
  containerMemoryLimitMb: number;
  autoCleanupIntervalMin: number;
}

export default function AdminSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SettingsData>({
    sessionTtlHours: 24,
    maxSessionsPerUser: 3,
    containerCpuLimit: 1,
    containerMemoryLimitMb: 512,
    autoCleanupIntervalMin: 60,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<SettingsData>('/api/admin/settings')
      .then(setSettings)
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/admin/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success(t('admin.settings.saved', 'Settings saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    }
    setSaving(false);
  };

  const fields: Array<{
    key: keyof SettingsData;
    label: string;
    min: number;
    max: number;
    step: number;
    unit?: string;
  }> = [
    {
      key: 'sessionTtlHours',
      label: t('admin.settings.sessionTtl'),
      min: 1,
      max: 168,
      step: 1,
      unit: 'h',
    },
    {
      key: 'maxSessionsPerUser',
      label: t('admin.settings.maxSessionsPerUser'),
      min: 1,
      max: 20,
      step: 1,
    },
    {
      key: 'containerCpuLimit',
      label: t('admin.settings.containerCpuLimit'),
      min: 0.25,
      max: 4,
      step: 0.25,
      unit: 'cores',
    },
    {
      key: 'containerMemoryLimitMb',
      label: t('admin.settings.containerMemoryLimit'),
      min: 128,
      max: 4096,
      step: 128,
      unit: 'MB',
    },
    {
      key: 'autoCleanupIntervalMin',
      label: t('admin.settings.autoCleanupInterval'),
      min: 5,
      max: 1440,
      step: 5,
      unit: 'min',
    },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('admin.settings.title')}
        </h1>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-1.5 text-sm text-[var(--success)]"
              >
                <CheckCircle2 size={16} />
                {t('admin.settings.saved')}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('admin.settings.save')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="divide-y divide-[var(--border)]">
          {fields.map((field) => (
            <div
              key={field.key}
              className="px-6 py-5 flex items-center justify-between gap-8 hover:bg-[var(--accent-subtle)] transition-colors"
            >
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  {field.label}
                </label>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {field.min} - {field.max} {field.unit || ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={settings[field.key]}
                  onChange={(e) =>
                    setSettings({ ...settings, [field.key]: parseFloat(e.target.value) })
                  }
                  className="w-40 accent-[var(--accent)]"
                />
                <div className="w-24 text-right">
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={settings[field.key]}
                    onChange={(e) =>
                      setSettings({ ...settings, [field.key]: parseFloat(e.target.value) || 0 })
                    }
                    className="input w-20 text-right text-sm py-1.5"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
