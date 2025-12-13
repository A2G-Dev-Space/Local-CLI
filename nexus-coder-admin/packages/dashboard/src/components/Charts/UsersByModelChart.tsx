import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { statsApi, modelsApi } from '../../services/api';

interface UserInfo {
  id: string;
  loginid: string;
  username: string;
  deptname: string;
  totalTokens: number;
}

interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
}

interface ChartDataItem {
  date: string;
  [userId: string]: string | number;
}

// Color palette for different users
const USER_COLORS = [
  '#0c8ce6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#f43f5e', '#22c55e', '#3b82f6',
  '#eab308', '#d946ef', '#0ea5e9', '#65a30d', '#e11d48',
];

const DATE_RANGE_OPTIONS = [
  { label: '2주', value: 14 },
  { label: '1개월', value: 30 },
  { label: '3개월', value: 90 },
  { label: '6개월', value: 180 },
  { label: '1년', value: 365 },
];

const TOP_N_OPTIONS = [10, 20, 30, 50, 100];

export default function UsersByModelChart() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [days, setDays] = useState(30);
  const [topN, setTopN] = useState(10);

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, []);

  // Load chart data when model, days, or topN changes
  useEffect(() => {
    if (selectedModelId) {
      loadChartData();
    }
  }, [selectedModelId, days, topN]);

  const loadModels = async () => {
    try {
      const response = await modelsApi.list();
      const modelList = response.data.models;
      setModels(modelList);
      if (modelList.length > 0) {
        setSelectedModelId(modelList[0].id);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    setLoadingChart(true);
    try {
      const response = await statsApi.modelUserTrend(selectedModelId, days, topN);
      setUsers(response.data.users);
      setChartData(response.data.chartData);
    } catch (error) {
      console.error('Failed to load user trend data:', error);
    } finally {
      setLoadingChart(false);
    }
  };

  const formatYAxis = (value: number): string => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
    return value.toString();
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

  const selectedModel = models.find((m) => m.id === selectedModelId);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexus-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">모델별 사용자 사용량 추이</h2>
            <p className="text-sm text-gray-500 mt-1">
              {selectedModel ? `${selectedModel.displayName} - Top ${topN} 사용자` : '모델을 선택하세요'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Model selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">모델:</label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-nexus-500 focus:border-transparent"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Top N selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Top:</label>
            <select
              value={topN}
              onChange={(e) => setTopN(parseInt(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-nexus-500 focus:border-transparent"
            >
              {TOP_N_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}명
                </option>
              ))}
            </select>
          </div>

          {/* Date range buttons */}
          <div className="flex items-center gap-2 ml-auto">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDays(option.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  days === option.value
                    ? 'bg-nexus-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loadingChart ? (
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexus-600"></div>
        </div>
      ) : chartData.length === 0 || users.length === 0 ? (
        <div className="h-96 flex items-center justify-center text-gray-400">
          데이터가 없습니다
        </div>
      ) : (
        <>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  interval={tickInterval}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    maxHeight: '300px',
                    overflow: 'auto',
                  }}
                  formatter={(value: number, name: string) => {
                    const user = users.find((u) => u.id === name);
                    return [formatYAxis(value), user?.username || user?.loginid || name];
                  }}
                  labelFormatter={(label) => `날짜: ${label}`}
                />
                <Legend
                  formatter={(value: string) => {
                    const user = users.find((u) => u.id === value);
                    return user?.username || user?.loginid || value;
                  }}
                  wrapperStyle={{ fontSize: '11px' }}
                />
                {users.map((user, index) => (
                  <Line
                    key={user.id}
                    type="monotone"
                    dataKey={user.id}
                    name={user.id}
                    stroke={USER_COLORS[index % USER_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* User ranking table */}
          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">사용량 순위 (누적)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {users.slice(0, 10).map((user, index) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <span
                    className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: USER_COLORS[index % USER_COLORS.length] }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-900 truncate">{user.username}</p>
                    <p className="text-xs text-gray-500">{formatYAxis(user.totalTokens)} tokens</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
