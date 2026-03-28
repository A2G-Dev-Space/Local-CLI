import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Users, MonitorDot, HardDrive, AlertTriangle, ArrowUpRight, Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { api } from '@/lib/api';
import clsx from 'clsx';

interface OverviewData {
  activeUsers: number;
  runningSessions: number;
  availableCapacity: number;
  errorRate: number;
  sessionsOverTime: Array<{ time: string; count: number }>;
  toolUsage: Array<{ tool: string; count: number }>;
  recentErrors: Array<{ id: string; time: string; message: string; level: string }>;
}

const kpiConfig = [
  {
    key: 'activeUsers',
    icon: Users,
    gradient: 'from-blue-500 to-cyan-400',
    glow: 'shadow-blue-500/20',
    textColor: 'text-blue-400',
  },
  {
    key: 'runningSessions',
    icon: MonitorDot,
    gradient: 'from-emerald-500 to-green-400',
    glow: 'shadow-emerald-500/20',
    textColor: 'text-emerald-400',
  },
  {
    key: 'availableCapacity',
    icon: HardDrive,
    gradient: 'from-purple-500 to-violet-400',
    glow: 'shadow-purple-500/20',
    textColor: 'text-purple-400',
  },
  {
    key: 'errorRate',
    icon: AlertTriangle,
    gradient: 'from-red-500 to-rose-400',
    glow: 'shadow-red-500/20',
    textColor: 'text-red-400',
    suffix: '%',
  },
];

function KPICard({
  icon: Icon,
  label,
  value,
  gradient,
  glow,
  textColor,
  delay,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  gradient: string;
  glow: string;
  textColor: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 backdrop-blur-xl p-5',
        'hover:shadow-elevation-3 hover:-translate-y-0.5 transition-all duration-300',
      )}
    >
      {/* Subtle gradient background */}
      <div className={clsx('absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.03] blur-2xl bg-gradient-to-br', gradient)} />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={clsx('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center', gradient, 'shadow-lg', glow)}>
            <Icon size={18} className="text-white" />
          </div>
          <div className={clsx('flex items-center gap-1 text-xs font-medium', textColor)}>
            <ArrowUpRight size={13} />
            <span>+12%</span>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.2 }}
          className="text-3xl font-bold text-[var(--text-primary)] tabular-nums"
        >
          {value}
        </motion.div>
        <div className="text-xs text-[var(--text-tertiary)] mt-1">{label}</div>
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl px-3 py-2 shadow-elevation-3 text-xs">
      <p className="text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-[var(--text-primary)] font-semibold">{payload[0].value}</p>
    </div>
  );
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState<OverviewData>({
    activeUsers: 0,
    runningSessions: 0,
    availableCapacity: 0,
    errorRate: 0,
    sessionsOverTime: [],
    toolUsage: [],
    recentErrors: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get<OverviewData>('/api/admin/overview');
        setData(res);
      } catch {
        setData({
          activeUsers: 12,
          runningSessions: 5,
          availableCapacity: 15,
          errorRate: 0.3,
          sessionsOverTime: [
            { time: '00:00', count: 3 },
            { time: '04:00', count: 1 },
            { time: '08:00', count: 7 },
            { time: '12:00', count: 12 },
            { time: '16:00', count: 8 },
            { time: '20:00', count: 5 },
          ],
          toolUsage: [
            { tool: 'bash', count: 245 },
            { tool: 'read_file', count: 189 },
            { tool: 'edit_file', count: 156 },
            { tool: 'create_file', count: 98 },
            { tool: 'search', count: 67 },
          ],
          recentErrors: [],
        });
      }
    };
    fetchData();
  }, []);

  const labels = [
    t('admin.overview.activeUsers'),
    t('admin.overview.runningSessions'),
    t('admin.overview.availableCapacity'),
    t('admin.overview.errorRate'),
  ];
  const values = [
    data.activeUsers,
    data.runningSessions,
    data.availableCapacity,
    `${data.errorRate}%`,
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center shadow-glow-sm">
          <Activity size={18} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('admin.title')}</h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiConfig.map((cfg, i) => (
          <KPICard
            key={cfg.key}
            icon={cfg.icon}
            label={labels[i]}
            value={values[i]}
            gradient={cfg.gradient}
            glow={cfg.glow}
            textColor={cfg.textColor}
            delay={i * 0.06}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sessions over time — Area chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-5">
            Sessions Over Time
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.sessionsOverTime}>
                <defs>
                  <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#sessionGradient)"
                  dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--bg-primary)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Tool usage — Horizontal bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-5">
            Tool Usage
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.toolUsage} layout="vertical">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="tool"
                  type="category"
                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Recent errors */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card p-6"
      >
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Recent Errors
        </h3>
        {data.recentErrors.length === 0 ? (
          <div className="flex flex-col items-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/8 flex items-center justify-center ring-1 ring-emerald-500/15 mb-3">
              <AlertTriangle size={20} className="text-emerald-400" />
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">
              {t('common.noData')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentErrors.map((err) => (
              <div
                key={err.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--bg-primary)]/40 ring-1 ring-[var(--border)] hover:ring-[var(--border-hover)] transition-colors"
              >
                <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text-primary)] truncate">{err.message}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{err.time}</p>
                </div>
                <span className="badge-error text-[10px]">{err.level}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
