'use client';

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface TrendDataPoint {
  period: string;
  value: number;
  previousYear?: number;
  forecast?: boolean;
}

interface TrendMetrics {
  growthRate: number;
  volatility: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: 'high' | 'medium' | 'low' | 'none';
  forecast: {
    nextMonth: number;
    nextQuarter: number;
    nextYear: number;
    confidence: number;
  };
}

interface TrendAnalysisProps {
  data: TrendDataPoint[];
  title: string;
  metric: 'revenue' | 'expense' | 'profit' | 'balance';
  showYoY?: boolean;
  showForecast?: boolean;
}

export default function TrendAnalysis({
  data,
  title,
  metric,
  showYoY = true,
  showForecast = true,
}: TrendAnalysisProps) {
  // Calculate trend metrics
  const calculateMetrics = (): TrendMetrics => {
    const values = data.map(d => d.value);
    const n = values.length;

    // Growth rate (compound monthly growth)
    const growthRate = ((values[n - 1] - values[0]) / values[0]) * 100;

    // Volatility (standard deviation)
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const volatility = (Math.sqrt(variance) / mean) * 100;

    // Trend direction
    const recentTrend = values.slice(-3);
    const avgRecent =
      recentTrend.reduce((a, b) => a + b, 0) / recentTrend.length;
    const avgEarlier = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const trend =
      avgRecent > avgEarlier * 1.05
        ? 'increasing'
        : avgRecent < avgEarlier * 0.95
          ? 'decreasing'
          : 'stable';

    // Seasonality detection (simplified)
    const seasonality =
      volatility > 20
        ? 'high'
        : volatility > 10
          ? 'medium'
          : volatility > 5
            ? 'low'
            : 'none';

    // Forecast (simple linear regression)
    const lastValue = values[n - 1];
    const avgGrowth = growthRate / (n - 1);

    return {
      growthRate,
      volatility,
      trend,
      seasonality,
      forecast: {
        nextMonth: lastValue * (1 + avgGrowth / 100),
        nextQuarter: lastValue * Math.pow(1 + avgGrowth / 100, 3),
        nextYear: lastValue * Math.pow(1 + avgGrowth / 100, 12),
        confidence: Math.max(50, 95 - volatility * 2),
      },
    };
  };

  const metrics = calculateMetrics();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMetricColor = () => {
    switch (metric) {
      case 'revenue':
        return '#10B981';
      case 'expense':
        return '#EF4444';
      case 'profit':
        return '#3B82F6';
      case 'balance':
        return '#8B5CF6';
      default:
        return '#3B82F6';
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {payload[0].payload.period}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-600">Aktuell</span>
              <span
                className="text-sm font-bold"
                style={{ color: payload[0].color }}
              >
                {formatCurrency(payload[0].value)}
              </span>
            </div>
            {showYoY && payload[0].payload.previousYear && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600">Vorjahr</span>
                <span className="text-sm font-medium text-gray-500">
                  {formatCurrency(payload[0].payload.previousYear)}
                </span>
              </div>
            )}
            {payload[0].payload.forecast && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <span className="text-xs text-blue-600">📊 Prognose</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <div className="flex items-center gap-4 text-sm">
          <div
            className={`flex items-center gap-1 ${
              metrics.trend === 'increasing'
                ? 'text-green-600'
                : metrics.trend === 'decreasing'
                  ? 'text-red-600'
                  : 'text-gray-600'
            }`}
          >
            {metrics.trend === 'increasing' ? (
              <ArrowTrendingUpIcon className="w-5 h-5" />
            ) : metrics.trend === 'decreasing' ? (
              <ArrowTrendingDownIcon className="w-5 h-5" />
            ) : (
              <span className="w-5 h-5 flex items-center justify-center">
                →
              </span>
            )}
            <span className="font-medium">
              {metrics.trend === 'increasing' && 'Steigend'}
              {metrics.trend === 'decreasing' && 'Fallend'}
              {metrics.trend === 'stable' && 'Stabil'}
            </span>
          </div>
          <span className="text-gray-400">•</span>
          <span
            className={`font-medium ${
              metrics.growthRate > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {metrics.growthRate > 0 ? '+' : ''}
            {metrics.growthRate.toFixed(1)}% Wachstum
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-600">
            Volatilität: {metrics.volatility.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`color-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={getMetricColor()}
                stopOpacity={0.3}
              />
              <stop offset="95%" stopColor={getMetricColor()} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12 }}
            stroke="#9CA3AF"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* Current Year */}
          <Area
            type="monotone"
            dataKey="value"
            stroke={getMetricColor()}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#color-${metric})`}
            name="2025"
            strokeDasharray={data.some(d => d.forecast) ? '5 5' : ''}
          />

          {/* Previous Year (if YoY enabled) */}
          {showYoY && (
            <Line
              type="monotone"
              dataKey="previousYear"
              stroke="#9CA3AF"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="2024"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Metrics Grid */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Growth Rate */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Wachstumsrate</p>
          <p
            className={`text-xl font-bold ${
              metrics.growthRate > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {metrics.growthRate > 0 ? '+' : ''}
            {metrics.growthRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Gesamt</p>
        </div>

        {/* Volatility */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Volatilität</p>
          <p
            className={`text-xl font-bold ${
              metrics.volatility < 10
                ? 'text-green-600'
                : metrics.volatility < 20
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {metrics.volatility.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.seasonality === 'high' && 'Hoch saisonal'}
            {metrics.seasonality === 'medium' && 'Mäßig saisonal'}
            {metrics.seasonality === 'low' && 'Gering saisonal'}
            {metrics.seasonality === 'none' && 'Nicht saisonal'}
          </p>
        </div>

        {/* Next Month Forecast */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Prognose (1M)</p>
          <p className="text-xl font-bold text-blue-600">
            {formatCurrency(metrics.forecast.nextMonth)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.forecast.confidence.toFixed(0)}% Konfidenz
          </p>
        </div>

        {/* Year Forecast */}
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 mb-1">Prognose (12M)</p>
          <p className="text-xl font-bold text-purple-600">
            {formatCurrency(metrics.forecast.nextYear)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(
              ((metrics.forecast.nextYear - data[data.length - 1].value) /
                data[data.length - 1].value) *
              100
            ).toFixed(1)}
            % Änderung
          </p>
        </div>
      </div>

      {/* AI Insights */}
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-lg">🤖</span>
          KI-Analyse
        </h4>
        <div className="space-y-2 text-sm">
          {metrics.trend === 'increasing' && (
            <p className="text-gray-700">
              <strong className="text-green-600">Positiver Trend:</strong> Der
              Wert steigt kontinuierlich mit einer Rate von{' '}
              {metrics.growthRate.toFixed(1)}% über den analysierten Zeitraum.
            </p>
          )}
          {metrics.trend === 'decreasing' && (
            <p className="text-gray-700">
              <strong className="text-red-600">Negativer Trend:</strong> Der
              Wert fällt mit einer Rate von{' '}
              {Math.abs(metrics.growthRate).toFixed(1)}%. Gegenmaßnahmen
              empfohlen.
            </p>
          )}
          {metrics.trend === 'stable' && (
            <p className="text-gray-700">
              <strong className="text-blue-600">Stabiler Trend:</strong> Der
              Wert bleibt relativ konstant mit minimalen Schwankungen.
            </p>
          )}

          {metrics.seasonality !== 'none' && (
            <p className="text-gray-700">
              <strong className="text-orange-600">Saisonalität erkannt:</strong>{' '}
              {metrics.seasonality === 'high'
                ? 'Starke saisonale Muster'
                : metrics.seasonality === 'medium'
                  ? 'Mäßige saisonale Schwankungen'
                  : 'Leichte saisonale Effekte'}{' '}
              wurden identifiziert.
            </p>
          )}

          <p className="text-gray-700">
            <strong className="text-purple-600">Prognose:</strong> Für die
            nächsten 12 Monate wird ein Wert von{' '}
            {formatCurrency(metrics.forecast.nextYear)} erwartet (Konfidenz:{' '}
            {metrics.forecast.confidence.toFixed(0)}%).
          </p>
        </div>
      </div>
    </div>
  );
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
