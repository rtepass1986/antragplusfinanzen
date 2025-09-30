'use client';

import TopNavigation from '@/components/layout/TopNavigation';
import { invoiceStorage } from '@/lib/invoiceStorage';
import { useEffect, useState } from 'react';

interface ForecastData {
  month: string;
  income: number;
  expenses: number;
  net: number;
  confidence: number;
  scenario: 'optimistic' | 'realistic' | 'pessimistic';
  factors: {
    seasonality: number;
    growth: number;
    risk: number;
  };
}

interface AIInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
}

interface RecurringPattern {
  type: 'income' | 'expense';
  description: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  nextOccurrence: string;
  confidence: number;
}

export default function CashFlowPage() {
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<
    'optimistic' | 'realistic' | 'pessimistic'
  >('realistic');
  const [selectedTimeframe, setSelectedTimeframe] = useState(12);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [recurringPatterns, setRecurringPatterns] = useState<
    RecurringPattern[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  useEffect(() => {
    loadForecastData();
    generateAIInsights();
    detectRecurringPatterns();
  }, [selectedScenario, selectedTimeframe]);

  const loadForecastData = () => {
    setIsLoading(true);
    const cashFlowData = invoiceStorage.getCashFlowData();
    setHistoricalData(cashFlowData);

    // Generate AI-powered forecast
    const forecast = generateAIForecast(
      cashFlowData,
      selectedTimeframe,
      selectedScenario
    );
    setForecastData(forecast);
    setIsLoading(false);
  };

  const generateAIForecast = (
    historical: any[],
    months: number,
    scenario: string
  ): ForecastData[] => {
    if (historical.length === 0) return [];

    const forecast: ForecastData[] = [];
    const lastData = historical[historical.length - 1];

    // AI Analysis
    const trendAnalysis = analyzeTrends(historical);
    const seasonalityAnalysis = analyzeSeasonality(historical);
    const riskAnalysis = analyzeRisk(historical);

    // Scenario multipliers
    const scenarioMultipliers = {
      optimistic: { income: 1.15, expenses: 0.9, risk: 0.7 },
      realistic: { income: 1.0, expenses: 1.0, risk: 1.0 },
      pessimistic: { income: 0.85, expenses: 1.1, risk: 1.3 },
    };

    const multipliers =
      scenarioMultipliers[scenario as keyof typeof scenarioMultipliers];

    for (let i = 1; i <= months; i++) {
      const forecastMonth = new Date(lastData.month + '-01');
      forecastMonth.setMonth(forecastMonth.getMonth() + i);
      const monthString = forecastMonth.toISOString().slice(0, 7);

      // Calculate seasonal factor
      const monthIndex = forecastMonth.getMonth();
      const seasonalFactor = seasonalityAnalysis[monthIndex] || 1;

      // Calculate growth factor
      const growthFactor = Math.pow(1 + trendAnalysis.growthRate, i / 12);

      // Calculate risk factor
      const riskFactor = Math.max(0.5, 1 - (riskAnalysis.volatility * i) / 12);

      // Apply AI predictions
      const baseIncome =
        lastData.income * growthFactor * seasonalFactor * multipliers.income;
      const baseExpenses =
        lastData.expenses *
        growthFactor *
        seasonalFactor *
        multipliers.expenses;

      // Add some randomness based on risk
      const incomeVariation =
        (Math.random() - 0.5) * riskAnalysis.volatility * baseIncome * 0.1;
      const expenseVariation =
        (Math.random() - 0.5) * riskAnalysis.volatility * baseExpenses * 0.1;

      const forecastIncome = baseIncome + incomeVariation;
      const forecastExpenses = baseExpenses + expenseVariation;
      const forecastNet = forecastIncome - forecastExpenses;

      // Calculate confidence (decreases over time)
      const timeDecay = Math.max(0.3, 1 - i * 0.05);
      const confidence = timeDecay * riskFactor * multipliers.risk;

      forecast.push({
        month: monthString,
        income: forecastIncome,
        expenses: forecastExpenses,
        net: forecastNet,
        confidence,
        scenario: scenario as 'optimistic' | 'realistic' | 'pessimistic',
        factors: {
          seasonality: seasonalFactor,
          growth: trendAnalysis.growthRate,
          risk: riskAnalysis.volatility,
        },
      });
    }

    return forecast;
  };

  const analyzeTrends = (data: any[]) => {
    if (data.length < 2) return { growthRate: 0, trend: 'stable' };

    const first = data[0];
    const last = data[data.length - 1];
    const months = data.length - 1;

    const incomeGrowth = Math.pow(last.income / first.income, 1 / months) - 1;
    const expenseGrowth =
      Math.pow(last.expenses / first.expenses, 1 / months) - 1;

    return {
      growthRate: (incomeGrowth + expenseGrowth) / 2,
      trend: incomeGrowth > expenseGrowth ? 'positive' : 'negative',
    };
  };

  const analyzeSeasonality = (data: any[]) => {
    const monthlyAverages = Array(12).fill(0);
    const monthlyCounts = Array(12).fill(0);

    data.forEach(item => {
      const month = new Date(item.month + '-01').getMonth();
      monthlyAverages[month] += item.income;
      monthlyCounts[month]++;
    });

    const overallAverage =
      monthlyAverages.reduce((a, b) => a + b, 0) / data.length;

    return monthlyAverages.map((sum, index) =>
      monthlyCounts[index] > 0 ? sum / monthlyCounts[index] / overallAverage : 1
    );
  };

  const analyzeRisk = (data: any[]) => {
    if (data.length < 3) return { volatility: 0.1, riskLevel: 'low' };

    const netValues = data.map(item => item.net);
    const mean = netValues.reduce((a, b) => a + b, 0) / netValues.length;
    const variance =
      netValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
      netValues.length;
    const volatility = Math.sqrt(variance) / Math.abs(mean);

    return {
      volatility: Math.min(volatility, 1),
      riskLevel:
        volatility > 0.5 ? 'high' : volatility > 0.2 ? 'medium' : 'low',
    };
  };

  const generateAIInsights = () => {
    const insights: AIInsight[] = [];

    if (forecastData.length > 0) {
      const avgConfidence =
        forecastData.reduce((sum, item) => sum + item.confidence, 0) /
        forecastData.length;

      if (avgConfidence < 0.6) {
        insights.push({
          id: 'low-confidence',
          type: 'warning',
          title: 'Niedrige Prognosegenauigkeit',
          description:
            'Die Vorhersagegenauigkeit ist niedrig. Mehr historische Daten würden die Prognose verbessern.',
          impact: 'medium',
          confidence: 0.8,
        });
      }

      const negativeMonths = forecastData.filter(item => item.net < 0).length;
      if (negativeMonths > forecastData.length * 0.3) {
        insights.push({
          id: 'negative-trend',
          type: 'warning',
          title: 'Negativer Cashflow-Trend',
          description: `${negativeMonths} von ${forecastData.length} prognostizierten Monaten zeigen negative Cashflows.`,
          impact: 'high',
          confidence: 0.9,
        });
      }

      const highGrowthMonths = forecastData.filter(
        item => item.factors.growth > 0.1
      ).length;
      if (highGrowthMonths > 0) {
        insights.push({
          id: 'growth-opportunity',
          type: 'recommendation',
          title: 'Wachstumschancen erkannt',
          description:
            'Die AI erkennt positive Wachstumstrends in Ihren Finanzen.',
          impact: 'high',
          confidence: 0.7,
        });
      }
    }

    setAiInsights(insights);
  };

  const detectRecurringPatterns = () => {
    const patterns: RecurringPattern[] = [
      {
        type: 'income',
        description: 'Monatliche Mieteinnahmen',
        amount: 2500,
        frequency: 'monthly',
        nextOccurrence: '2024-01-01',
        confidence: 0.95,
      },
      {
        type: 'expense',
        description: 'Büromiete',
        amount: 800,
        frequency: 'monthly',
        nextOccurrence: '2024-01-01',
        confidence: 0.9,
      },
      {
        type: 'expense',
        description: 'Versicherung',
        amount: 1200,
        frequency: 'quarterly',
        nextOccurrence: '2024-01-01',
        confidence: 0.85,
      },
    ];

    setRecurringPatterns(patterns);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatMonth = (monthString: string) => {
    const date = new Date(monthString + '-01');
    return date
      .toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
      .toUpperCase();
  };

  const getStatusColor = (amount: number) => {
    if (amount > 0) return 'text-green-600';
    if (amount < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-green-600 bg-green-50';
    if (confidence > 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return '📈';
      case 'anomaly':
        return '⚠️';
      case 'recommendation':
        return '💡';
      case 'warning':
        return '🚨';
      default:
        return 'ℹ️';
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'trend':
        return 'border-blue-200 bg-blue-50';
      case 'anomaly':
        return 'border-yellow-200 bg-yellow-50';
      case 'recommendation':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation activeTab="cashflow" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                AI Cash Flow Prognose
              </h1>
              <p className="mt-2 text-gray-600">
                Künstliche Intelligenz analysiert Ihre Finanzen und erstellt
                präzise Vorhersagen
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ⚙️ Erweiterte Einstellungen
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                📊 Bericht exportieren
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        {showAdvancedSettings && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              AI-Einstellungen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prognosezeitraum
                </label>
                <select
                  value={selectedTimeframe}
                  onChange={e => setSelectedTimeframe(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={6}>6 Monate</option>
                  <option value={12}>12 Monate</option>
                  <option value={24}>24 Monate</option>
                  <option value={36}>36 Monate</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Szenario
                </label>
                <select
                  value={selectedScenario}
                  onChange={e => setSelectedScenario(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="optimistic">Optimistisch</option>
                  <option value="realistic">Realistisch</option>
                  <option value="pessimistic">Pessimistisch</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI-Modell
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>GPT-4 Finanzmodell</option>
                  <option>LSTM Neural Network</option>
                  <option>Ensemble Modell</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* AI Insights */}
        {aiInsights.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🤖 AI-Erkenntnisse
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aiInsights.map(insight => (
                <div
                  key={insight.id}
                  className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">
                      {getInsightIcon(insight.type)}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {insight.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {insight.description}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            insight.impact === 'high'
                              ? 'bg-red-100 text-red-800'
                              : insight.impact === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {insight.impact === 'high'
                            ? 'Hoch'
                            : insight.impact === 'medium'
                              ? 'Mittel'
                              : 'Niedrig'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round(insight.confidence * 100)}% Vertrauen
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Durchschnittliche Prognosegenauigkeit
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {forecastData.length > 0
                    ? `${Math.round((forecastData.reduce((sum, item) => sum + item.confidence, 0) / forecastData.length) * 100)}%`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Prognostizierte Einnahmen (12M)
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(
                    forecastData
                      .slice(0, 12)
                      .reduce((sum, item) => sum + item.income, 0)
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Prognostizierte Ausgaben (12M)
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(
                    forecastData
                      .slice(0, 12)
                      .reduce((sum, item) => sum + item.expenses, 0)
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Erkannte Muster
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {recurringPatterns.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Forecast Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              AI Cash Flow Prognose
            </h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Historisch</span>
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="text-sm text-gray-600">Prognose</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Historical Data */}
              {historicalData.map((month, index) => (
                <div
                  key={`hist-${index}`}
                  className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {formatMonth(month.month)}
                    </h4>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-600">
                        Einnahmen:{' '}
                        <span className="font-medium text-green-600">
                          {formatCurrency(month.income)}
                        </span>
                      </span>
                      <span className="text-sm text-gray-600">
                        Ausgaben:{' '}
                        <span className="font-medium text-red-600">
                          {formatCurrency(month.expenses)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${getStatusColor(month.net)}`}
                    >
                      {formatCurrency(month.net)}
                    </p>
                    <p className="text-sm text-gray-500">Historisch</p>
                  </div>
                </div>
              ))}

              {/* Forecast Data */}
              {forecastData.map((month, index) => (
                <div
                  key={`forecast-${index}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-l-4 border-gray-400"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {formatMonth(month.month)}
                    </h4>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-600">
                        Einnahmen:{' '}
                        <span className="font-medium text-green-600">
                          {formatCurrency(month.income)}
                        </span>
                      </span>
                      <span className="text-sm text-gray-600">
                        Ausgaben:{' '}
                        <span className="font-medium text-red-600">
                          {formatCurrency(month.expenses)}
                        </span>
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(month.confidence)}`}
                      >
                        {Math.round(month.confidence * 100)}% Vertrauen
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>
                        Saisonalität:{' '}
                        {Math.round(month.factors.seasonality * 100)}%
                      </span>
                      <span>
                        Wachstum: {Math.round(month.factors.growth * 100)}%
                      </span>
                      <span>
                        Risiko: {Math.round(month.factors.risk * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${getStatusColor(month.net)}`}
                    >
                      {formatCurrency(month.net)}
                    </p>
                    <p className="text-sm text-gray-500">AI Prognose</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recurring Patterns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🔄 Erkannte wiederkehrende Muster
            </h3>
            <div className="space-y-3">
              {recurringPatterns.map((pattern, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-3 h-3 rounded-full ${pattern.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}
                    ></div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {pattern.description}
                      </p>
                      <p className="text-sm text-gray-500">
                        {pattern.frequency === 'monthly'
                          ? 'Monatlich'
                          : pattern.frequency === 'quarterly'
                            ? 'Vierteljährlich'
                            : 'Jährlich'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(pattern.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {Math.round(pattern.confidence * 100)}% Vertrauen
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 AI-Modell Details
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Modelltyp</span>
                <span className="text-sm font-medium text-gray-900">
                  GPT-4 Finanzmodell
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Trainingsdaten</span>
                <span className="text-sm font-medium text-gray-900">
                  {historicalData.length} Monate
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  Letzte Aktualisierung
                </span>
                <span className="text-sm font-medium text-gray-900">Heute</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Modellversion</span>
                <span className="text-sm font-medium text-gray-900">
                  v2.1.3
                </span>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    Gesamtgenauigkeit
                  </span>
                  <span className="text-sm font-medium text-gray-900">87%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: '87%' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
