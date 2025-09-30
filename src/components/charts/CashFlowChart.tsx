'use client';

import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CashFlowDataPoint {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
  forecast?: boolean;
}

interface CashFlowChartProps {
  data: CashFlowDataPoint[];
  timeframe?: '1M' | '3M' | '6M' | '12M' | '24M';
  onTimeframeChange?: (timeframe: string) => void;
  showForecast?: boolean;
  scenario?: 'optimistic' | 'realistic' | 'pessimistic';
  height?: number;
}

export default function CashFlowChart({
  data,
  timeframe = '6M',
  onTimeframeChange,
  showForecast = true,
  scenario = 'realistic',
  height = 400,
}: CashFlowChartProps) {
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('area');
  const [selectedMetric, setSelectedMetric] = useState<
    'all' | 'inflow' | 'outflow' | 'balance'
  >('all');

  const timeframes = ['1M', '3M', '6M', '12M', '24M'];

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = parseISO(label);
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {format(date, 'dd. MMMM yyyy', { locale: de })}
          </p>
          {payload.map((entry: any, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-sm" style={{ color: entry.color }}>
                {entry.name === 'inflow' && '💰 Einnahmen'}
                {entry.name === 'outflow' && '📤 Ausgaben'}
                {entry.name === 'balance' && '💵 Saldo'}
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: entry.color }}
              >
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    const xAxisProps = {
      dataKey: 'date',
      tickFormatter: (value: string) => {
        const date = parseISO(value);
        return format(date, 'dd.MM', { locale: de });
      },
      tick: { fontSize: 12 },
      stroke: '#9CA3AF',
    };

    const yAxisProps = {
      tickFormatter: formatCurrency,
      tick: { fontSize: 12 },
      stroke: '#9CA3AF',
    };

    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />

          {(selectedMetric === 'all' || selectedMetric === 'inflow') && (
            <Line
              type="monotone"
              dataKey="inflow"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ fill: '#10B981', r: 4 }}
              name="Einnahmen"
              activeDot={{ r: 6 }}
            />
          )}

          {(selectedMetric === 'all' || selectedMetric === 'outflow') && (
            <Line
              type="monotone"
              dataKey="outflow"
              stroke="#EF4444"
              strokeWidth={2}
              dot={{ fill: '#EF4444', r: 4 }}
              name="Ausgaben"
              activeDot={{ r: 6 }}
            />
          )}

          {(selectedMetric === 'all' || selectedMetric === 'balance') && (
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#3B82F6"
              strokeWidth={3}
              dot={{ fill: '#3B82F6', r: 4 }}
              name="Saldo"
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      );
    }

    if (chartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />

          {(selectedMetric === 'all' || selectedMetric === 'inflow') && (
            <Area
              type="monotone"
              dataKey="inflow"
              stroke="#10B981"
              fillOpacity={1}
              fill="url(#colorInflow)"
              name="Einnahmen"
            />
          )}

          {(selectedMetric === 'all' || selectedMetric === 'outflow') && (
            <Area
              type="monotone"
              dataKey="outflow"
              stroke="#EF4444"
              fillOpacity={1}
              fill="url(#colorOutflow)"
              name="Ausgaben"
            />
          )}

          {(selectedMetric === 'all' || selectedMetric === 'balance') && (
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#3B82F6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorBalance)"
              name="Saldo"
            />
          )}
        </AreaChart>
      );
    }

    // Bar chart
    return (
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />

        {(selectedMetric === 'all' || selectedMetric === 'inflow') && (
          <Bar dataKey="inflow" fill="#10B981" name="Einnahmen" />
        )}

        {(selectedMetric === 'all' || selectedMetric === 'outflow') && (
          <Bar dataKey="outflow" fill="#EF4444" name="Ausgaben" />
        )}

        {(selectedMetric === 'all' || selectedMetric === 'balance') && (
          <Bar dataKey="balance" fill="#3B82F6" name="Saldo" />
        )}
      </BarChart>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Cash Flow Übersicht
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {scenario === 'optimistic' && '📈 Optimistisches Szenario'}
            {scenario === 'realistic' && '📊 Realistisches Szenario'}
            {scenario === 'pessimistic' && '📉 Pessimistisches Szenario'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Chart Type Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['line', 'area', 'bar'] as const).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  chartType === type
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {type === 'line' && '📈'}
                {type === 'area' && '📊'}
                {type === 'bar' && '📊'}
              </button>
            ))}
          </div>

          {/* Timeframe Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {timeframes.map(tf => (
              <button
                key={tf}
                onClick={() => onTimeframeChange?.(tf)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeframe === tf
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Metric Selector */}
          <select
            value={selectedMetric}
            onChange={e => setSelectedMetric(e.target.value as any)}
            className="px-3 py-1.5 text-sm font-medium bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Metriken</option>
            <option value="inflow">Nur Einnahmen</option>
            <option value="outflow">Nur Ausgaben</option>
            <option value="balance">Nur Saldo</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>

      {/* Legend/Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <p className="text-sm font-medium text-gray-600">Einnahmen</p>
          </div>
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(
              data.reduce((sum, d) => sum + d.inflow, 0) / data.length
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">Durchschnitt</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <p className="text-sm font-medium text-gray-600">Ausgaben</p>
          </div>
          <p className="text-xl font-bold text-red-600">
            {formatCurrency(
              data.reduce((sum, d) => sum + d.outflow, 0) / data.length
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">Durchschnitt</p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <p className="text-sm font-medium text-gray-600">Saldo</p>
          </div>
          <p className="text-xl font-bold text-blue-600">
            {formatCurrency(data[data.length - 1]?.balance || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Aktuell</p>
        </div>
      </div>
    </div>
  );
}
