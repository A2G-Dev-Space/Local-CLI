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
import { statsApi } from '../../services/api';

interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
}

interface ChartDataItem {
  date: string;
  [modelId: string]: string | number;
}

// Color palette for different models
const MODEL_COLORS = [
  '#0c8ce6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

const DATE_RANGE_OPTIONS = [
  { label: '2주', value: 14 },
  { label: '1개월', value: 30 },
  { label: '3개월', value: 90 },
  { label: '6개월', value: 180 },
  { label: '1년', value: 365 },
];

export default function ModelUsageChart() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await statsApi.modelDailyTrend(days);
      setModels(response.data.models);
      setChartData(response.data.chartData);
    } catch (error) {
      console.error('Failed to load model usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatYAxis = (value: number): string => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
    return value.toString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (days <= 30) {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  // Calculate tick interval based on date range
  const tickInterval = useMemo(() => {
    if (days <= 14) return 1;
    if (days <= 30) return 2;
    if (days <= 90) return 7;
    if (days <= 180) return 14;
    return 30;
  }, [days]);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">모델별 사용량 추이</h2>
          <p className="text-sm text-gray-500 mt-1">전체 사용자의 모델별 토큰 사용량</p>
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

      {chartData.length === 0 || models.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-gray-400">
          데이터가 없습니다
        </div>
      ) : (
        <div className="h-80">
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
                }}
                formatter={(value: number, name: string) => {
                  const model = models.find((m) => m.id === name);
                  return [formatYAxis(value), model?.displayName || name];
                }}
                labelFormatter={(label) => `날짜: ${label}`}
              />
              <Legend
                formatter={(value: string) => {
                  const model = models.find((m) => m.id === value);
                  return model?.displayName || value;
                }}
              />
              {models.map((model, index) => (
                <Line
                  key={model.id}
                  type="monotone"
                  dataKey={model.id}
                  name={model.id}
                  stroke={MODEL_COLORS[index % MODEL_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
