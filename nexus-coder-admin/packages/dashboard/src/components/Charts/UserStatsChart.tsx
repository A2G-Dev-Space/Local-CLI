import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Users, TrendingUp } from 'lucide-react';
import { statsApi } from '../../services/api';

interface DailyActiveData {
  date: string;
  userCount: number;
}

interface CumulativeData {
  date: string;
  cumulativeUsers: number;
  newUsers: number;
}

const DATE_RANGE_OPTIONS = [
  { label: '2주', value: 14 },
  { label: '1개월', value: 30 },
  { label: '3개월', value: 90 },
  { label: '6개월', value: 180 },
  { label: '1년', value: 365 },
];

type ChartType = 'cumulative' | 'daily';

export default function UserStatsChart() {
  const [dailyData, setDailyData] = useState<DailyActiveData[]>([]);
  const [cumulativeData, setCumulativeData] = useState<CumulativeData[]>([]);
  const [totalUniqueUsers, setTotalUniqueUsers] = useState(0);
  const [totalCumulativeUsers, setTotalCumulativeUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [chartType, setChartType] = useState<ChartType>('cumulative');

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dailyRes, cumulativeRes] = await Promise.all([
        statsApi.dailyActiveUsers(days),
        statsApi.cumulativeUsers(days),
      ]);
      setDailyData(dailyRes.data.chartData);
      setTotalUniqueUsers(dailyRes.data.totalUniqueUsers);
      setCumulativeData(cumulativeRes.data.chartData);
      setTotalCumulativeUsers(cumulativeRes.data.totalUsers);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const tickInterval = useMemo(() => {
    if (days <= 14) return 1;
    if (days <= 30) return 2;
    if (days <= 90) return 7;
    if (days <= 180) return 14;
    return 30;
  }, [days]);

  // Calculate stats for daily active
  const dailyStats = useMemo(() => {
    if (dailyData.length === 0) return { avg: 0, max: 0, today: 0 };
    const counts = dailyData.map((d) => d.userCount);
    return {
      avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      max: Math.max(...counts),
      today: counts[counts.length - 1] || 0,
    };
  }, [dailyData]);

  // Calculate stats for cumulative
  const cumulativeStats = useMemo(() => {
    if (cumulativeData.length === 0) return { newInPeriod: 0, growthRate: 0 };
    const newUsers = cumulativeData.reduce((sum, d) => sum + d.newUsers, 0);
    const startCount = cumulativeData[0]?.cumulativeUsers || 0;
    const endCount = cumulativeData[cumulativeData.length - 1]?.cumulativeUsers || 0;
    // 시작이 0이면 1로 처리 (0으로 나누기 방지)
    const baseCount = startCount > 0 ? startCount : 1;
    const growthRate = ((endCount - startCount) / baseCount) * 100;
    return {
      newInPeriod: newUsers,
      growthRate: Math.round(growthRate * 10) / 10,
    };
  }, [cumulativeData]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexus-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${chartType === 'cumulative' ? 'bg-green-100' : 'bg-blue-100'}`}>
              {chartType === 'cumulative' ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <Users className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {chartType === 'cumulative' ? '누적 사용자 수' : '일별 활성 사용자'}
              </h2>
              <p className="text-sm text-gray-500">
                {chartType === 'cumulative'
                  ? `총 ${totalCumulativeUsers}명 (기간 내 신규 ${cumulativeStats.newInPeriod}명)`
                  : `기간 내 총 ${totalUniqueUsers}명`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDays(option.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  days === option.value
                    ? 'bg-samsung-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart type toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType('cumulative')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              chartType === 'cumulative'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            누적 사용자
          </button>
          <button
            onClick={() => setChartType('daily')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              chartType === 'daily'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            일별 활성 사용자
          </button>
        </div>
      </div>

      {/* Stats summary */}
      {chartType === 'cumulative' ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{totalCumulativeUsers}</p>
            <p className="text-xs text-gray-500">전체 사용자</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">+{cumulativeStats.newInPeriod}</p>
            <p className="text-xs text-gray-500">기간 내 신규</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {cumulativeStats.growthRate > 0 ? '+' : ''}{cumulativeStats.growthRate}%
            </p>
            <p className="text-xs text-gray-500">성장률</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{dailyStats.today}</p>
            <p className="text-xs text-gray-500">오늘</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{dailyStats.avg}</p>
            <p className="text-xs text-gray-500">일평균</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{dailyStats.max}</p>
            <p className="text-xs text-gray-500">최대</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-64">
        {chartType === 'cumulative' ? (
          cumulativeData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              데이터가 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number, name: string) => [
                    `${value}명`,
                    name === 'cumulativeUsers' ? '누적 사용자' : '신규 사용자',
                  ]}
                  labelFormatter={(label) => `날짜: ${label}`}
                />
                <Legend
                  formatter={(value) => (value === 'cumulativeUsers' ? '누적 사용자' : '신규 사용자')}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeUsers"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="newUsers"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )
        ) : dailyData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            데이터가 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number) => [`${value}명`, '활성 사용자']}
                labelFormatter={(label) => `날짜: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="userCount"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#dailyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
