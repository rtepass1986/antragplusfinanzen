'use client';

import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

interface KPIMetric {
  id: string;
  label: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease';
  isPositive: boolean;
  format: 'currency' | 'percentage' | 'number';
  icon: string;
  color: 'green' | 'blue' | 'orange' | 'purple' | 'red';
  trend?: number[];
}

interface KPIDashboardProps {
  metrics?: KPIMetric[];
  timeframe?: string;
}

const defaultMetrics: KPIMetric[] = [
  {
    id: 'current-balance',
    label: 'Aktueller Saldo',
    value: 45280,
    change: 8.5,
    changeType: 'increase',
    isPositive: true,
    format: 'currency',
    icon: '💰',
    color: 'blue',
    trend: [38000, 39500, 41000, 42500, 44000, 45280],
  },
  {
    id: 'monthly-inflow',
    label: 'Einnahmen (Monat)',
    value: 28500,
    change: 12.3,
    changeType: 'increase',
    isPositive: true,
    format: 'currency',
    icon: '📈',
    color: 'green',
    trend: [22000, 23500, 25000, 26500, 27000, 28500],
  },
  {
    id: 'monthly-outflow',
    label: 'Ausgaben (Monat)',
    value: 22800,
    change: 5.2,
    changeType: 'increase',
    isPositive: false,
    format: 'currency',
    icon: '📉',
    color: 'red',
    trend: [20000, 20500, 21000, 21500, 22000, 22800],
  },
  {
    id: 'burn-rate',
    label: 'Burn Rate',
    value: 5700,
    change: 3.1,
    changeType: 'decrease',
    isPositive: true,
    format: 'currency',
    icon: '🔥',
    color: 'orange',
    trend: [6500, 6200, 6000, 5900, 5800, 5700],
  },
  {
    id: 'runway',
    label: 'Runway (Monate)',
    value: 7.9,
    change: 0.5,
    changeType: 'increase',
    isPositive: true,
    format: 'number',
    icon: '🛫',
    color: 'purple',
    trend: [6.5, 6.8, 7.1, 7.4, 7.6, 7.9],
  },
  {
    id: 'profit-margin',
    label: 'Gewinnmarge',
    value: 20,
    change: 2.5,
    changeType: 'increase',
    isPositive: true,
    format: 'percentage',
    icon: '📊',
    color: 'green',
    trend: [15, 16, 17, 18, 19, 20],
  },
];

export default function KPIDashboard({
  metrics = defaultMetrics,
  timeframe = 'Letzte 30 Tage',
}: KPIDashboardProps) {
  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return value.toFixed(1);
      default:
        return value.toString();
    }
  };

  const getColorClasses = (color: string) => {
    const colors = {
      green: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        trend: 'stroke-green-500',
      },
      blue: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        trend: 'stroke-blue-500',
      },
      orange: {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        trend: 'stroke-orange-500',
      },
      purple: {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        trend: 'stroke-purple-500',
      },
      red: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        trend: 'stroke-red-500',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  // Mini sparkline component
  const MiniSparkline = ({
    data,
    color,
  }: {
    data: number[];
    color: string;
  }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg
        className="w-full h-12"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <polyline
          points={points}
          fill="none"
          className={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Finanzielle Kennzahlen
          </h2>
          <p className="text-sm text-gray-500 mt-1">{timeframe}</p>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Exportieren
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map(metric => {
          const colorClasses = getColorClasses(metric.color);

          return (
            <div
              key={metric.id}
              className={`relative overflow-hidden bg-white rounded-lg border-2 ${colorClasses.border} p-6 hover:shadow-lg transition-shadow cursor-pointer group`}
            >
              {/* Icon Badge */}
              <div
                className={`absolute top-4 right-4 w-12 h-12 ${colorClasses.bg} rounded-full flex items-center justify-center text-2xl`}
              >
                {metric.icon}
              </div>

              {/* Content */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600 mb-2">
                  {metric.label}
                </p>
                <p className={`text-3xl font-bold ${colorClasses.text}`}>
                  {formatValue(metric.value, metric.format)}
                </p>
              </div>

              {/* Change Indicator */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`flex items-center gap-1 ${
                    metric.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {metric.changeType === 'increase' ? (
                    <ArrowTrendingUpIcon className="w-4 h-4" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-semibold">
                    {metric.change.toFixed(1)}%
                  </span>
                </div>
                <span className="text-sm text-gray-500">vs. letzter Monat</span>
              </div>

              {/* Mini Trend Chart */}
              {metric.trend && (
                <div className="opacity-30 group-hover:opacity-100 transition-opacity">
                  <MiniSparkline
                    data={metric.trend}
                    color={colorClasses.trend}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl">
            💡
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              KI-gestützte Einblicke
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <p className="text-sm text-gray-700">
                  <strong>Positiver Trend:</strong> Ihre Einnahmen sind um 12.3%
                  gestiegen - deutlich über dem Branchendurchschnitt von 8%.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">!</span>
                <p className="text-sm text-gray-700">
                  <strong>Achtung:</strong> Ihre Burn Rate steigt leicht.
                  Erwägen Sie, wiederkehrende Kosten zu optimieren.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">i</span>
                <p className="text-sm text-gray-700">
                  <strong>Prognose:</strong> Bei aktuellem Verlauf erreichen Sie
                  in 3 Monaten einen Saldo von €52,000.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Health Score */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Finanzielle Gesundheit
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <span className="text-3xl font-bold text-green-600">85/100</span>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Liquidität', score: 90, color: 'bg-green-500' },
            { label: 'Rentabilität', score: 80, color: 'bg-blue-500' },
            { label: 'Wachstum', score: 85, color: 'bg-purple-500' },
            { label: 'Stabilität', score: 88, color: 'bg-indigo-500' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{item.label}</span>
                <span className="text-gray-600">{item.score}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${item.color}`}
                  style={{ width: `${item.score}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
