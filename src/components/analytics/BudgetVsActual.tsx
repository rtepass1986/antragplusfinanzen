'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BudgetItem {
  category: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'on-track' | 'over' | 'critical';
}

interface BudgetVsActualProps {
  data: BudgetItem[];
  totalBudget?: number;
  totalActual?: number;
  period?: string;
  showAlerts?: boolean;
}

export default function BudgetVsActual({
  data,
  totalBudget = 0,
  totalActual = 0,
  period = 'September 2025',
  showAlerts = true,
}: BudgetVsActualProps) {
  // Calculate totals if not provided
  const calculatedBudget =
    totalBudget || data.reduce((sum, item) => sum + item.budget, 0);
  const calculatedActual =
    totalActual || data.reduce((sum, item) => sum + item.actual, 0);
  const totalVariance = calculatedActual - calculatedBudget;
  const totalVariancePercent = (totalVariance / calculatedBudget) * 100;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'on-track':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'over':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'under':
        return 'Unter Budget ✓';
      case 'on-track':
        return 'Im Rahmen';
      case 'over':
        return 'Über Budget !';
      case 'critical':
        return 'Kritisch !!';
      default:
        return 'N/A';
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-3">
            {item.category}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-6">
              <span className="text-sm text-gray-600">Budget:</span>
              <span className="text-sm font-medium text-blue-600">
                {formatCurrency(item.budget)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-sm text-gray-600">Aktuell:</span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(item.actual)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6 pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-900">
                Abweichung:
              </span>
              <span
                className={`text-sm font-bold ${
                  item.variance < 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {item.variance > 0 ? '+' : ''}
                {formatCurrency(item.variance)}
                <span className="text-xs ml-1">
                  ({item.variancePercent > 0 ? '+' : ''}
                  {item.variancePercent.toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate alerts
  const criticalItems = data.filter(item => item.status === 'critical');
  const overBudgetItems = data.filter(item => item.status === 'over');
  const onTrackItems = data.filter(
    item => item.status === 'on-track' || item.status === 'under'
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Budget */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-blue-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Gesamtbudget</p>
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {formatCurrency(calculatedBudget)}
          </p>
          <p className="text-xs text-gray-500 mt-2">{period}</p>
        </div>

        {/* Total Actual */}
        <div
          className={`bg-white rounded-lg shadow-sm border-2 p-6 ${
            totalVariancePercent > 10
              ? 'border-red-200'
              : totalVariancePercent > 5
                ? 'border-orange-200'
                : 'border-green-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">
              Tatsächliche Kosten
            </p>
            <span className="text-2xl">💰</span>
          </div>
          <p
            className={`text-3xl font-bold ${
              totalVariancePercent > 10
                ? 'text-red-600'
                : totalVariancePercent > 5
                  ? 'text-orange-600'
                  : 'text-green-600'
            }`}
          >
            {formatCurrency(calculatedActual)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Ausgegeben</p>
        </div>

        {/* Variance */}
        <div
          className={`bg-white rounded-lg shadow-sm border-2 p-6 ${
            totalVariancePercent > 10
              ? 'border-red-200 bg-red-50'
              : totalVariancePercent > 5
                ? 'border-orange-200 bg-orange-50'
                : totalVariancePercent > -5
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-green-200 bg-green-50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Abweichung</p>
            <span className="text-2xl">
              {totalVariancePercent > 10
                ? '🚨'
                : totalVariancePercent > 5
                  ? '⚠️'
                  : totalVariancePercent > -5
                    ? '✓'
                    : '🎉'}
            </span>
          </div>
          <p
            className={`text-3xl font-bold ${
              totalVariance > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {totalVariance > 0 ? '+' : ''}
            {formatCurrency(totalVariance)}
          </p>
          <p
            className={`text-xs mt-2 font-medium ${
              totalVariancePercent > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {totalVariancePercent > 0 ? '+' : ''}
            {totalVariancePercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Alerts */}
      {showAlerts &&
        (criticalItems.length > 0 || overBudgetItems.length > 0) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ⚠️ Budgetwarnungen
            </h3>
            <div className="space-y-3">
              {criticalItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <span className="text-red-600 text-xl">🚨</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">
                      {item.category}
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      {formatCurrency(item.variance)} über Budget (
                      {item.variancePercent.toFixed(1)}%)
                    </p>
                  </div>
                  <button className="text-xs text-red-600 hover:text-red-800 font-medium">
                    Details →
                  </button>
                </div>
              ))}
              {overBudgetItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <span className="text-orange-600 text-xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-900">
                      {item.category}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      {formatCurrency(item.variance)} über Budget (
                      {item.variancePercent.toFixed(1)}%)
                    </p>
                  </div>
                  <button className="text-xs text-orange-600 hover:text-orange-800 font-medium">
                    Details →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Budget vs. Tatsächliche Kosten - Nach Kategorie
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="category"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
              stroke="#9CA3AF"
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12 }}
              stroke="#9CA3AF"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="budget"
              fill="#3B82F6"
              name="Budget"
              radius={[8, 8, 0, 0]}
            />
            <Bar
              dataKey="actual"
              fill="#10B981"
              name="Tatsächlich"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Kategorie
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                  Budget
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                  Tatsächlich
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                  Abweichung
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                  %
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    {item.category}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">
                    {formatCurrency(item.budget)}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                    {formatCurrency(item.actual)}
                  </td>
                  <td
                    className={`py-3 px-4 text-sm text-right font-medium ${
                      item.variance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {item.variance > 0 ? '+' : ''}
                    {formatCurrency(item.variance)}
                  </td>
                  <td
                    className={`py-3 px-4 text-sm text-right font-medium ${
                      item.variancePercent > 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {item.variancePercent > 0 ? '+' : ''}
                    {item.variancePercent.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                        item.status
                      )}`}
                    >
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td className="py-3 px-4 text-sm font-bold text-gray-900">
                  Gesamt
                </td>
                <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">
                  {formatCurrency(calculatedBudget)}
                </td>
                <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">
                  {formatCurrency(calculatedActual)}
                </td>
                <td
                  className={`py-3 px-4 text-sm text-right font-bold ${
                    totalVariance > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {totalVariance > 0 ? '+' : ''}
                  {formatCurrency(totalVariance)}
                </td>
                <td
                  className={`py-3 px-4 text-sm text-right font-bold ${
                    totalVariancePercent > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {totalVariancePercent > 0 ? '+' : ''}
                  {totalVariancePercent.toFixed(1)}%
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Budget Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Unter Budget</p>
          <p className="text-2xl font-bold text-green-600">
            {data.filter(item => item.status === 'under').length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Kategorien</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Im Rahmen</p>
          <p className="text-2xl font-bold text-blue-600">
            {data.filter(item => item.status === 'on-track').length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Kategorien</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Über Budget</p>
          <p className="text-2xl font-bold text-orange-600">
            {overBudgetItems.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Kategorien</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Kritisch</p>
          <p className="text-2xl font-bold text-red-600">
            {criticalItems.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Kategorien</p>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white text-2xl">
            📊
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Budget-Performance Analyse
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span
                  className={
                    totalVariancePercent < 0 ? 'text-green-600' : 'text-red-600'
                  }
                  className="mt-0.5"
                >
                  {totalVariancePercent < 0 ? '✓' : '!'}
                </span>
                <p className="text-sm text-gray-700">
                  <strong>Gesamtabweichung:</strong>{' '}
                  {totalVariancePercent < 0
                    ? `Sie liegen ${Math.abs(totalVariancePercent).toFixed(1)}% unter Budget - ausgezeichnet!`
                    : `Sie haben das Budget um ${totalVariancePercent.toFixed(1)}% überschritten.`}
                </p>
              </div>

              {criticalItems.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">🚨</span>
                  <p className="text-sm text-gray-700">
                    <strong>Kritische Kategorien:</strong>{' '}
                    {criticalItems.map(item => item.category).join(', ')}{' '}
                    benötigen sofortige Aufmerksamkeit.
                  </p>
                </div>
              )}

              {onTrackItems.length >= data.length * 0.7 && (
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">i</span>
                  <p className="text-sm text-gray-700">
                    <strong>Gute Kontrolle:</strong>{' '}
                    {((onTrackItems.length / data.length) * 100).toFixed(0)}%{' '}
                    Ihrer Kategorien sind im Budget-Rahmen.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
