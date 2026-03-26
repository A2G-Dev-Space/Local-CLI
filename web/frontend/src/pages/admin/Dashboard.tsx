import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Users, MonitorDot, HardDrive, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';

interface OverviewData {
  activeUsers: number;
  runningSessions: number;
  availableCapacity: number;
  errorRate: number;
  sessionsOverTime: Array<{ time: string; count: number }>;
  toolUsage: Array<{ tool: string; count: number }>;
  recentErrors: Array<{ id: string; time: string; message: string; level: string }>;
}

function KPICard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
        <TrendingUp size={16} className="text-[var(--success)]" />
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
      <div className="text-xs text-[var(--text-secondary)] mt-1">{label}</div>
    </motion.div>
  );
}

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
        // Use placeholder data for display
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t('admin.title')}</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          icon={Users}
          label={t('admin.overview.activeUsers')}
          value={data.activeUsers}
          color="bg-blue-500"
          delay={0}
        />
        <KPICard
          icon={MonitorDot}
          label={t('admin.overview.runningSessions')}
          value={data.runningSessions}
          color="bg-green-500"
          delay={0.05}
        />
        <KPICard
          icon={HardDrive}
          label={t('admin.overview.availableCapacity')}
          value={data.availableCapacity}
          color="bg-purple-500"
          delay={0.1}
        />
        <KPICard
          icon={AlertTriangle}
          label={t('admin.overview.errorRate')}
          value={`${data.errorRate}%`}
          color="bg-red-500"
          delay={0.15}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sessions over time */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Sessions Over Time
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sessionsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--accent)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tool usage */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Tool Usage
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.toolUsage} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  dataKey="tool"
                  type="category"
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent errors */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Recent Errors
        </h3>
        {data.recentErrors.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-8">
            {t('common.noData')}
          </p>
        ) : (
          <div className="space-y-2">
            {data.recentErrors.map((err) => (
              <div
                key={err.id}
                className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[var(--bg-primary)]"
              >
                <AlertTriangle size={16} className="text-[var(--error)] mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text-primary)] truncate">{err.message}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{err.time}</p>
                </div>
                <span className="badge-error text-xs">{err.level}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
