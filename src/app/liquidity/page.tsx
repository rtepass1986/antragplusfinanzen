'use client';

import TransactionEntryForm from '@/components/data-entry/TransactionEntryForm';
import TopNavigation from '@/components/layout/TopNavigation';
import { invoiceStorage } from '@/lib/invoiceStorage';
import { useEffect, useState } from 'react';

interface FinancialData {
  month: string;
  liquidity: number;
  income: number;
  expenses: number;
  netChange: number;
  confidence?: number;
  scenario?: 'optimistic' | 'realistic' | 'pessimistic';
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
  lastUpdated: string;
  status: 'active' | 'inactive' | 'pending';
}

interface CashRunway {
  months: number;
  date: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
  timestamp: string;
}

export default function LiquidityPage() {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dateRange, setDateRange] = useState('12');
  const [projectFilter, setProjectFilter] = useState('Alle Projekte');
  const [scenario, setScenario] = useState('realistic');
  const [viewType, setViewType] = useState('Konsolidierte Ansicht');
  const [monthlyData, setMonthlyData] = useState<FinancialData[]>([]);
  const [currentLiquidity, setCurrentLiquidity] = useState(0);
  const [currentIncome, setCurrentIncome] = useState(0);
  const [currentExpenses, setCurrentExpenses] = useState(0);
  const [currentNetChange, setCurrentNetChange] = useState(0);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashRunway, setCashRunway] = useState<CashRunway | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [forecastData, setForecastData] = useState<FinancialData[]>([]);

  useEffect(() => {
    loadLiquidityData();
    loadBankAccounts();
    generateAlerts();
  }, [scenario, dateRange]);

  const loadLiquidityData = () => {
    setIsLoading(true);
    const invoices = invoiceStorage.getAllInvoices();
    const cashFlowData = invoiceStorage.getCashFlowData();

    // Generate monthly data from real invoice data
    const generatedData: FinancialData[] = cashFlowData.map((month, index) => {
      const previousMonth = index > 0 ? generatedData[index - 1] : null;
      const previousLiquidity = previousMonth
        ? previousMonth.liquidity
        : 100000; // Starting liquidity

      // Apply scenario adjustments
      const scenarioMultiplier = getScenarioMultiplier(scenario);
      const adjustedIncome = month.income * scenarioMultiplier;
      const adjustedExpenses =
        month.expenses *
        (scenario === 'pessimistic'
          ? 1.2
          : scenario === 'optimistic'
            ? 0.8
            : 1);

      return {
        month: month.month,
        liquidity: previousLiquidity + (adjustedIncome - adjustedExpenses),
        income: adjustedIncome,
        expenses: adjustedExpenses,
        netChange: adjustedIncome - adjustedExpenses,
        confidence: calculateConfidence(index, cashFlowData.length),
        scenario: scenario as 'optimistic' | 'realistic' | 'pessimistic',
      };
    });

    setMonthlyData(generatedData);

    // Generate forecast data
    generateForecastData(generatedData);

    // Set current month to most recent
    if (generatedData.length > 0) {
      const latest = generatedData[generatedData.length - 1];
      setSelectedMonth(latest.month);
      setCurrentLiquidity(latest.liquidity);
      setCurrentIncome(latest.income);
      setCurrentExpenses(latest.expenses);
      setCurrentNetChange(latest.netChange);
    }

    setIsLoading(false);
  };

  const generateForecastData = (historicalData: FinancialData[]) => {
    if (historicalData.length === 0) return;

    const forecast: FinancialData[] = [];
    const lastData = historicalData[historicalData.length - 1];
    const avgGrowth = calculateAverageGrowth(historicalData);
    const avgSeasonality = calculateSeasonality(historicalData);

    for (let i = 1; i <= 12; i++) {
      const forecastMonth = new Date(lastData.month + '-01');
      forecastMonth.setMonth(forecastMonth.getMonth() + i);
      const monthString = forecastMonth.toISOString().slice(0, 7);

      const seasonalFactor = avgSeasonality[forecastMonth.getMonth()] || 1;
      const growthFactor = Math.pow(1 + avgGrowth, i / 12);

      const forecastIncome = lastData.income * growthFactor * seasonalFactor;
      const forecastExpenses =
        lastData.expenses * growthFactor * seasonalFactor;
      const previousLiquidity =
        i === 1 ? lastData.liquidity : forecast[i - 2].liquidity;

      forecast.push({
        month: monthString,
        liquidity: previousLiquidity + (forecastIncome - forecastExpenses),
        income: forecastIncome,
        expenses: forecastExpenses,
        netChange: forecastIncome - forecastExpenses,
        confidence: Math.max(0.3, 1 - i * 0.05), // Decreasing confidence over time
        scenario: scenario as 'optimistic' | 'realistic' | 'pessimistic',
      });
    }

    setForecastData(forecast);
    calculateCashRunway(forecast);
  };

  const calculateAverageGrowth = (data: FinancialData[]) => {
    if (data.length < 2) return 0;
    const first = data[0];
    const last = data[data.length - 1];
    const months = data.length - 1;
    return Math.pow(last.income / first.income, 1 / months) - 1;
  };

  const calculateSeasonality = (data: FinancialData[]) => {
    const monthlyAverages = Array(12).fill(0);
    const monthlyCounts = Array(12).fill(0);

    data.forEach(item => {
      const month = new Date(item.month + '-01').getMonth();
      monthlyAverages[month] += item.income;
      monthlyCounts[month]++;
    });

    return monthlyAverages
      .map((sum, index) =>
        monthlyCounts[index] > 0 ? sum / monthlyCounts[index] : 1
      )
      .map(avg => avg / (monthlyAverages.reduce((a, b) => a + b, 0) / 12));
  };

  const calculateConfidence = (index: number, total: number) => {
    // Higher confidence for more recent data
    return Math.max(0.5, 1 - (total - index - 1) * 0.1);
  };

  const getScenarioMultiplier = (scenario: string) => {
    switch (scenario) {
      case 'optimistic':
        return 1.2;
      case 'pessimistic':
        return 0.8;
      default:
        return 1.0;
    }
  };

  const calculateCashRunway = (forecast: FinancialData[]) => {
    const currentLiquidity = forecast[0]?.liquidity || 0;
    let months = 0;
    let runningLiquidity = currentLiquidity;

    for (const month of forecast) {
      if (runningLiquidity <= 0) break;
      runningLiquidity += month.netChange;
      months++;
    }

    if (months > 0) {
      const runwayDate = new Date();
      runwayDate.setMonth(runwayDate.getMonth() + months);

      setCashRunway({
        months,
        date: runwayDate.toISOString().slice(0, 7),
        confidence: months > 6 ? 'high' : months > 3 ? 'medium' : 'low',
      });
    }
  };

  const loadBankAccounts = () => {
    // Mock bank accounts - in real app, this would come from API
    setBankAccounts([
      {
        id: '1',
        name: 'Geschäftskonto Haupt',
        balance: 45000,
        currency: 'EUR',
        lastUpdated: new Date().toISOString(),
        status: 'active',
      },
      {
        id: '2',
        name: 'Sparkonto',
        balance: 25000,
        currency: 'EUR',
        lastUpdated: new Date().toISOString(),
        status: 'active',
      },
    ]);
  };

  const generateAlerts = () => {
    const newAlerts: Alert[] = [];

    if (currentLiquidity < 10000) {
      newAlerts.push({
        id: 'low-liquidity',
        type: 'warning',
        message: 'Niedrige Liquidität: Weniger als €10.000 verfügbar',
        timestamp: new Date().toISOString(),
      });
    }

    if (cashRunway && cashRunway.months < 3) {
      newAlerts.push({
        id: 'short-runway',
        type: 'error',
        message: `Kritischer Cash Runway: Nur ${cashRunway.months} Monate verbleibend`,
        timestamp: new Date().toISOString(),
      });
    }

    if (currentNetChange < -5000) {
      newAlerts.push({
        id: 'negative-cashflow',
        type: 'warning',
        message: 'Negativer Cashflow: Ausgaben übersteigen Einnahmen erheblich',
        timestamp: new Date().toISOString(),
      });
    }

    setAlerts(newAlerts);
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
    if (confidence > 0.8) return 'text-green-600';
    if (confidence > 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRunwayColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-600 bg-green-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleTransactionSave = (transaction: any) => {
    // In a real app, this would save to database
    console.log('Transaction saved:', transaction);
    setShowTransactionForm(false);
    loadLiquidityData(); // Refresh data
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation activeTab="liquidity" />

      {/* Main Content */}
      <div className="p-6">
        {/* Header Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option>Alle Projekte</option>
              <option>Stationäre Jugendhilfe</option>
              <option>Nationale Projekte</option>
              <option>weltwärts</option>
            </select>

            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="6">Letzte 6 Monate</option>
              <option value="12">Letzte 12 Monate</option>
              <option value="24">Letzte 24 Monate</option>
            </select>

            <select
              value={scenario}
              onChange={e => setScenario(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="optimistic">Optimistisch</option>
              <option value="realistic">Realistisch</option>
              <option value="pessimistic">Pessimistisch</option>
            </select>

            <select
              value={viewType}
              onChange={e => setViewType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option>Konsolidierte Ansicht</option>
              <option>Einzelne Projekte</option>
              <option>Bankkonten</option>
            </select>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowTransactionForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              + Transaktion hinzufügen
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-md border-l-4 ${
                  alert.type === 'error'
                    ? 'bg-red-50 border-red-400 text-red-700'
                    : alert.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
                      : alert.type === 'success'
                        ? 'bg-green-50 border-green-400 text-green-700'
                        : 'bg-blue-50 border-blue-400 text-blue-700'
                }`}
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Current Liquidity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Aktuelle Liquidität
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(currentLiquidity)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Alle Konten</p>
              </div>
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Cash Runway */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Cash Runway
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {cashRunway ? `${cashRunway.months} Monate` : 'N/A'}
                </p>
                <p
                  className={`text-xs mt-1 px-2 py-1 rounded-full inline-block ${getRunwayColor(cashRunway?.confidence || 'low')}`}
                >
                  {cashRunway?.confidence === 'high'
                    ? 'Sicher'
                    : cashRunway?.confidence === 'medium'
                      ? 'Mittel'
                      : 'Kritisch'}
                </p>
              </div>
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Monthly Income */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Monatliche Einnahmen
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(currentIncome)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Aktueller Monat</p>
              </div>
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
            </div>
          </div>

          {/* Monthly Expenses */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Monatliche Ausgaben
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(currentExpenses)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Aktueller Monat</p>
              </div>
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
                    d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Accounts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Bankkonten
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bankAccounts.map(account => (
              <div
                key={account.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {account.name}
                    </h4>
                    <p className="text-sm text-gray-600">{account.currency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(account.lastUpdated).toLocaleDateString(
                        'de-DE'
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      account.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : account.status === 'inactive'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {account.status === 'active'
                      ? 'Aktiv'
                      : account.status === 'inactive'
                        ? 'Inaktiv'
                        : 'Ausstehend'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cash Flow Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Liquiditätsverlauf & Prognose
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
              {monthlyData.map((month, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {formatMonth(month.month)}
                    </h4>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-600">
                        Liquidität:{' '}
                        <span className="font-medium text-blue-600">
                          {formatCurrency(month.liquidity)}
                        </span>
                      </span>
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
                      className={`text-lg font-semibold ${getStatusColor(month.netChange)}`}
                    >
                      {month.netChange >= 0 ? '+' : ''}
                      {formatCurrency(month.netChange)}
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
                        Liquidität:{' '}
                        <span className="font-medium text-gray-700">
                          {formatCurrency(month.liquidity)}
                        </span>
                      </span>
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
                        className={`text-xs px-2 py-1 rounded-full ${
                          month.confidence && month.confidence > 0.8
                            ? 'bg-green-100 text-green-800'
                            : month.confidence && month.confidence > 0.6
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {month.confidence
                          ? `${Math.round(month.confidence * 100)}% Vertrauen`
                          : 'Niedrig'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${getStatusColor(month.netChange)}`}
                    >
                      {month.netChange >= 0 ? '+' : ''}
                      {formatCurrency(month.netChange)}
                    </p>
                    <p className="text-sm text-gray-500">Prognose</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction Entry Modal */}
        {showTransactionForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Transaktion hinzufügen
                  </h3>
                  <button
                    onClick={() => setShowTransactionForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <TransactionEntryForm
                  onSave={handleTransactionSave}
                  onCancel={() => setShowTransactionForm(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
