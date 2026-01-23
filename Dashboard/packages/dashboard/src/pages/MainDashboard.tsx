import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Activity, Zap, Building2, TrendingUp, ArrowRight, Server, Plus, X, Clock, Star } from 'lucide-react';
import { statsApi, serviceApi, ratingApi } from '../services/api';

type AdminRole = 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER' | null;

interface MainDashboardProps {
  adminRole: AdminRole;
}
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Service {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  iconUrl?: string;
  enabled: boolean;
  _count: {
    models: number;
    usageLogs: number;
  };
}

interface GlobalOverviewService {
  serviceId: string;
  serviceName: string;
  serviceDisplayName: string;
  totalUsers: number;
  avgDailyActiveUsers: number;
  totalTokens: number;
  totalRequests: number;
}

interface ServiceDailyData {
  date: string;
  serviceId: string;
  serviceName: string;
  requests: number;
  totalTokens: number;
}

interface DeptStats {
  deptname: string;
  cumulativeUsers: number;
  avgDailyActiveUsers: number;
  totalTokens: number;
  tokensByModel: { modelName: string; tokens: number }[];
}

interface DeptDailyData {
  date: string;
  [businessUnit: string]: string | number;
}

interface DeptUsersDaily {
  date: string;
  [key: string]: string | number; // BU_active, BU_cumulative
}

interface DeptServiceRequestsDaily {
  date: string;
  [key: string]: string | number; // "BU/Service" combinations
}

interface GlobalTotals {
  totalServices: number;
  totalUsers: number;
  avgDailyActiveUsers: number;
  totalRequests: number;
  totalTokens: number;
}

interface LatencyStat {
  serviceId: string;
  serviceName: string;
  modelId: string;
  modelName: string;
  avg10m: number | null;
  avg30m: number | null;
  avg1h: number | null;
  avg24h: number | null;
  count10m: number;
  count30m: number;
  count1h: number;
  count24h: number;
}

interface LatencyHistoryPoint {
  time: string;
  avgLatency: number;
  count: number;
}

interface LatencyHistory {
  [key: string]: LatencyHistoryPoint[];
}

interface RatingDailyData {
  date: string;
  modelName: string;
  serviceName: string | null;
  averageRating: number;
  ratingCount: number;
}

interface RatingByModel {
  modelName: string;
  serviceName: string | null;
  averageRating: number | null;
  totalRatings: number;
}

export default function MainDashboard({ adminRole }: MainDashboardProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [globalOverview, setGlobalOverview] = useState<GlobalOverviewService[]>([]);
  const [globalTotals, setGlobalTotals] = useState<GlobalTotals | null>(null);
  const [serviceDaily, setServiceDaily] = useState<ServiceDailyData[]>([]);
  const [deptStats, setDeptStats] = useState<DeptStats[]>([]);
  const [deptDailyData, setDeptDailyData] = useState<DeptDailyData[]>([]);
  const [deptBusinessUnits, setDeptBusinessUnits] = useState<string[]>([]);
  const [deptUsersDailyData, setDeptUsersDailyData] = useState<DeptUsersDaily[]>([]);
  const [deptUsersBUs, setDeptUsersBUs] = useState<string[]>([]);
  const [deptServiceRequestsData, setDeptServiceRequestsData] = useState<DeptServiceRequestsDaily[]>([]);
  const [deptServiceCombos, setDeptServiceCombos] = useState<string[]>([]);
  const [latencyStats, setLatencyStats] = useState<LatencyStat[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<LatencyHistory>({});
  const [ratingDailyData, setRatingDailyData] = useState<RatingDailyData[]>([]);
  const [ratingByModel, setRatingByModel] = useState<RatingByModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    displayName: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [servicesRes, globalRes, serviceDailyRes, deptRes, deptDailyRes, deptUsersDailyRes, deptServiceReqsRes, latencyRes, latencyHistoryRes, ratingRes] = await Promise.all([
        serviceApi.list(),
        statsApi.globalOverview(),
        statsApi.globalByService(30),
        statsApi.globalByDept(30),
        statsApi.globalByDeptDaily(30, 5),
        statsApi.globalByDeptUsersDaily(30, 5),
        statsApi.globalByDeptServiceRequestsDaily(30, 10),
        statsApi.latency(),
        statsApi.latencyHistory(24, 10),
        ratingApi.stats(30),
      ]);

      setServices(servicesRes.data.services || []);
      setGlobalOverview(globalRes.data.services || []);
      setGlobalTotals(globalRes.data.totals || null);
      setServiceDaily(serviceDailyRes.data.dailyData || []);
      setDeptStats(deptRes.data.deptStats || []);
      setDeptDailyData(deptDailyRes.data.chartData || []);
      setDeptBusinessUnits(deptDailyRes.data.businessUnits || []);
      setDeptUsersDailyData(deptUsersDailyRes.data.chartData || []);
      setDeptUsersBUs(deptUsersDailyRes.data.businessUnits || []);
      setDeptServiceRequestsData(deptServiceReqsRes.data.chartData || []);
      setDeptServiceCombos(deptServiceReqsRes.data.combinations || []);
      setLatencyStats(latencyRes.data.stats || []);
      setLatencyHistory(latencyHistoryRes.data.history || {});
      setRatingDailyData(ratingRes.data.daily || []);
      setRatingByModel(ratingRes.data.byModel || []);
    } catch (error) {
      console.error('Failed to load main dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.name || !newService.displayName) return;

    setCreating(true);
    try {
      await serviceApi.create({
        name: newService.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        displayName: newService.displayName,
        description: newService.description || undefined,
        enabled: true,
      });
      setShowCreateModal(false);
      setNewService({ name: '', displayName: '', description: '' });
      loadData();
      // Notify sidebar to refresh services
      window.dispatchEvent(new CustomEvent('services-updated'));
    } catch (error) {
      console.error('Failed to create service:', error);
      alert('서비스 생성에 실패했습니다. 이미 존재하는 이름인지 확인해주세요.');
    } finally {
      setCreating(false);
    }
  };

  // Merge services with globalOverview data (to show services with no data)
  const mergedServiceStats = services.map((service) => {
    const stats = globalOverview.find((s) => s.serviceId === service.id);
    return {
      serviceId: service.id,
      serviceName: service.name,
      serviceDisplayName: service.displayName,
      iconUrl: service.iconUrl,
      totalUsers: stats?.totalUsers || 0,
      avgDailyActiveUsers: stats?.avgDailyActiveUsers || 0,
      totalTokens: stats?.totalTokens || 0,
      totalRequests: stats?.totalRequests || 0,
      hasData: !!stats && (stats.totalUsers > 0 || stats.totalRequests > 0),
    };
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Use deduplicated totals from API (users/avgDailyActiveUsers are deduplicated across services)
  const totalUsers = globalTotals?.totalUsers ?? 0;
  const avgDailyActive = globalTotals?.avgDailyActiveUsers ?? 0;
  const totalTokens = globalTotals?.totalTokens ?? globalOverview.reduce((sum, s) => sum + s.totalTokens, 0);
  const totalRequests = globalTotals?.totalRequests ?? globalOverview.reduce((sum, s) => sum + s.totalRequests, 0);

  // Prepare chart data for service daily usage
  const uniqueDates = [...new Set(serviceDaily.map(d => d.date))].sort();
  const uniqueServices = [...new Set(serviceDaily.map(d => d.serviceName))];

  const colors = [
    { bg: 'rgba(59, 130, 246, 0.5)', border: 'rgb(59, 130, 246)' },
    { bg: 'rgba(16, 185, 129, 0.5)', border: 'rgb(16, 185, 129)' },
    { bg: 'rgba(245, 158, 11, 0.5)', border: 'rgb(245, 158, 11)' },
    { bg: 'rgba(139, 92, 246, 0.5)', border: 'rgb(139, 92, 246)' },
    { bg: 'rgba(236, 72, 153, 0.5)', border: 'rgb(236, 72, 153)' },
  ];

  const serviceChartData = {
    labels: uniqueDates.map(d => d.slice(5)), // MM-DD format
    datasets: uniqueServices.map((serviceName, index) => ({
      label: serviceName,
      data: uniqueDates.map(date => {
        const entry = serviceDaily.find(d => d.date === date && d.serviceName === serviceName);
        return entry?.requests || 0;
      }),
      backgroundColor: colors[index % colors.length].bg,
      borderColor: colors[index % colors.length].border,
      borderWidth: 2,
      fill: false,
      tension: 0.3,
    })),
  };

  // Prepare dept daily token usage line chart data
  const deptLineChartData = {
    labels: deptDailyData.map(d => (d.date as string).slice(5)), // MM-DD format
    datasets: deptBusinessUnits.map((bu, index) => ({
      label: bu,
      data: deptDailyData.map(d => (d[bu] as number) || 0),
      borderColor: colors[index % colors.length].border,
      backgroundColor: colors[index % colors.length].bg,
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
    })),
  };

  // Prepare dept users daily chart data (cumulative line + active bar)
  const deptUsersChartData = {
    labels: deptUsersDailyData.map(d => (d.date as string).slice(5)),
    datasets: deptUsersBUs.flatMap((bu, index) => [
      {
        type: 'line' as const,
        label: `${bu} (누적)`,
        data: deptUsersDailyData.map(d => (d[`${bu}_cumulative`] as number) || 0),
        borderColor: colors[index % colors.length].border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: 'y',
        order: 1, // Draw lines on top
      },
      {
        type: 'bar' as const,
        label: `${bu} (활성)`,
        data: deptUsersDailyData.map(d => (d[`${bu}_active`] as number) || 0),
        backgroundColor: colors[index % colors.length].bg,
        borderColor: colors[index % colors.length].border,
        borderWidth: 1,
        yAxisID: 'y1',
        order: 2, // Draw bars behind lines
      },
    ]),
  };

  // Extended color palette for distinct colors
  const extendedColors = [
    { bg: 'rgba(59, 130, 246, 0.5)', border: 'rgb(59, 130, 246)' },   // Blue
    { bg: 'rgba(16, 185, 129, 0.5)', border: 'rgb(16, 185, 129)' },   // Emerald
    { bg: 'rgba(245, 158, 11, 0.5)', border: 'rgb(245, 158, 11)' },   // Amber
    { bg: 'rgba(139, 92, 246, 0.5)', border: 'rgb(139, 92, 246)' },   // Violet
    { bg: 'rgba(236, 72, 153, 0.5)', border: 'rgb(236, 72, 153)' },   // Pink
    { bg: 'rgba(6, 182, 212, 0.5)', border: 'rgb(6, 182, 212)' },     // Cyan
    { bg: 'rgba(234, 88, 12, 0.5)', border: 'rgb(234, 88, 12)' },     // Orange
    { bg: 'rgba(99, 102, 241, 0.5)', border: 'rgb(99, 102, 241)' },   // Indigo
    { bg: 'rgba(34, 197, 94, 0.5)', border: 'rgb(34, 197, 94)' },     // Green
    { bg: 'rgba(239, 68, 68, 0.5)', border: 'rgb(239, 68, 68)' },     // Red
    { bg: 'rgba(168, 85, 247, 0.5)', border: 'rgb(168, 85, 247)' },   // Purple
    { bg: 'rgba(14, 165, 233, 0.5)', border: 'rgb(14, 165, 233)' },   // Sky
    { bg: 'rgba(251, 146, 60, 0.5)', border: 'rgb(251, 146, 60)' },   // Orange-light
    { bg: 'rgba(132, 204, 22, 0.5)', border: 'rgb(132, 204, 22)' },   // Lime
    { bg: 'rgba(244, 63, 94, 0.5)', border: 'rgb(244, 63, 94)' },     // Rose
  ];

  // Prepare dept+service API requests chart data (distinct colors)
  const deptServiceRequestsChartData = {
    labels: deptServiceRequestsData.map(d => (d.date as string).slice(5)),
    datasets: deptServiceCombos.map((combo, index) => {
      const color = extendedColors[index % extendedColors.length];
      return {
        label: combo,
        data: deptServiceRequestsData.map(d => (d[combo] as number) || 0),
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
      };
    }),
  };

  // Prepare latency chart data (distinct colors)
  const latencyKeys = Object.keys(latencyHistory);
  const latencyChartData = {
    labels: latencyKeys.length > 0
      ? latencyHistory[latencyKeys[0]]?.map(p => {
          const time = new Date(p.time);
          return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
        }) || []
      : [],
    datasets: latencyKeys.map((key, index) => {
      const color = extendedColors[index % extendedColors.length];
      return {
        label: key,
        data: latencyHistory[key]?.map(p => p.avgLatency) || [],
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
      };
    }),
  };

  // Prepare rating chart data (Line: cumulative average, Bar: daily average)
  const ratingDates = [...new Set(ratingDailyData.map(d => typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10)))].sort();
  // Create unique service/model combinations
  const ratingCombos = [...new Set(ratingDailyData.map(d => `${d.serviceName || 'unknown'}/${d.modelName}`))];
  const ratingChartData = {
    labels: ratingDates.map(d => d.slice(5)), // MM-DD format
    datasets: ratingCombos.flatMap((combo, index) => {
      const [serviceName, modelName] = combo.split('/');
      const color = extendedColors[index % extendedColors.length];
      const label = combo === 'unknown/' + modelName ? modelName : combo;

      // Track cumulative sum and count for cumulative average
      let cumulativeSum = 0;
      let cumulativeCount = 0;
      let lastCumulativeAvg: number | null = null;

      // Build daily and cumulative data arrays
      const dailyData: (number | null)[] = [];
      const cumulativeData: (number | null)[] = [];

      ratingDates.forEach(date => {
        const entry = ratingDailyData.find(d => {
          const entryDate = typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10);
          return entryDate === date && d.modelName === modelName && (d.serviceName || 'unknown') === serviceName;
        });

        if (entry) {
          // Daily average for this date
          dailyData.push(entry.averageRating);
          // Update cumulative (weighted by count)
          cumulativeSum += entry.averageRating * entry.ratingCount;
          cumulativeCount += entry.ratingCount;
          lastCumulativeAvg = cumulativeSum / cumulativeCount;
          cumulativeData.push(lastCumulativeAvg);
        } else {
          // No data for this date
          dailyData.push(null);
          // Forward-fill cumulative average
          cumulativeData.push(lastCumulativeAvg);
        }
      });

      return [
        // Line: Cumulative average
        {
          type: 'line' as const,
          label: `${label} (누적)`,
          data: cumulativeData,
          borderColor: color.border,
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          yAxisID: 'y',
          order: 1, // Draw lines on top
        },
        // Bar: Daily average
        {
          type: 'bar' as const,
          label: `${label} (일별)`,
          data: dailyData,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1,
          yAxisID: 'y',
          order: 2, // Draw bars behind
        },
      ];
    }),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">전체 사용자</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalUsers)}</p>
              <p className="text-xs text-gray-400 mt-1">모든 서비스 합계</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <Users className="w-5 h-5 text-samsung-blue" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">일평균 활성 사용자</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(Math.round(avgDailyActive))}</p>
              <p className="text-xs text-gray-400 mt-1">최근 30일 평균</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">총 토큰 사용량</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalTokens)}</p>
              <p className="text-xs text-gray-400 mt-1">누적 합계</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-50">
              <TrendingUp className="w-5 h-5 text-violet-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">총 API 요청</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalRequests)}</p>
              <p className="text-xs text-gray-400 mt-1">누적 합계</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">서비스별 현황</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{services.length}개 서비스</span>
            {adminRole === 'SUPER_ADMIN' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-samsung-blue text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                서비스 추가
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mergedServiceStats.map((service) => (
            <Link
              key={service.serviceId}
              to={`/service/${service.serviceId}`}
              className={`block p-4 border rounded-xl hover:border-samsung-blue/30 hover:shadow-md transition-all duration-200 group ${
                service.hasData ? 'border-gray-100' : 'border-dashed border-gray-200 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {service.iconUrl ? (
                    <img src={service.iconUrl} alt={service.serviceDisplayName} className="w-10 h-10 rounded-lg" />
                  ) : (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      service.hasData ? 'bg-gradient-to-br from-samsung-blue to-blue-600' : 'bg-gray-300'
                    }`}>
                      <Server className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.serviceDisplayName}</h3>
                    <p className="text-xs text-gray-500">{service.serviceName}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-samsung-blue transition-colors" />
              </div>
              {service.hasData ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{formatNumber(service.totalUsers)}</p>
                    <p className="text-xs text-gray-500">사용자</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{formatNumber(Math.round(service.avgDailyActiveUsers))}</p>
                    <p className="text-xs text-gray-500">일평균</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{formatNumber(service.totalTokens)}</p>
                    <p className="text-xs text-gray-500">토큰</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-sm text-gray-400">
                  <p>아직 요청이 없습니다</p>
                  <p className="text-xs mt-1">LLM 모델을 등록하고 X-Service-Id 헤더로 요청하세요</p>
                </div>
              )}
            </Link>
          ))}
          {services.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              등록된 서비스가 없습니다.
              {adminRole === 'SUPER_ADMIN' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="ml-2 text-samsung-blue hover:underline"
                >
                  서비스 추가하기
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Service Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">새 서비스 등록</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateService} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  서비스 ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  placeholder="my-service (영문 소문자, 숫자, 하이픈)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">X-Service-Id 헤더에 사용할 ID</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  표시 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newService.displayName}
                  onChange={(e) => setNewService({ ...newService, displayName: e.target.value })}
                  placeholder="My Service"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  placeholder="서비스에 대한 간단한 설명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating || !newService.name || !newService.displayName}
                  className="px-4 py-2 bg-samsung-blue text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {creating ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Daily Usage Chart */}
      {serviceDaily.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">서비스별 일일 요청 추이</h2>
          <div className="h-80">
            <Line
              data={serviceChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value: string | number) => formatNumber(Number(value)),
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* 1. Department Users Chart (Cumulative Line + Active Bar) */}
      {deptUsersDailyData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-samsung-blue" />
            <h2 className="text-lg font-semibold text-gray-900">사업부별 사용자 추이</h2>
            <span className="text-xs text-gray-500">(최근 30일, Top 5 사업부 - 선: 누적, 막대: 일별 활성)</span>
          </div>
          <div className="h-72 mb-6">
            <Chart
              type="bar"
              data={deptUsersChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      usePointStyle: true,
                      padding: 10,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const value = context.parsed.y ?? 0;
                        return `${context.dataset.label}: ${value.toLocaleString()}명`;
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: '누적 사용자',
                    },
                    ticks: {
                      callback: (value: string | number) => formatNumber(Number(value)),
                    },
                  },
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: '일별 활성',
                    },
                    grid: {
                      drawOnChartArea: false,
                    },
                    ticks: {
                      callback: (value: string | number) => formatNumber(Number(value)),
                    },
                  },
                },
              }}
            />
          </div>
          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">사업부</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">누적 사용자</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">일평균 활성</th>
                </tr>
              </thead>
              <tbody>
                {deptUsersBUs.map((bu, index) => {
                  const lastData = deptUsersDailyData[deptUsersDailyData.length - 1];
                  const cumulative = lastData ? (lastData[`${bu}_cumulative`] as number) || 0 : 0;
                  const activeSum = deptUsersDailyData.reduce((sum, d) => sum + ((d[`${bu}_active`] as number) || 0), 0);
                  const avgActive = deptUsersDailyData.length > 0 ? activeSum / deptUsersDailyData.length : 0;
                  return (
                    <tr key={bu} className={index % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3 px-2 font-medium text-gray-900">{bu}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatNumber(cumulative)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{avgActive.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Department + Service API Requests Chart */}
      {deptServiceRequestsData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">사업부+서비스별 API 요청 추이</h2>
            <span className="text-xs text-gray-500">(최근 30일, Top 10 조합)</span>
          </div>
          <div className="h-72 mb-6">
            <Line
              data={deptServiceRequestsChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      usePointStyle: true,
                      padding: 10,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const value = context.parsed.y ?? 0;
                        if (value >= 1000000) return `${context.dataset.label}: ${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${context.dataset.label}: ${(value / 1000).toFixed(1)}K`;
                        return `${context.dataset.label}: ${value}`;
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value: string | number) => {
                        if (typeof value === 'number') {
                          if (value >= 1000000) return (value / 1000000).toFixed(0) + 'M';
                          if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                        }
                        return value;
                      },
                    },
                  },
                },
              }}
            />
          </div>
          {/* API Requests Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">사업부</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">서비스</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">총 요청수</th>
                </tr>
              </thead>
              <tbody>
                {deptServiceCombos.map((combo, index) => {
                  const [bu, service] = combo.split('/');
                  const lastData = deptServiceRequestsData[deptServiceRequestsData.length - 1];
                  const totalRequests = lastData ? (lastData[combo] as number) || 0 : 0;
                  return (
                    <tr key={combo} className={index % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3 px-2 font-medium text-gray-900">{bu}</td>
                      <td className="py-3 px-2 text-gray-700">{service}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatNumber(totalRequests)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Department Token Usage Stats */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-samsung-blue" />
          <h2 className="text-lg font-semibold text-gray-900">사업부별 토큰 사용량 추이</h2>
          <span className="text-xs text-gray-500">(최근 30일, Top 5 사업부)</span>
        </div>

        {deptDailyData.length > 0 ? (
          <>
            {/* Department Line Chart */}
            <div className="h-72 mb-6">
              <Line
                data={deptLineChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const value = context.parsed.y ?? 0;
                          if (value >= 1000000) return `${context.dataset.label}: ${(value / 1000000).toFixed(1)}M`;
                          if (value >= 1000) return `${context.dataset.label}: ${(value / 1000).toFixed(1)}K`;
                          return `${context.dataset.label}: ${value}`;
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value: string | number) => {
                          if (typeof value === 'number') {
                            if (value >= 1000000) return (value / 1000000).toFixed(0) + 'M';
                            if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                          }
                          return value;
                        },
                      },
                    },
                  },
                }}
              />
            </div>

            {/* Department Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">사업부</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">누적 사용자</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">일평균 활성</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">총 토큰</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">모델별 토큰</th>
                  </tr>
                </thead>
                <tbody>
                  {deptStats.slice(0, 15).map((dept, index) => (
                    <tr key={dept.deptname} className={index % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3 px-2 font-medium text-gray-900">{dept.deptname}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatNumber(dept.cumulativeUsers)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{dept.avgDailyActiveUsers.toFixed(1)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatNumber(dept.totalTokens)}</td>
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          {(dept.tokensByModel || []).slice(0, 3).map((model) => (
                            <span
                              key={model.modelName}
                              className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                            >
                              {model.modelName.length > 12 ? model.modelName.slice(0, 12) + '...' : model.modelName}: {formatNumber(model.tokens)}
                            </span>
                          ))}
                          {(dept.tokensByModel || []).length > 3 && (
                            <span className="text-xs text-gray-500">+{dept.tokensByModel.length - 3}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deptStats.length > 15 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  {deptStats.length - 15}개 사업부 더 있음
                </p>
              )}
            </div>
          </>
        ) : deptStats.length > 0 ? (
          /* Show table only if we have deptStats but no deptDailyData */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">사업부</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">누적 사용자</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">일평균 활성</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">총 토큰</th>
                </tr>
              </thead>
              <tbody>
                {deptStats.slice(0, 15).map((dept, index) => (
                  <tr key={dept.deptname} className={index % 2 === 0 ? 'bg-gray-50/50' : ''}>
                    <td className="py-3 px-2 font-medium text-gray-900">{dept.deptname}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{formatNumber(dept.cumulativeUsers)}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{dept.avgDailyActiveUsers.toFixed(1)}</td>
                    <td className="text-right py-3 px-2 text-gray-700">{formatNumber(dept.totalTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            사업부별 통계 데이터가 없습니다.
          </div>
        )}
      </div>

      {/* LLM Latency Chart - admin/viewer only */}
      {latencyKeys.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">LLM 응답 지연 시간</h2>
            <span className="text-xs text-gray-500">(최근 24시간, 10분 간격 평균)</span>
          </div>

          {/* Current Latency Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {latencyStats.slice(0, 4).map((stat) => (
              <div key={`${stat.serviceId}-${stat.modelId}`} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 truncate" title={`${stat.serviceName} / ${stat.modelName}`}>
                  {stat.serviceName} / {stat.modelName.length > 15 ? stat.modelName.slice(0, 15) + '...' : stat.modelName}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>
                    <span className="text-gray-400">10분:</span>
                    <span className="ml-1 font-medium">{stat.avg10m ? `${(stat.avg10m / 1000).toFixed(1)}s` : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">30분:</span>
                    <span className="ml-1 font-medium">{stat.avg30m ? `${(stat.avg30m / 1000).toFixed(1)}s` : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">1시간:</span>
                    <span className="ml-1 font-medium">{stat.avg1h ? `${(stat.avg1h / 1000).toFixed(1)}s` : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">24시간:</span>
                    <span className="ml-1 font-medium">{stat.avg24h ? `${(stat.avg24h / 1000).toFixed(1)}s` : '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Latency Line Chart */}
          <div className="h-72">
            <Line
              data={latencyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      usePointStyle: true,
                      padding: 10,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const value = context.parsed.y ?? 0;
                        return `${context.dataset.label}: ${(value / 1000).toFixed(2)}s`;
                      },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: '응답 시간 (ms)',
                    },
                    ticks: {
                      callback: (value: string | number) => {
                        const v = Number(value);
                        if (v >= 1000) return (v / 1000).toFixed(1) + 's';
                        return v + 'ms';
                      },
                    },
                  },
                },
              }}
            />
          </div>

          {/* Latency Stats Table */}
          {latencyStats.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">서비스 / 모델</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">10분 평균</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">30분 평균</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">1시간 평균</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">24시간 평균</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">요청수 (24h)</th>
                  </tr>
                </thead>
                <tbody>
                  {latencyStats.map((stat, index) => (
                    <tr key={`${stat.serviceId}-${stat.modelId}`} className={index % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3 px-2 font-medium text-gray-900">
                        {stat.serviceName} / {stat.modelName}
                      </td>
                      <td className="text-right py-3 px-2 text-gray-700">
                        {stat.avg10m ? `${(stat.avg10m / 1000).toFixed(2)}s` : '-'}
                        {stat.count10m > 0 && <span className="text-xs text-gray-400 ml-1">({stat.count10m})</span>}
                      </td>
                      <td className="text-right py-3 px-2 text-gray-700">
                        {stat.avg30m ? `${(stat.avg30m / 1000).toFixed(2)}s` : '-'}
                        {stat.count30m > 0 && <span className="text-xs text-gray-400 ml-1">({stat.count30m})</span>}
                      </td>
                      <td className="text-right py-3 px-2 text-gray-700">
                        {stat.avg1h ? `${(stat.avg1h / 1000).toFixed(2)}s` : '-'}
                        {stat.count1h > 0 && <span className="text-xs text-gray-400 ml-1">({stat.count1h})</span>}
                      </td>
                      <td className="text-right py-3 px-2 text-gray-700">
                        {stat.avg24h ? `${(stat.avg24h / 1000).toFixed(2)}s` : '-'}
                        {stat.count24h > 0 && <span className="text-xs text-gray-400 ml-1">({stat.count24h})</span>}
                      </td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatNumber(stat.count24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Model Ratings Chart */}
      {(ratingByModel.length > 0 || ratingDailyData.length > 0) && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900">모델 평점</h2>
            <span className="text-xs text-gray-500">(최근 30일)</span>
          </div>

          {/* Model Rating Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {ratingByModel.slice(0, 6).map((model, idx) => (
              <div key={`${model.serviceName}-${model.modelName}-${idx}`} className="p-3 bg-gray-50 rounded-lg text-center">
                {model.serviceName && (
                  <p className="text-[10px] text-gray-400 truncate mb-0.5">{model.serviceName}</p>
                )}
                <p className="text-xs text-gray-500 truncate mb-1" title={model.modelName}>
                  {model.modelName.length > 15 ? model.modelName.slice(0, 15) + '...' : model.modelName}
                </p>
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-lg font-bold text-gray-900">
                    {model.averageRating ? model.averageRating.toFixed(1) : '-'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{model.totalRatings}개 평가</p>
              </div>
            ))}
          </div>

          {/* Rating Mixed Chart (Line: cumulative, Bar: daily) */}
          {ratingDailyData.length > 0 && (
            <div className="h-72">
              <Chart
                type="bar"
                data={ratingChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: {
                        usePointStyle: true,
                        padding: 10,
                      },
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const value = context.parsed.y;
                          if (value === null) return `${context.dataset.label}: 데이터 없음`;
                          return `${context.dataset.label}: ${value.toFixed(2)}점`;
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      min: 1,
                      max: 5,
                      beginAtZero: false,
                      title: {
                        display: true,
                        text: '평균 평점',
                      },
                      ticks: {
                        stepSize: 1,
                      },
                    },
                  },
                }}
              />
            </div>
          )}

          {/* Rating Table */}
          {ratingByModel.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">서비스</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">모델</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">평균 평점</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">평가 수</th>
                  </tr>
                </thead>
                <tbody>
                  {ratingByModel.map((model, index) => (
                    <tr key={`${model.serviceName}-${model.modelName}-${index}`} className={index % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3 px-2 text-gray-600">{model.serviceName || '-'}</td>
                      <td className="py-3 px-2 font-medium text-gray-900">{model.modelName}</td>
                      <td className="text-right py-3 px-2 text-gray-700">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          {model.averageRating ? model.averageRating.toFixed(2) : '-'}
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatNumber(model.totalRatings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
