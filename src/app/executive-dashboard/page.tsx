'use client';

import BudgetVsActual from '@/components/analytics/BudgetVsActual';
import CustomReportBuilder from '@/components/analytics/CustomReportBuilder';
import TrendAnalysis from '@/components/analytics/TrendAnalysis';
import CashFlowChart from '@/components/charts/CashFlowChart';
import KPIDashboard from '@/components/charts/KPIDashboard';
import { PDFExporter } from '@/lib/export/pdf-exporter';
import { addMonths, format } from 'date-fns';
import { useState } from 'react';

export default function ExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'trends' | 'budget' | 'reports'
  >('overview');

  // Generate trend data
  const generateTrendData = () => {
    const data = [];
    const baseDate = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = addMonths(baseDate, -i);
      const baseValue = 200000;
      const growth = (12 - i) * 5000;
      const randomness = (Math.random() - 0.5) * 10000;

      data.push({
        period: format(date, 'MMM yyyy'),
        value: Math.round(baseValue + growth + randomness),
        previousYear: Math.round(baseValue + growth * 0.8 + randomness * 0.9),
      });
    }

    // Add forecast
    for (let i = 1; i <= 3; i++) {
      const date = addMonths(baseDate, i);
      const lastValue = data[data.length - 1].value;

      data.push({
        period: format(date, 'MMM yyyy'),
        value: Math.round(lastValue * 1.05),
        forecast: true,
      });
    }

    return data;
  };

  // Generate budget data
  const budgetData = [
    {
      category: 'Personal',
      budget: 150000,
      actual: 145000,
      variance: -5000,
      variancePercent: -3.3,
      status: 'under' as const,
    },
    {
      category: 'Marketing',
      budget: 50000,
      actual: 48000,
      variance: -2000,
      variancePercent: -4.0,
      status: 'under' as const,
    },
    {
      category: 'IT & Software',
      budget: 30000,
      actual: 32500,
      variance: 2500,
      variancePercent: 8.3,
      status: 'over' as const,
    },
    {
      category: 'Büro & Miete',
      budget: 25000,
      actual: 24800,
      variance: -200,
      variancePercent: -0.8,
      status: 'on-track' as const,
    },
    {
      category: 'Reisekosten',
      budget: 15000,
      actual: 18500,
      variance: 3500,
      variancePercent: 23.3,
      status: 'critical' as const,
    },
    {
      category: 'Fortbildung',
      budget: 10000,
      actual: 8200,
      variance: -1800,
      variancePercent: -18.0,
      status: 'under' as const,
    },
  ];

  // Generate cash flow data
  const generateCashFlowData = () => {
    const data = [];
    const baseDate = new Date();
    let balance = 450000;

    for (let i = 0; i < 12; i++) {
      const date = addMonths(baseDate, -11 + i);
      const inflow = 280000 + (Math.random() - 0.5) * 50000;
      const outflow = 220000 + (Math.random() - 0.5) * 40000;
      balance = balance + inflow - outflow;

      data.push({
        date: format(date, 'yyyy-MM-dd'),
        inflow: Math.round(inflow),
        outflow: Math.round(outflow),
        balance: Math.round(balance),
      });
    }

    return data;
  };

  const trendData = generateTrendData();
  const cashFlowData = generateCashFlowData();

  const handleExportPDF = async () => {
    if (activeTab === 'budget') {
      await PDFExporter.exportBudgetReport(budgetData);
    } else if (activeTab === 'trends') {
      await PDFExporter.exportFinancialReport(trendData);
    } else {
      await PDFExporter.exportExecutiveSummary({});
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Executive Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Umfassende Finanzübersicht für Entscheidungsträger
              </p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                🔄 Aktualisieren
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                📄 PDF Export
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                📊 Präsentieren
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-2">
          <div className="flex gap-2">
            {[
              { id: 'overview', label: 'Übersicht', icon: '📊' },
              { id: 'trends', label: 'Trends', icon: '📈' },
              { id: 'budget', label: 'Budget', icon: '🎯' },
              { id: 'reports', label: 'Berichte', icon: '📄' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="text-sm">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <p className="text-sm opacity-90 mb-2">Gesamtsaldo</p>
                <p className="text-3xl font-bold">€852k</p>
                <p className="text-sm opacity-75 mt-2">+12.5% MoM</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <p className="text-sm opacity-90 mb-2">Umsatz (YTD)</p>
                <p className="text-3xl font-bold">€2.4M</p>
                <p className="text-sm opacity-75 mt-2">+18.3% YoY</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                <p className="text-sm opacity-90 mb-2">Ausgaben (YTD)</p>
                <p className="text-3xl font-bold">€1.9M</p>
                <p className="text-sm opacity-75 mt-2">+8.7% YoY</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                <p className="text-sm opacity-90 mb-2">Nettogewinn</p>
                <p className="text-3xl font-bold">€485k</p>
                <p className="text-sm opacity-75 mt-2">20.2% Marge</p>
              </div>
            </div>

            {/* KPI Dashboard */}
            <KPIDashboard />

            {/* Cash Flow Overview */}
            <CashFlowChart
              data={cashFlowData}
              timeframe="12M"
              scenario="realistic"
            />
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-8">
            <TrendAnalysis
              data={trendData}
              title="Umsatzentwicklung"
              metric="revenue"
              showYoY={true}
              showForecast={true}
            />

            <TrendAnalysis
              data={trendData.map(d => ({
                ...d,
                value: d.value * 0.75,
                previousYear: d.previousYear
                  ? d.previousYear * 0.78
                  : undefined,
              }))}
              title="Kostenentwicklung"
              metric="expense"
              showYoY={true}
              showForecast={true}
            />
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-8">
            <BudgetVsActual
              data={budgetData}
              period="September 2025"
              showAlerts={true}
            />
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <CustomReportBuilder />
          </div>
        )}

        {/* Company Info Footer */}
        <div className="mt-12 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                V
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  VISIONEERS gGmbH
                </h3>
                <p className="text-sm text-gray-600">
                  Berlin, Germany • DE123456789
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Letztes Update: {new Date().toLocaleString('de-DE')}</p>
              <p className="text-xs text-gray-500 mt-1">
                Alle Daten sind in Echtzeit
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
