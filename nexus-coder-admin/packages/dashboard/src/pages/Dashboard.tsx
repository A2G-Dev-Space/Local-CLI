import { useState, useEffect } from 'react';
import { Users, Server, Activity, Zap } from 'lucide-react';
import { statsApi } from '../services/api';
import UserStatsChart from '../components/Charts/UserStatsChart';
import ModelUsageChart from '../components/Charts/ModelUsageChart';
import UsersByModelChart from '../components/Charts/UsersByModelChart';

interface OverviewStats {
  activeUsers: number;
  todayUsage: {
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
  };
  totalUsers: number;
  totalModels: number;
}

export default function Dashboard() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const overviewRes = await statsApi.overview();
      setOverview(overviewRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexus-600"></div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Active Users',
      value: overview?.activeUsers || 0,
      icon: Activity,
      color: 'bg-green-500',
      description: 'Last 30 minutes',
    },
    {
      label: 'Total Users',
      value: overview?.totalUsers || 0,
      icon: Users,
      color: 'bg-blue-500',
      description: 'Registered users',
    },
    {
      label: 'Active Models',
      value: overview?.totalModels || 0,
      icon: Server,
      color: 'bg-purple-500',
      description: 'Enabled models',
    },
    {
      label: 'Today\'s Requests',
      value: overview?.todayUsage.requestCount || 0,
      icon: Zap,
      color: 'bg-orange-500',
      description: 'API calls today',
    },
  ];

  const todayTokens = overview?.todayUsage
    ? overview.todayUsage.inputTokens + overview.todayUsage.outputTokens
    : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of Nexus Coder usage and statistics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map(({ label, value, icon: Icon, color, description }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(value)}</p>
                <p className="text-sm font-medium text-gray-600">{label}</p>
                <p className="text-xs text-gray-400">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Token Usage */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Token Usage</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-nexus-600">
              {formatNumber(overview?.todayUsage.inputTokens || 0)}
            </p>
            <p className="text-sm text-gray-500">Input Tokens</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-nexus-600">
              {formatNumber(overview?.todayUsage.outputTokens || 0)}
            </p>
            <p className="text-sm text-gray-500">Output Tokens</p>
          </div>
          <div className="text-center p-4 bg-nexus-50 rounded-lg">
            <p className="text-2xl font-bold text-nexus-700">
              {formatNumber(todayTokens)}
            </p>
            <p className="text-sm text-gray-500">Total Tokens</p>
          </div>
        </div>
      </div>

      {/* User Stats Chart (Cumulative + Daily Active) */}
      <div className="mb-8">
        <UserStatsChart />
      </div>

      {/* Model Usage Chart */}
      <div className="mb-8">
        <ModelUsageChart />
      </div>

      {/* Users by Model Chart */}
      <div className="mb-8">
        <UsersByModelChart />
      </div>
    </div>
  );
}
