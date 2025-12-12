import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DailyStat {
  date: string;
  _sum: {
    totalInputTokens: string;
    totalOutputTokens: string;
    requestCount: number;
  };
}

interface UsageChartProps {
  data: DailyStat[];
}

export default function UsageChart({ data }: UsageChartProps) {
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    inputTokens: parseInt(item._sum.totalInputTokens || '0', 10),
    outputTokens: parseInt(item._sum.totalOutputTokens || '0', 10),
    requests: item._sum.requestCount || 0,
  }));

  const formatYAxis = (value: number): string => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
    return value.toString();
  };

  if (chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        No usage data available
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="inputGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0c8ce6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0c8ce6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fill: '#6b7280', fontSize: 12 }}
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
            formatter={(value: number) => [formatYAxis(value), '']}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="inputTokens"
            name="Input Tokens"
            stroke="#0c8ce6"
            strokeWidth={2}
            fill="url(#inputGradient)"
          />
          <Area
            type="monotone"
            dataKey="outputTokens"
            name="Output Tokens"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#outputGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
