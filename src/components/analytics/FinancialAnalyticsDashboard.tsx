'use client';

import {
  BalanceSheetData,
  FinancialAnalyticsEngine,
  FinancialMetrics,
  IncomeStatementData,
} from '@/lib/analytics/financial-analytics-engine';
import {
  EnhancedForecast,
  EnhancedForecastingEngine,
} from '@/lib/forecasting/enhanced-forecasting-engine';
import { useEffect, useState } from 'react';

interface FinancialAnalyticsDashboardProps {
  className?: string;
}

export default function FinancialAnalyticsDashboard({
  className = '',
}: FinancialAnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [forecast, setForecast] = useState<EnhancedForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'forecasting' | 'ratios' | 'working-capital' | 'variance'
  >('overview');

  const analyticsEngine = new FinancialAnalyticsEngine();
  const forecastingEngine = new EnhancedForecastingEngine();

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Mock data - in production, this would come from your API
      const mockBalanceSheet: BalanceSheetData = {
        currentAssets: {
          cash: 150000,
          accountsReceivable: 75000,
          inventory: 45000,
          other: 15000,
        },
        currentLiabilities: {
          accountsPayable: 60000,
          shortTermDebt: 25000,
          other: 10000,
        },
        totalAssets: 500000,
        totalLiabilities: 200000,
        equity: 300000,
      };

      const mockIncomeStatement: IncomeStatementData[] = [
        {
          revenue: 100000,
          costOfGoodsSold: 60000,
          operatingExpenses: 25000,
          netIncome: 15000,
          period: '2024-01',
        },
        {
          revenue: 120000,
          costOfGoodsSold: 72000,
          operatingExpenses: 28000,
          netIncome: 20000,
          period: '2024-02',
        },
        {
          revenue: 110000,
          costOfGoodsSold: 66000,
          operatingExpenses: 26000,
          netIncome: 18000,
          period: '2024-03',
        },
      ];

      const mockCashFlowData = [
        { date: '2024-01-01', amount: 15000 },
        { date: '2024-02-01', amount: 20000 },
        { date: '2024-03-01', amount: 18000 },
      ];

      const mockForecastData = [
        { date: '2024-04-01', amount: 22000 },
        { date: '2024-05-01', amount: 25000 },
        { date: '2024-06-01', amount: 23000 },
      ];

      // Calculate financial metrics
      const calculatedMetrics = await analyticsEngine.calculateFinancialMetrics(
        mockBalanceSheet,
        mockIncomeStatement,
        mockCashFlowData,
        mockForecastData
      );

      // Generate enhanced forecast
      const enhancedForecast = await forecastingEngine.generateEnhancedForecast(
        mockCashFlowData,
        12
      );

      setMetrics(calculatedMetrics);
      setForecast(enhancedForecast);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!metrics || !forecast) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Financial Analytics
            </h2>
            <p className="text-gray-600">
              Comprehensive financial analysis and forecasting
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => loadAnalytics()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'forecasting', label: 'Forecasting', icon: '🔮' },
              { id: 'ratios', label: 'Liquidity Ratios', icon: '💧' },
              { id: 'working-capital', label: 'Working Capital', icon: '⚙️' },
              { id: 'variance', label: 'Variance Analysis', icon: '📈' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab metrics={metrics} forecast={forecast} />
          )}
          {activeTab === 'forecasting' && (
            <ForecastingTab forecast={forecast} />
          )}
          {activeTab === 'ratios' && <RatiosTab metrics={metrics} />}
          {activeTab === 'working-capital' && (
            <WorkingCapitalTab metrics={metrics} />
          )}
          {activeTab === 'variance' && <VarianceTab metrics={metrics} />}
        </div>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  metrics,
  forecast,
}: {
  metrics: FinancialMetrics;
  forecast: EnhancedForecast;
}) {
  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Cash Runway</p>
              <p className="text-3xl font-bold">
                {metrics.cashRunway.months.toFixed(1)} months
              </p>
              <p className="text-blue-100 text-sm">
                {metrics.cashRunway.days.toFixed(0)} days
              </p>
            </div>
            <div className="text-4xl opacity-20">💰</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">
                Current Ratio
              </p>
              <p className="text-3xl font-bold">
                {metrics.liquidityRatios.currentRatio.toFixed(2)}
              </p>
              <p className="text-green-100 text-sm">Liquidity Health</p>
            </div>
            <div className="text-4xl opacity-20">💧</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">
                Working Capital
              </p>
              <p className="text-3xl font-bold">
                ${(metrics.workingCapital.current / 1000).toFixed(0)}k
              </p>
              <p className="text-purple-100 text-sm">
                Efficiency:{' '}
                {(metrics.workingCapital.efficiency * 100).toFixed(0)}%
              </p>
            </div>
            <div className="text-4xl opacity-20">⚙️</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">
                Cash Conversion
              </p>
              <p className="text-3xl font-bold">
                {metrics.cashConversionCycle.days.toFixed(0)} days
              </p>
              <p className="text-orange-100 text-sm capitalize">
                {metrics.cashConversionCycle.trend}
              </p>
            </div>
            <div className="text-4xl opacity-20">🔄</div>
          </div>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          12-Month Cash Flow Forecast
        </h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <p className="text-gray-600">
              Forecast visualization would go here
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Mean: ${(forecast.monteCarloResults.mean / 1000).toFixed(0)}k |
              Std Dev: $
              {(forecast.monteCarloResults.standardDeviation / 1000).toFixed(0)}
              k
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-4">
          AI Recommendations
        </h3>
        <div className="space-y-2">
          {forecast.recommendations.map((rec, index) => (
            <div key={index} className="flex items-start space-x-2">
              <span className="text-yellow-600 mt-1">•</span>
              <p className="text-yellow-700">{rec}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Forecasting Tab Component
function ForecastingTab({ forecast }: { forecast: EnhancedForecast }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monte Carlo Results */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Monte Carlo Analysis
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">5th Percentile</p>
                <p className="text-xl font-semibold">
                  $
                  {(forecast.monteCarloResults.percentiles.p5 / 1000).toFixed(
                    0
                  )}
                  k
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">95th Percentile</p>
                <p className="text-xl font-semibold">
                  $
                  {(forecast.monteCarloResults.percentiles.p95 / 1000).toFixed(
                    0
                  )}
                  k
                </p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Risk of Negative Cash Flow:</strong>{' '}
                {(
                  forecast.monteCarloResults.probabilityOfNegative * 100
                ).toFixed(1)}
                %
              </p>
            </div>
          </div>
        </div>

        {/* Accuracy Metrics */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Model Accuracy
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>MAPE</span>
                <span>{forecast.accuracy.mape.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, (100 - forecast.accuracy.mape) * 2)}%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>R² Score</span>
                <span>{forecast.accuracy.r2.toFixed(3)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${forecast.accuracy.r2 * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seasonal Patterns */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Seasonal Patterns
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {forecast.seasonalAdjustments.map((pattern, index) => (
            <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="font-semibold">{pattern.category}</p>
              <p className="text-2xl font-bold text-blue-600">
                {(pattern.pattern * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-gray-600">
                Confidence: {(pattern.confidence * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Ratios Tab Component
function RatiosTab({ metrics }: { metrics: FinancialMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Current Ratio
          </h3>
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600">
              {metrics.liquidityRatios.currentRatio.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Current Assets / Current Liabilities
            </p>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {metrics.liquidityRatios.interpretation}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Ratio
          </h3>
          <div className="text-center">
            <p className="text-4xl font-bold text-green-600">
              {metrics.liquidityRatios.quickRatio.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              (Cash + A/R) / Current Liabilities
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Cash Ratio
          </h3>
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-600">
              {metrics.liquidityRatios.cashRatio.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Cash / Current Liabilities
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Working Capital Tab Component
function WorkingCapitalTab({ metrics }: { metrics: FinancialMetrics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Working Capital Analysis
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Current Working Capital</p>
              <p className="text-2xl font-bold">
                ${(metrics.workingCapital.current / 1000).toFixed(0)}k
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Optimal Working Capital</p>
              <p className="text-2xl font-bold">
                ${(metrics.workingCapital.optimal / 1000).toFixed(0)}k
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Efficiency Ratio</p>
              <p className="text-2xl font-bold">
                {(metrics.workingCapital.efficiency * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recommendations
          </h3>
          <div className="space-y-2">
            {metrics.workingCapital.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-2">
                <span className="text-blue-600 mt-1">•</span>
                <p className="text-gray-700">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Variance Tab Component
function VarianceTab({ metrics }: { metrics: FinancialMetrics }) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Variance Analysis
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Forecast
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.varianceAnalysis.significantVariances.map(
                (variance, index) => (
                  <tr
                    key={index}
                    className={
                      variance.percentage > 0 ? 'bg-green-50' : 'bg-red-50'
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {variance.period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${(variance.actual / 1000).toFixed(0)}k
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${(variance.forecast / 1000).toFixed(0)}k
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        variance.variance > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      ${(variance.variance / 1000).toFixed(0)}k
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        variance.percentage > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {variance.percentage.toFixed(1)}%
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
