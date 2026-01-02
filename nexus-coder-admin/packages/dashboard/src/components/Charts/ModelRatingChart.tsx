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
import { ratingApi } from '../../services/api';

interface DailyRating {
  date: string;
  modelName: string;
  averageRating: number;
  ratingCount: number;
}

interface ModelStats {
  modelName: string;
  averageRating: number | null;
  totalRatings: number;
}

interface ChartDataItem {
  date: string;
  [modelName: string]: string | number | null;
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
];

const DATE_RANGE_OPTIONS = [
  { label: '1주', value: 7 },
  { label: '2주', value: 14 },
  { label: '1개월', value: 30 },
  { label: '3개월', value: 90 },
];

/**
 * Generate all dates in range (for padding missing dates with 0)
 */
function generateDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

export default function ModelRatingChart() {
  const [dailyData, setDailyData] = useState<DailyRating[]>([]);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await ratingApi.stats(days);
      setDailyData(response.data.daily || []);
      setModelStats(response.data.byModel || []);
    } catch (error) {
      console.error('Failed to load rating data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique model names
  const modelNames = useMemo(() => {
    const names = new Set<string>();
    dailyData.forEach((d) => names.add(d.modelName));
    modelStats.forEach((m) => names.add(m.modelName));
    return Array.from(names).sort();
  }, [dailyData, modelStats]);

  // Transform daily data into chart format with date padding
  const chartData = useMemo(() => {
    if (modelNames.length === 0) return [];

    // Generate all dates in range
    const allDates = generateDateRange(days);

    // Create a map of date+model -> rating
    const ratingMap = new Map<string, number>();
    dailyData.forEach((d) => {
      const dateStr = d.date.split('T')[0];
      ratingMap.set(`${dateStr}_${d.modelName}`, d.averageRating);
    });

    // Build chart data with padding (0 for missing dates)
    return allDates.map((date) => {
      const item: ChartDataItem = { date };
      modelNames.forEach((modelName) => {
        const key = `${date}_${modelName}`;
        // Use 0 for missing data (no ratings that day)
        item[modelName] = ratingMap.has(key) ? ratingMap.get(key)! : 0;
      });
      return item;
    });
  }, [dailyData, modelNames, days]);

  // Calculate cumulative average (all-time average up to each date)
  const cumulativeChartData = useMemo(() => {
    if (chartData.length === 0 || modelNames.length === 0) return [];

    // Track cumulative sum and count for each model
    const cumSum: Record<string, number> = {};
    const cumCount: Record<string, number> = {};
    modelNames.forEach((m) => {
      cumSum[m] = 0;
      cumCount[m] = 0;
    });

    return chartData.map((item) => {
      const newItem: ChartDataItem = { date: item.date };
      modelNames.forEach((modelName) => {
        const dailyValue = item[modelName] as number;
        if (dailyValue > 0) {
          cumSum[modelName] += dailyValue;
          cumCount[modelName] += 1;
        }
        // Cumulative average (0 if no data yet)
        newItem[modelName] = cumCount[modelName] > 0
          ? cumSum[modelName] / cumCount[modelName]
          : 0;
      });
      return newItem;
    });
  }, [chartData, modelNames]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  // Calculate tick interval based on date range
  const tickInterval = useMemo(() => {
    if (days <= 7) return 0;
    if (days <= 14) return 1;
    if (days <= 30) return 2;
    return 7;
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
          <h2 className="text-lg font-semibold text-gray-900">Model Ratings</h2>
          <p className="text-sm text-gray-500 mt-1">모델별 누적 평균 평점 (1-5)</p>
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

      {/* Overall Stats Cards */}
      {modelStats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {modelStats.map((model, idx) => (
            <div key={model.modelName} className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 truncate">{model.modelName}</p>
              <p
                className="text-xl font-bold"
                style={{ color: MODEL_COLORS[idx % MODEL_COLORS.length] }}
              >
                {model.averageRating !== null ? model.averageRating.toFixed(2) : '-'}
              </p>
              <p className="text-xs text-gray-400">{model.totalRatings} ratings</p>
            </div>
          ))}
        </div>
      )}

      {cumulativeChartData.length === 0 || modelNames.length === 0 ? (
        <div className="h-60 flex items-center justify-center text-gray-400">
          No rating data available
        </div>
      ) : (
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                domain={[0, 5]}
                ticks={[1, 2, 3, 4, 5]}
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
                formatter={(value: number, name: string) => [
                  value > 0 ? value.toFixed(2) : 'No data',
                  name,
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              {modelNames.map((modelName, index) => (
                <Line
                  key={modelName}
                  type="monotone"
                  dataKey={modelName}
                  name={modelName}
                  stroke={MODEL_COLORS[index % MODEL_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
