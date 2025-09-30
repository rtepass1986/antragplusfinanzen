'use client';

import { useState } from 'react';

export type Scenario = 'optimistic' | 'realistic' | 'pessimistic';

interface ScenarioData {
  id: Scenario;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  confidence: number;
}

interface ScenarioSelectorProps {
  selectedScenario: Scenario;
  onScenarioChange: (scenario: Scenario) => void;
  showComparison?: boolean;
}

const scenarios: ScenarioData[] = [
  {
    id: 'optimistic',
    name: 'Optimistisch',
    icon: '📈',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    description: 'Beste mögliche Entwicklung mit Wachstumspotenzial',
    confidence: 75,
  },
  {
    id: 'realistic',
    name: 'Realistisch',
    icon: '📊',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    description: 'Wahrscheinlichste Entwicklung basierend auf Trends',
    confidence: 90,
  },
  {
    id: 'pessimistic',
    name: 'Pessimistisch',
    icon: '📉',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    description: 'Vorsichtige Prognose mit Risikopuffer',
    confidence: 85,
  },
];

export default function ScenarioSelector({
  selectedScenario,
  onScenarioChange,
  showComparison = false,
}: ScenarioSelectorProps) {
  const [comparisonMode, setComparisonMode] = useState(showComparison);

  return (
    <div className="space-y-4">
      {/* Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map(scenario => {
          const isSelected = selectedScenario === scenario.id;

          return (
            <button
              key={scenario.id}
              onClick={() => onScenarioChange(scenario.id)}
              className={`
                relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                ${
                  isSelected
                    ? `${scenario.borderColor} ${scenario.bgColor} shadow-md scale-105`
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <span className="text-3xl">{scenario.icon}</span>
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-lg ${isSelected ? scenario.color : 'text-gray-900'}`}
                  >
                    {scenario.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {scenario.description}
                  </p>

                  {/* Confidence Score */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Konfidenz</span>
                      <span className="font-medium">
                        {scenario.confidence}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          scenario.id === 'optimistic'
                            ? 'bg-green-500'
                            : scenario.id === 'realistic'
                              ? 'bg-blue-500'
                              : 'bg-orange-500'
                        }`}
                        style={{ width: `${scenario.confidence}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Comparison Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <h4 className="text-sm font-medium text-gray-900">
            Szenario-Vergleich
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Zeige alle Szenarien gleichzeitig im Chart
          </p>
        </div>
        <button
          onClick={() => setComparisonMode(!comparisonMode)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${comparisonMode ? 'bg-blue-600' : 'bg-gray-300'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${comparisonMode ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* Quick Stats Comparison */}
      {comparisonMode && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Schnellvergleich - Nächste 6 Monate
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Metrik
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-green-700">
                    Optimistisch
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-blue-700">
                    Realistisch
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-orange-700">
                    Pessimistisch
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 px-3 text-gray-600">Gesamteinnahmen</td>
                  <td className="py-2 px-3 text-right font-medium text-green-700">
                    €250,000
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-blue-700">
                    €200,000
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-orange-700">
                    €150,000
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-600">Gesamtausgaben</td>
                  <td className="py-2 px-3 text-right font-medium text-green-700">
                    €180,000
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-blue-700">
                    €190,000
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-orange-700">
                    €195,000
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-900">
                    Endsaldo
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-green-700">
                    +€70,000
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-blue-700">
                    +€10,000
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-orange-700">
                    -€45,000
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-gray-600">Niedrigster Saldo</td>
                  <td className="py-2 px-3 text-right font-medium text-green-700">
                    €25,000
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-blue-700">
                    €5,000
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-orange-700">
                    -€15,000
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Risk Indicators */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-green-600">✓</span>
                <span className="text-xs font-medium text-green-700">
                  Beste Aussicht
                </span>
              </div>
              <p className="text-xs text-green-600">Wachstumschancen nutzen</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-600">i</span>
                <span className="text-xs font-medium text-blue-700">
                  Wahrscheinlich
                </span>
              </div>
              <p className="text-xs text-blue-600">Stabiler Verlauf erwartet</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-orange-600">!</span>
                <span className="text-xs font-medium text-orange-700">
                  Risiko
                </span>
              </div>
              <p className="text-xs text-orange-600">Liquidität überwachen</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
