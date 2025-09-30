'use client';

import CashFlowChart from '@/components/charts/CashFlowChart';
import DrillDownChart from '@/components/charts/DrillDownChart';
import KPIDashboard from '@/components/charts/KPIDashboard';
import ScenarioSelector, {
  Scenario,
} from '@/components/charts/ScenarioSelector';
import { addDays, format } from 'date-fns';
import { useEffect, useState } from 'react';

export default function LiquidityEnhancedPage() {
  const [selectedScenario, setSelectedScenario] =
    useState<Scenario>('realistic');
  const [timeframe, setTimeframe] = useState<
    '1M' | '3M' | '6M' | '12M' | '24M'
  >('6M');

  // Generate sample cash flow data
  const generateCashFlowData = (scenario: Scenario, months: number) => {
    const data = [];
    const baseDate = new Date();

    const scenarioMultipliers = {
      optimistic: { inflow: 1.2, outflow: 0.9, growth: 1.05 },
      realistic: { inflow: 1.0, outflow: 1.0, growth: 1.02 },
      pessimistic: { inflow: 0.8, outflow: 1.1, growth: 0.98 },
    };

    const multiplier = scenarioMultipliers[scenario];
    let currentBalance = 45280;

    for (let i = 0; i < months; i++) {
      const date = addDays(baseDate, i * 30);
      const baseInflow =
        28500 * multiplier.inflow * Math.pow(multiplier.growth, i / 12);
      const baseOutflow =
        22800 * multiplier.outflow * Math.pow(multiplier.growth, i / 12);

      // Add some randomness
      const inflow = baseInflow + (Math.random() - 0.5) * 5000;
      const outflow = baseOutflow + (Math.random() - 0.5) * 3000;
      const balance = currentBalance + inflow - outflow;

      currentBalance = balance;

      data.push({
        date: format(date, 'yyyy-MM-dd'),
        inflow: Math.round(inflow),
        outflow: Math.round(outflow),
        balance: Math.round(balance),
        forecast: i > 0,
      });
    }

    return data;
  };

  // Generate drill-down expense data
  const expenseCategories = [
    {
      name: 'Personal',
      value: 12500,
      color: '#3B82F6',
      subcategories: [
        {
          name: 'Gehälter',
          value: 10000,
          transactions: [
            {
              id: '1',
              description: 'Gehalt Mitarbeiter A',
              amount: 3500,
              date: '2025-09-01',
              vendor: 'Firma',
            },
            {
              id: '2',
              description: 'Gehalt Mitarbeiter B',
              amount: 3000,
              date: '2025-09-01',
              vendor: 'Firma',
            },
            {
              id: '3',
              description: 'Gehalt Mitarbeiter C',
              amount: 2500,
              date: '2025-09-01',
              vendor: 'Firma',
            },
            {
              id: '4',
              description: 'Werkstudent',
              amount: 1000,
              date: '2025-09-15',
              vendor: 'Firma',
            },
          ],
        },
        {
          name: 'Sozialabgaben',
          value: 2000,
          transactions: [
            {
              id: '5',
              description: 'Krankenversicherung',
              amount: 1200,
              date: '2025-09-05',
              vendor: 'TK',
            },
            {
              id: '6',
              description: 'Rentenversicherung',
              amount: 800,
              date: '2025-09-05',
              vendor: 'DRV',
            },
          ],
        },
        {
          name: 'Benefits',
          value: 500,
          transactions: [
            {
              id: '7',
              description: 'Fitness-Zuschuss',
              amount: 300,
              date: '2025-09-10',
              vendor: 'Gym',
            },
            {
              id: '8',
              description: 'Essenszuschuss',
              amount: 200,
              date: '2025-09-20',
              vendor: 'Restaurant',
            },
          ],
        },
      ],
    },
    {
      name: 'Büro & IT',
      value: 4200,
      color: '#10B981',
      subcategories: [
        {
          name: 'Software-Lizenzen',
          value: 2000,
          transactions: [
            {
              id: '9',
              description: 'Microsoft 365',
              amount: 500,
              date: '2025-09-01',
              vendor: 'Microsoft',
            },
            {
              id: '10',
              description: 'Adobe Creative Cloud',
              amount: 800,
              date: '2025-09-01',
              vendor: 'Adobe',
            },
            {
              id: '11',
              description: 'GitHub Enterprise',
              amount: 400,
              date: '2025-09-15',
              vendor: 'GitHub',
            },
            {
              id: '12',
              description: 'Zoom Pro',
              amount: 300,
              date: '2025-09-01',
              vendor: 'Zoom',
            },
          ],
        },
        {
          name: 'Hardware',
          value: 1500,
          transactions: [
            {
              id: '13',
              description: 'Laptop Dell',
              amount: 1200,
              date: '2025-09-10',
              vendor: 'Dell',
            },
            {
              id: '14',
              description: 'Maus & Tastatur',
              amount: 300,
              date: '2025-09-10',
              vendor: 'Logitech',
            },
          ],
        },
        {
          name: 'Büromiete',
          value: 700,
          transactions: [
            {
              id: '15',
              description: 'Miete September',
              amount: 700,
              date: '2025-09-01',
              vendor: 'Vermieter',
            },
          ],
        },
      ],
    },
    {
      name: 'Marketing',
      value: 3800,
      color: '#F59E0B',
      subcategories: [
        {
          name: 'Online Werbung',
          value: 2500,
          transactions: [
            {
              id: '16',
              description: 'Google Ads',
              amount: 1500,
              date: '2025-09-05',
              vendor: 'Google',
            },
            {
              id: '17',
              description: 'Facebook Ads',
              amount: 1000,
              date: '2025-09-05',
              vendor: 'Meta',
            },
          ],
        },
        {
          name: 'Content',
          value: 800,
          transactions: [
            {
              id: '18',
              description: 'Freelancer Texter',
              amount: 500,
              date: '2025-09-12',
              vendor: 'Upwork',
            },
            {
              id: '19',
              description: 'Stock Fotos',
              amount: 300,
              date: '2025-09-15',
              vendor: 'Shutterstock',
            },
          ],
        },
        {
          name: 'Events',
          value: 500,
          transactions: [
            {
              id: '20',
              description: 'Konferenz Ticket',
              amount: 500,
              date: '2025-09-20',
              vendor: 'Event GmbH',
            },
          ],
        },
      ],
    },
    {
      name: 'Reise',
      value: 1500,
      color: '#EF4444',
      subcategories: [
        {
          name: 'Flüge',
          value: 800,
          transactions: [
            {
              id: '21',
              description: 'Berlin-München',
              amount: 400,
              date: '2025-09-08',
              vendor: 'Lufthansa',
            },
            {
              id: '22',
              description: 'München-Berlin',
              amount: 400,
              date: '2025-09-22',
              vendor: 'Lufthansa',
            },
          ],
        },
        {
          name: 'Hotels',
          value: 500,
          transactions: [
            {
              id: '23',
              description: 'Hotel München 2 Nächte',
              amount: 500,
              date: '2025-09-08',
              vendor: 'Hilton',
            },
          ],
        },
        {
          name: 'Spesen',
          value: 200,
          transactions: [
            {
              id: '24',
              description: 'Essen & Trinken',
              amount: 200,
              date: '2025-09-09',
              vendor: 'Restaurant',
            },
          ],
        },
      ],
    },
    {
      name: 'Sonstiges',
      value: 800,
      color: '#8B5CF6',
      subcategories: [
        {
          name: 'Versicherungen',
          value: 400,
          transactions: [
            {
              id: '25',
              description: 'Betriebshaftpflicht',
              amount: 400,
              date: '2025-09-01',
              vendor: 'Allianz',
            },
          ],
        },
        {
          name: 'Beratung',
          value: 300,
          transactions: [
            {
              id: '26',
              description: 'Steuerberater',
              amount: 300,
              date: '2025-09-25',
              vendor: 'Steuer GmbH',
            },
          ],
        },
        {
          name: 'Sonstiges',
          value: 100,
          transactions: [
            {
              id: '27',
              description: 'Diverse Kleinausgaben',
              amount: 100,
              date: '2025-09-30',
              vendor: 'Verschiedene',
            },
          ],
        },
      ],
    },
  ];

  const [cashFlowData, setCashFlowData] = useState(
    generateCashFlowData(selectedScenario, 6)
  );

  useEffect(() => {
    const monthsMap = {
      '1M': 1,
      '3M': 3,
      '6M': 6,
      '12M': 12,
      '24M': 24,
    };
    setCashFlowData(
      generateCashFlowData(selectedScenario, monthsMap[timeframe])
    );
  }, [selectedScenario, timeframe]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Liquiditätsplanung
              </h1>
              <p className="text-gray-600 mt-2">
                Erweiterte Visualisierung mit KI-gestützter Analyse
              </p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Daten aktualisieren
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                Bericht erstellen
              </button>
            </div>
          </div>
        </div>

        {/* Scenario Selector */}
        <div className="mb-8">
          <ScenarioSelector
            selectedScenario={selectedScenario}
            onScenarioChange={setSelectedScenario}
            showComparison={true}
          />
        </div>

        {/* KPI Dashboard */}
        <div className="mb-8">
          <KPIDashboard timeframe="Letzte 30 Tage" />
        </div>

        {/* Cash Flow Chart */}
        <div className="mb-8">
          <CashFlowChart
            data={cashFlowData}
            timeframe={timeframe}
            onTimeframeChange={tf => setTimeframe(tf as any)}
            scenario={selectedScenario}
            showForecast={true}
          />
        </div>

        {/* Drill-Down Chart */}
        <div className="mb-8">
          <DrillDownChart
            data={expenseCategories}
            title="Ausgaben nach Kategorie"
            subtitle="Klicken Sie auf eine Kategorie für Details"
          />
        </div>

        {/* Additional Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cash Flow Projection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cash Flow Projektion
            </h3>
            <div className="space-y-4">
              {[
                { month: 'Oktober 2025', value: 48500, change: 7.1 },
                { month: 'November 2025', value: 51200, change: 5.6 },
                { month: 'Dezember 2025', value: 52800, change: 3.1 },
                { month: 'Januar 2026', value: 54100, change: 2.5 },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.month}
                    </p>
                    <p className="text-xs text-gray-500">Prognostiziert</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">
                      {new Intl.NumberFormat('de-DE', {
                        style: 'currency',
                        currency: 'EUR',
                        minimumFractionDigits: 0,
                      }).format(item.value)}
                    </p>
                    <p className="text-xs text-green-600">+{item.change}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Analysis */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Risikoanalyse
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Geringes Risiko
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Ihre Liquidität ist stabil und wächst kontinuierlich.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 text-sm">i</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Runway ausreichend
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    7.9 Monate Runway bei aktuellem Burn Rate.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 text-sm">!</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Optimierungspotenzial
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    IT-Kosten können um 15% reduziert werden.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
