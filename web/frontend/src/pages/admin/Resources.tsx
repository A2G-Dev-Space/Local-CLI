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

const gaugeColors = {
  low: { stroke: '#22c55e', bg: 'bg-emerald-500/8', ring: 'ring-emerald-500/15', text: 'text-emerald-400' },
  mid: { stroke: '#f59e0b', bg: 'bg-amber-500/8', ring: 'ring-amber-500/15', text: 'text-amber-400' },
  high: { stroke: '#ef4444', bg: 'bg-red-500/8', ring: 'ring-red-500/15', text: 'text-red-400' },
};

function getColorConfig(value: number, highThreshold = 80, midThreshold = 60) {
  if (value > highThreshold) return gaugeColors.high;
  if (value > midThreshold) return gaugeColors.mid;
  return gaugeColors.low;
}

function GaugeChart({
  value,
  label,
  icon: Icon,
  subtitle,
  delay = 0,
}: {
  value: number;
  label: string;
  icon: typeof Cpu;
  subtitle?: string;
  delay?: number;
}) {
  const size = 140;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const colorCfg = getColorConfig(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 backdrop-blur-xl p-6',
        'flex flex-col items-center hover:shadow-elevation-3 hover:-translate-y-0.5 transition-all duration-300',
      )}
    >
      {/* Subtle glow */}
      <div
        className="absolute inset-0 opacity-[0.06] blur-3xl"
        style={{ background: `radial-gradient(circle at 50% 30%, ${colorCfg.stroke}, transparent 70%)` }}
      />

      <div className="relative w-[140px] h-[140px] mb-4">
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="var(--bg-tertiary)" strokeWidth={stroke}
            opacity={0.4}
          />
          {/* Value arc */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={colorCfg.stroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay }}
          />
          {/* Glow arc */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={colorCfg.stroke}
            strokeWidth={stroke + 4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay }}
            opacity={0.25}
            filter="blur(4px)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={16} className="text-[var(--text-tertiary)] mb-1" />
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.5 }}
            className="text-2xl font-bold text-[var(--text-primary)] tabular-nums"
          >
            {Math.round(value)}
          </motion.span>
          <span className="text-[10px] text-[var(--text-tertiary)]">%</span>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h3>
      {subtitle && (
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{subtitle}</p>
      )}
    </motion.div>
  );
}

export default function AdminResources() {
  const { t } = useTranslation();
  const [data, setData] = useState<ResourceData>({
    cpu: 0, memory: 0, memoryTotal: 0, disk: 0, diskTotal: 0,
    availableSlots: 0, maxSlots: 0, containers: [],
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
        cpu: raw.host?.cpuUsagePercent || 0,
        memory: raw.host?.memoryUsagePercent || 0,
        memoryTotal: raw.host?.memoryTotalMB || 0,
        disk: raw.host?.diskUsagePercent || 0,
        diskTotal: raw.host?.diskTotalGB || 0,
        availableSlots: raw.capacity?.availableSessionSlots || 0,
        maxSlots: raw.capacity?.estimatedMaxSessions || 0,
        containers: [],
      });
    } catch {
      setData({
        cpu: 35, memory: 62, memoryTotal: 8192, disk: 45, diskTotal: 100,
        availableSlots: 15, maxSlots: 20,
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

  const getCpuColor = (v: number) => getColorConfig(v);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('admin.resources.title')}
        </h1>
        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {t('common.retry')}
        </button>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <GaugeChart
          value={data.cpu}
          label={t('admin.resources.cpu')}
          icon={Cpu}
          delay={0}
        />
        <GaugeChart
          value={data.memory}
          label={t('admin.resources.memory')}
          icon={MemoryStick}
          subtitle={`${Math.round((data.memory / 100) * data.memoryTotal)} / ${data.memoryTotal} MB`}
          delay={0.1}
        />
        <GaugeChart
          value={data.disk}
          label={t('admin.resources.disk')}
          icon={HardDrive}
          subtitle={`${Math.round((data.disk / 100) * data.diskTotal)} / ${data.diskTotal} GB`}
          delay={0.2}
        />
        {/* Slots card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 backdrop-blur-xl p-6 flex flex-col items-center justify-center hover:shadow-elevation-3 hover:-translate-y-0.5 transition-all duration-300"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/8 ring-1 ring-[var(--accent)]/15 flex items-center justify-center mb-3">
            <Container size={22} className="text-[var(--accent)]" />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-3xl font-bold text-[var(--text-primary)] tabular-nums"
          >
            {data.availableSlots}
          </motion.div>
          <div className="text-[11px] text-[var(--text-tertiary)] mt-1">
            / {data.maxSlots} {t('admin.resources.availableSlots')}
          </div>
        </motion.div>
      </div>

      {/* Container table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--glass-border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t('admin.resources.containers')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-premium">
            <thead>
              <tr>
                <th>Container</th>
                <th>Status</th>
                <th>CPU</th>
                <th>Memory</th>
              </tr>
            </thead>
            <tbody>
              {data.containers.map((container) => {
                const cpuCfg = getCpuColor(container.cpu);
                const memPct = (container.memory / container.memoryLimit) * 100;
                return (
                  <tr key={container.id}>
                    <td>
                      <span className="text-sm font-mono text-[var(--text-primary)]">
                        {container.name}
                      </span>
                    </td>
                    <td>
                      <span
                        className={clsx(
                          'badge text-[10px]',
                          container.status === 'running'
                            ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
                        )}
                      >
                        {container.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-[var(--bg-tertiary)]/60 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(container.cpu, 100)}%`,
                              backgroundColor: cpuCfg.stroke,
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                          {container.cpu.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-[var(--bg-tertiary)]/60 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-all"
                            style={{ width: `${Math.min(memPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                          {container.memory} / {container.memoryLimit} MB
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.containers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-[var(--text-tertiary)]">
                    {t('common.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
