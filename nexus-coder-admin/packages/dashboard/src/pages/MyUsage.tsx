import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, Zap, Clock } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { myUsageApi } from '../services/api';

interface UsageSummary {
  today: { requests: number; inputTokens: number; outputTokens: number; totalTokens: number };
  week: { requests: number; inputTokens: number; outputTokens: number; totalTokens: number };
  month: { requests: number; inputTokens: number; outputTokens: number; totalTokens: number };
}

interface DailyStat {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface ModelUsage {
  modelId: string;
  modelName: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface RecentLog {
  id: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  timestamp: string;
}

const COLORS = ['#5BA4D9', '#7DD3FC', '#3D8BC4', '#BAE6FD', '#2980B9', '#1E6091'];

export default function MyUsage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryRes, dailyRes, modelRes, recentRes] = await Promise.all([
        myUsageApi.summary(),
        myUsageApi.daily(days),
        myUsageApi.byModel(days),
        myUsageApi.recent(20),
      ]);

      setSummary(summaryRes.data);
      setDailyStats(dailyRes.data.stats);
      setModelUsage(modelRes.data.usage);
      setRecentLogs(recentRes.data.logs);
    } catch (error) {
      console.error('Failed to load usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-pastel-800">내 사용량</h1>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                days === d
                  ? 'bg-samsung-blue text-white shadow-sm'
                  : 'bg-white text-pastel-600 hover:bg-pastel-50 border border-pastel-200'
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-pastel-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-pastel-100 rounded-lg">
                <Zap className="w-5 h-5 text-samsung-blue" />
              </div>
              <span className="text-sm font-medium text-pastel-600">오늘</span>
            </div>
            <p className="text-2xl font-bold text-pastel-800">{formatNumber(summary.today.totalTokens)}</p>
            <p className="text-sm text-pastel-500 mt-1">{summary.today.requests} 요청</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-pastel-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-pastel-100 rounded-lg">
                <Calendar className="w-5 h-5 text-samsung-blue" />
              </div>
              <span className="text-sm font-medium text-pastel-600">이번 주</span>
            </div>
            <p className="text-2xl font-bold text-pastel-800">{formatNumber(summary.week.totalTokens)}</p>
            <p className="text-sm text-pastel-500 mt-1">{summary.week.requests} 요청</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-pastel-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-pastel-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-samsung-blue" />
              </div>
              <span className="text-sm font-medium text-pastel-600">이번 달</span>
            </div>
            <p className="text-2xl font-bold text-pastel-800">{formatNumber(summary.month.totalTokens)}</p>
            <p className="text-sm text-pastel-500 mt-1">{summary.month.requests} 요청</p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Usage Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-pastel-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-samsung-blue" />
            <h2 className="font-semibold text-pastel-800">일별 사용량</h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats}>
                <defs>
                  <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5BA4D9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#5BA4D9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#6B7B8C"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={formatNumber}
                  stroke="#6B7B8C"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E0F2FE',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatNumber(value), '토큰']}
                  labelFormatter={(label) => `날짜: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="totalTokens"
                  stroke="#5BA4D9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTokens)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Usage Pie Chart */}
        <div className="bg-white rounded-xl p-5 border border-pastel-100 shadow-sm">
          <h2 className="font-semibold text-pastel-800 mb-4">모델별 사용량</h2>
          {modelUsage.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modelUsage}
                    dataKey="totalTokens"
                    nameKey="modelName"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ modelName, percent }) =>
                      `${modelName.slice(0, 10)}${modelName.length > 10 ? '..' : ''} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {modelUsage.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatNumber(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-pastel-500">
              사용 데이터가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Daily Requests Bar Chart */}
      <div className="bg-white rounded-xl p-5 border border-pastel-100 shadow-sm">
        <h2 className="font-semibold text-pastel-800 mb-4">일별 요청 수 및 토큰</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#6B7B8C"
                fontSize={12}
              />
              <YAxis yAxisId="left" stroke="#5BA4D9" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#7DD3FC" fontSize={12} tickFormatter={formatNumber} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E0F2FE',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="requests" fill="#5BA4D9" name="요청 수" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="inputTokens" fill="#7DD3FC" name="입력 토큰" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="outputTokens" fill="#BAE6FD" name="출력 토큰" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Usage Table */}
      <div className="bg-white rounded-xl border border-pastel-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-pastel-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-samsung-blue" />
            <h2 className="font-semibold text-pastel-800">최근 사용 기록</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-pastel-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                  시간
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                  모델
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                  입력 토큰
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                  출력 토큰
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                  총 토큰
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pastel-100">
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-pastel-50/50 transition-colors">
                    <td className="px-5 py-4 text-sm text-pastel-600">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-pastel-100 text-pastel-700">
                        {log.modelName}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-right text-pastel-600">
                      {formatNumber(log.inputTokens)}
                    </td>
                    <td className="px-5 py-4 text-sm text-right text-pastel-600">
                      {formatNumber(log.outputTokens)}
                    </td>
                    <td className="px-5 py-4 text-sm text-right font-medium text-pastel-800">
                      {formatNumber(log.totalTokens)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-pastel-500">
                    사용 기록이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Usage Table */}
      {modelUsage.length > 0 && (
        <div className="bg-white rounded-xl border border-pastel-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-pastel-100">
            <h2 className="font-semibold text-pastel-800">모델별 상세 사용량</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-pastel-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                    모델
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                    요청 수
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                    입력 토큰
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                    출력 토큰
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-pastel-600 uppercase tracking-wider">
                    총 토큰
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pastel-100">
                {modelUsage.map((model) => (
                  <tr key={model.modelId} className="hover:bg-pastel-50/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-pastel-800">
                      {model.modelName}
                    </td>
                    <td className="px-5 py-4 text-sm text-right text-pastel-600">
                      {model.requests.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-sm text-right text-pastel-600">
                      {formatNumber(model.inputTokens)}
                    </td>
                    <td className="px-5 py-4 text-sm text-right text-pastel-600">
                      {formatNumber(model.outputTokens)}
                    </td>
                    <td className="px-5 py-4 text-sm text-right font-medium text-pastel-800">
                      {formatNumber(model.totalTokens)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
