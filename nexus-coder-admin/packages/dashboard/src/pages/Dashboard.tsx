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
        <div className="w-10 h-10 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const stats = [
    {
      label: '활성 사용자',
      value: overview?.activeUsers || 0,
      icon: Activity,
      color: 'bg-emerald-500',
      bgLight: 'bg-emerald-50',
      description: '최근 30분',
    },
    {
      label: '전체 사용자',
      value: overview?.totalUsers || 0,
      icon: Users,
      color: 'bg-samsung-blue',
      bgLight: 'bg-blue-50',
      description: '등록된 사용자',
    },
    {
      label: '활성 모델',
      value: overview?.totalModels || 0,
      icon: Server,
      color: 'bg-violet-500',
      bgLight: 'bg-violet-50',
      description: '사용 가능한 모델',
    },
    {
      label: '오늘 요청',
      value: overview?.todayUsage.requestCount || 0,
      icon: Zap,
      color: 'bg-amber-500',
      bgLight: 'bg-amber-50',
      description: 'API 호출 수',
    },
  ];

  const todayTokens = overview?.todayUsage
    ? overview.todayUsage.inputTokens + overview.todayUsage.outputTokens
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map(({ label, value, icon: Icon, color, bgLight, description }) => (
          <div
            key={label}
            className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(value)}</p>
                <p className="text-xs text-gray-400 mt-1">{description}</p>
              </div>
              <div className={`p-3 rounded-xl ${bgLight}`}>
                <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Token Usage */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">오늘의 토큰 사용량</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-samsung-blue">
              {formatNumber(overview?.todayUsage.inputTokens || 0)}
            </p>
            <p className="text-sm text-gray-500 mt-1">입력 토큰</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-samsung-blue">
              {formatNumber(overview?.todayUsage.outputTokens || 0)}
            </p>
            <p className="text-sm text-gray-500 mt-1">출력 토큰</p>
          </div>
          <div className="text-center p-4 bg-samsung-blue/5 rounded-xl border border-samsung-blue/20">
            <p className="text-2xl font-bold text-samsung-blue-dark">
              {formatNumber(todayTokens)}
            </p>
            <p className="text-sm text-gray-500 mt-1">총 토큰</p>
          </div>
        </div>
      </div>

      {/* User Stats Chart (Cumulative + Daily Active) */}
      <UserStatsChart />

      {/* Model Usage Chart */}
      <ModelUsageChart />

      {/* Users by Model Chart */}
      <UsersByModelChart />
    </div>
  );
}
