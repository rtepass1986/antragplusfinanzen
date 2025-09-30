'use client';

import { useState } from 'react';

interface ReportWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'text';
  title: string;
  config: any;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  widgets: ReportWidget[];
  icon: string;
}

const availableWidgets = [
  {
    id: 'kpi-balance',
    type: 'kpi',
    title: 'Aktueller Saldo',
    icon: '💰',
    color: 'blue',
  },
  {
    id: 'kpi-revenue',
    type: 'kpi',
    title: 'Umsatz (Monat)',
    icon: '📈',
    color: 'green',
  },
  {
    id: 'kpi-expenses',
    type: 'kpi',
    title: 'Ausgaben (Monat)',
    icon: '📉',
    color: 'red',
  },
  {
    id: 'chart-cashflow',
    type: 'chart',
    title: 'Cash Flow Trend',
    icon: '📊',
    color: 'purple',
  },
  {
    id: 'chart-budget',
    type: 'chart',
    title: 'Budget vs. Actual',
    icon: '🎯',
    color: 'orange',
  },
  {
    id: 'table-transactions',
    type: 'table',
    title: 'Letzte Transaktionen',
    icon: '📋',
    color: 'gray',
  },
];

const reportTemplates: ReportTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'Übersicht für Management',
    icon: '👔',
    widgets: [],
  },
  {
    id: 'financial',
    name: 'Finanzbericht',
    description: 'Detaillierte Finanzanalyse',
    icon: '💰',
    widgets: [],
  },
  {
    id: 'monthly',
    name: 'Monatsbericht',
    description: 'Standard Monatsbericht',
    icon: '📅',
    widgets: [],
  },
  {
    id: 'custom',
    name: 'Benutzerdefiniert',
    description: 'Erstellen Sie Ihren eigenen Bericht',
    icon: '⚙️',
    widgets: [],
  },
];

export default function CustomReportBuilder() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [activeWidgets, setActiveWidgets] = useState<string[]>([]);
  const [reportName, setReportName] = useState('Neuer Bericht');
  const [dateRange, setDateRange] = useState('last-30-days');
  const [isBuilding, setIsBuilding] = useState(false);

  const handleWidgetToggle = (widgetId: string) => {
    setActiveWidgets(prev =>
      prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId]
    );
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);

    // Pre-populate widgets based on template
    if (templateId === 'executive') {
      setActiveWidgets(['kpi-balance', 'kpi-revenue', 'chart-cashflow']);
    } else if (templateId === 'financial') {
      setActiveWidgets([
        'kpi-balance',
        'kpi-revenue',
        'kpi-expenses',
        'chart-cashflow',
        'chart-budget',
        'table-transactions',
      ]);
    } else if (templateId === 'monthly') {
      setActiveWidgets(['kpi-revenue', 'kpi-expenses', 'chart-budget']);
    } else {
      setActiveWidgets([]);
    }
  };

  const generateReport = () => {
    setIsBuilding(true);
    // Simulate report generation
    setTimeout(() => {
      setIsBuilding(false);
      alert('Bericht generiert! (PDF-Export in Kürze verfügbar)');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          📊 Benutzerdefinierter Bericht
        </h2>
        <p className="text-sm text-gray-600">
          Erstellen Sie maßgeschneiderte Berichte mit Ihren gewünschten Metriken
          und Visualisierungen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Configuration */}
        <div className="lg:col-span-1 space-y-6">
          {/* Report Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Berichtseinstellungen
            </h3>

            <div className="space-y-4">
              {/* Report Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Berichtsname
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={e => setReportName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="z.B. Q3 2025 Finanzbericht"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zeitraum
                </label>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="last-7-days">Letzte 7 Tage</option>
                  <option value="last-30-days">Letzte 30 Tage</option>
                  <option value="last-90-days">Letzte 90 Tage</option>
                  <option value="last-6-months">Letzte 6 Monate</option>
                  <option value="last-12-months">Letzte 12 Monate</option>
                  <option value="ytd">Jahr bis heute</option>
                  <option value="custom">Benutzerdefiniert</option>
                </select>
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vorlage
                </label>
                <div className="space-y-2">
                  {reportTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selectedTemplate === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{template.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {template.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Widget Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Widgets hinzufügen
            </h3>
            <div className="space-y-2">
              {availableWidgets.map(widget => (
                <button
                  key={widget.id}
                  onClick={() => handleWidgetToggle(widget.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    activeWidgets.includes(widget.id)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{widget.icon}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {widget.title}
                      </span>
                    </div>
                    {activeWidgets.includes(widget.id) && (
                      <span className="text-green-600">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Berichtsvorschau
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {activeWidgets.length} Widget(s) ausgewählt
                </p>
              </div>
              <button
                onClick={generateReport}
                disabled={activeWidgets.length === 0 || isBuilding}
                className={`px-6 py-2 font-medium rounded-lg transition-colors ${
                  activeWidgets.length === 0 || isBuilding
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isBuilding ? '⏳ Wird erstellt...' : '📄 Bericht generieren'}
              </button>
            </div>

            {activeWidgets.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-gray-400 text-5xl mb-4">📊</div>
                <p className="text-gray-600 font-medium">
                  Keine Widgets ausgewählt
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Wählen Sie eine Vorlage oder fügen Sie Widgets hinzu
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Report Header */}
                <div className="border-b-2 border-gray-300 pb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {reportName}
                  </h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>
                      📅{' '}
                      {dateRange === 'last-7-days'
                        ? 'Letzte 7 Tage'
                        : dateRange === 'last-30-days'
                          ? 'Letzte 30 Tage'
                          : dateRange === 'last-90-days'
                            ? 'Letzte 90 Tage'
                            : dateRange === 'last-6-months'
                              ? 'Letzte 6 Monate'
                              : dateRange === 'last-12-months'
                                ? 'Letzte 12 Monate'
                                : dateRange === 'ytd'
                                  ? 'Jahr bis heute'
                                  : 'Benutzerdefiniert'}
                    </span>
                    <span>•</span>
                    <span>🏢 VISIONEERS gGmbH</span>
                    <span>•</span>
                    <span>📆 {new Date().toLocaleDateString('de-DE')}</span>
                  </div>
                </div>

                {/* Widget Preview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeWidgets.map((widgetId, index) => {
                    const widget = availableWidgets.find(
                      w => w.id === widgetId
                    );
                    if (!widget) return null;

                    return (
                      <div
                        key={widgetId}
                        className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors"
                      >
                        {/* Remove button */}
                        <button
                          onClick={() => handleWidgetToggle(widgetId)}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center text-red-600 text-xs font-bold"
                        >
                          ×
                        </button>

                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">{widget.icon}</span>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {widget.title}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {widget.type}
                            </p>
                          </div>
                        </div>

                        {/* Widget Content Preview */}
                        {widget.type === 'kpi' && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-3xl font-bold text-blue-600">
                              €45,280
                            </p>
                            <p className="text-sm text-green-600 mt-1">
                              +8.5% ↑
                            </p>
                          </div>
                        )}

                        {widget.type === 'chart' && (
                          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center h-32">
                            <div className="text-gray-400 text-sm">
                              📊 Chart Vorschau
                            </div>
                          </div>
                        )}

                        {widget.type === 'table' && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="space-y-2">
                              {[1, 2, 3].map(i => (
                                <div
                                  key={i}
                                  className="flex justify-between text-xs"
                                >
                                  <span className="text-gray-600">
                                    Transaktion {i}
                                  </span>
                                  <span className="font-medium">
                                    €{(Math.random() * 1000).toFixed(0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="border-t-2 border-gray-300 pt-4 mt-6">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Erstellt mit FinTech SaaS</span>
                    <span>Seite 1 von 1</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              💾 Speichern
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              📤 Teilen
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              🔄 Zurücksetzen
            </button>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Export-Optionen
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
            <span className="text-2xl">📄</span>
            <span className="text-sm font-medium text-red-700">PDF</span>
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
            <span className="text-2xl">📊</span>
            <span className="text-sm font-medium text-green-700">Excel</span>
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            <span className="text-2xl">📋</span>
            <span className="text-sm font-medium text-blue-700">CSV</span>
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
            <span className="text-2xl">🔗</span>
            <span className="text-sm font-medium text-purple-700">Link</span>
          </button>
        </div>
      </div>

      {/* Report Templates */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          💡 Tipps für effektive Berichte
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              Verwenden Sie <strong>Executive Summary</strong> für
              Management-Präsentationen
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              Der <strong>Finanzbericht</strong> eignet sich für detaillierte
              Analysen
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              Nutzen Sie <strong>Monatsberichte</strong> für regelmäßiges
              Reporting
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>
              Kombinieren Sie KPIs mit Charts für maximale Aussagekraft
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
