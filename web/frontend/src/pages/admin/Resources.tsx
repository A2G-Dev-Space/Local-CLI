import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Cpu, MemoryStick, HardDrive, Container, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';

interface ContainerStats {
  id: string;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  memoryLimit: number;
}

interface ResourceData {
  cpu: number;
  memory: number;
  memoryTotal: number;
  disk: number;
  diskTotal: number;
  availableSlots: number;
  maxSlots: number;
  containers: ContainerStats[];
}

function GaugeChart({
  value,
  label,
  color,
  icon: Icon,
  subtitle,
}: {
  value: number;
  label: string;
  color: string;
  icon: typeof Cpu;
  subtitle?: string;
}) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="card p-6 flex flex-col items-center">
      <div className="relative w-32 h-32 mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--bg-tertiary)"
            strokeWidth="8"
          />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={18} className="text-[var(--text-secondary)] mb-1" />
          <span className="text-2xl font-bold text-[var(--text-primary)]">
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h3>
      {subtitle && (
        <p className="text-xs text-[var(--text-secondary)] mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export default function AdminResources() {
  const { t } = useTranslation();
  const [data, setData] = useState<ResourceData>({
    cpu: 0,
    memory: 0,
    memoryTotal: 0,
    disk: 0,
    diskTotal: 0,
    availableSlots: 0,
    maxSlots: 0,
    containers: [],
  });
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const raw = await api.get<any>('/api/admin/resources');
      // Map API response to our ResourceData shape
      setData({
        cpu: raw.host?.cpuUsagePercent || 0,
        memory: raw.host?.memoryUsagePercent || 0,
        memoryTotal: raw.host?.memoryTotalMB || 0,
        disk: raw.host?.diskUsagePercent || 0,
        diskTotal: raw.host?.diskTotalGB || 0,
        availableSlots: raw.capacity?.availableSessionSlots || 0,
        maxSlots: raw.capacity?.estimatedMaxSessions || 0,
        containers: [],  // Containers fetched separately if needed
      });
    } catch {
      // Placeholder data
      setData({
        cpu: 35,
        memory: 62,
        memoryTotal: 8192,
        disk: 45,
        diskTotal: 100,
        availableSlots: 15,
        maxSlots: 20,
        containers: [
          { id: '1', name: 'session-abc123', status: 'running', cpu: 12.5, memory: 256, memoryLimit: 512 },
          { id: '2', name: 'session-def456', status: 'running', cpu: 8.3, memory: 180, memoryLimit: 512 },
          { id: '3', name: 'session-ghi789', status: 'stopped', cpu: 0, memory: 0, memoryLimit: 512 },
        ],
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getCpuColor = (v: number) => (v > 80 ? 'var(--error)' : v > 60 ? 'var(--warning)' : 'var(--success)');
  const getMemColor = (v: number) => (v > 85 ? 'var(--error)' : v > 70 ? 'var(--warning)' : 'var(--accent)');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('admin.resources.title')}
        </h1>
        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('common.retry')}
        </button>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <GaugeChart
          value={data.cpu}
          label={t('admin.resources.cpu')}
          color={getCpuColor(data.cpu)}
          icon={Cpu}
        />
        <GaugeChart
          value={data.memory}
          label={t('admin.resources.memory')}
          color={getMemColor(data.memory)}
          icon={MemoryStick}
          subtitle={`${Math.round((data.memory / 100) * data.memoryTotal)} / ${data.memoryTotal} MB`}
        />
        <GaugeChart
          value={data.disk}
          label={t('admin.resources.disk')}
          color={data.disk > 90 ? 'var(--error)' : 'var(--info)'}
          icon={HardDrive}
          subtitle={`${Math.round((data.disk / 100) * data.diskTotal)} / ${data.diskTotal} GB`}
        />
        <div className="card p-6 flex flex-col items-center justify-center">
          <Container size={24} className="text-[var(--accent)] mb-3" />
          <div className="text-3xl font-bold text-[var(--text-primary)]">
            {data.availableSlots}
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            / {data.maxSlots} {t('admin.resources.availableSlots')}
          </div>
        </div>
      </div>

      {/* Container table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t('admin.resources.containers')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Container
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  CPU
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Memory
                </th>
              </tr>
            </thead>
            <tbody>
              {data.containers.map((container) => (
                <tr
                  key={container.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
                >
                  <td className="px-5 py-3">
                    <span className="text-sm font-mono text-[var(--text-primary)]">
                      {container.name}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={clsx(
                        'badge',
                        container.status === 'running'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-yellow-500/15 text-yellow-400',
                      )}
                    >
                      {container.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(container.cpu, 100)}%`,
                            backgroundColor: getCpuColor(container.cpu),
                          }}
                        />
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {container.cpu.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all bg-[var(--accent)]"
                          style={{
                            width: `${Math.min(
                              (container.memory / container.memoryLimit) * 100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {container.memory} / {container.memoryLimit} MB
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {data.containers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-[var(--text-secondary)]">
                    {t('common.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
