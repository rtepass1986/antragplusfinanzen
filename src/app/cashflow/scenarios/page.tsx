'use client';

import { useState } from 'react';

interface Scenario {
  id: string;
  name: string;
  description: string;
  type: 'main' | 'optimistic' | 'pessimistic' | 'custom';
  isActive: boolean;
  createdAt: string;
  lastModified: string;
  assumptions: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([
    {
      id: '1',
      name: 'Hauptszenario',
      description:
        'Basierend auf aktuellen Marktbedingungen und historischen Daten',
      type: 'main',
      isActive: true,
      createdAt: '2024-01-01',
      lastModified: '2024-01-15',
      assumptions: [
        'Stabile Einnahmen aus Jugendhilfe',
        'Moderate Kostensteigerungen',
        'Keine größeren Investitionen geplant',
      ],
      riskLevel: 'medium',
    },
    {
      id: '2',
      name: 'Optimistisches Szenario',
      description: 'Positive Marktentwicklung und erhöhte Förderung',
      type: 'optimistic',
      isActive: false,
      createdAt: '2024-01-01',
      lastModified: '2024-01-10',
      assumptions: [
        'Erhöhte Fördergelder',
        'Neue Projektverträge',
        'Kosteneinsparungen durch Effizienzsteigerungen',
      ],
      riskLevel: 'low',
    },
    {
      id: '3',
      name: 'Pessimistisches Szenario',
      description: 'Konservative Schätzung bei Marktunsicherheiten',
      type: 'pessimistic',
      isActive: false,
      createdAt: '2024-01-01',
      lastModified: '2024-01-12',
      assumptions: [
        'Reduzierte Fördergelder',
        'Kostensteigerungen bei Personalkosten',
        'Verzögerungen bei Projektzahlungen',
      ],
      riskLevel: 'high',
    },
  ]);

  const [newScenario, setNewScenario] = useState({
    name: '',
    description: '',
    type: 'custom' as 'main' | 'optimistic' | 'pessimistic' | 'custom',
    assumptions: [''],
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
  });

  const [showCreateForm, setShowCreateForm] = useState(false);

  const addScenario = () => {
    if (newScenario.name.trim() && newScenario.description.trim()) {
      const scenario: Scenario = {
        id: Date.now().toString(),
        name: newScenario.name.trim(),
        description: newScenario.description.trim(),
        type: newScenario.type,
        isActive: false,
        createdAt: new Date().toISOString().split('T')[0],
        lastModified: new Date().toISOString().split('T')[0],
        assumptions: newScenario.assumptions.filter(a => a.trim()),
        riskLevel: newScenario.riskLevel,
      };
      setScenarios([...scenarios, scenario]);
      setNewScenario({
        name: '',
        description: '',
        type: 'custom',
        assumptions: [''],
        riskLevel: 'medium',
      });
      setShowCreateForm(false);
    }
  };

  const activateScenario = (id: string) => {
    setScenarios(
      scenarios.map(scenario => ({
        ...scenario,
        isActive: scenario.id === id,
      }))
    );
  };

  const deleteScenario = (id: string) => {
    setScenarios(scenarios.filter(scenario => scenario.id !== id));
  };

  const addAssumption = () => {
    setNewScenario({
      ...newScenario,
      assumptions: [...newScenario.assumptions, ''],
    });
  };

  const updateAssumption = (index: number, value: string) => {
    const newAssumptions = [...newScenario.assumptions];
    newAssumptions[index] = value;
    setNewScenario({ ...newScenario, assumptions: newAssumptions });
  };

  const removeAssumption = (index: number) => {
    const newAssumptions = newScenario.assumptions.filter(
      (_, i) => i !== index
    );
    setNewScenario({ ...newScenario, assumptions: newAssumptions });
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'main':
        return '🎯';
      case 'optimistic':
        return '📈';
      case 'pessimistic':
        return '��';
      case 'custom':
        return '🔧';
      default:
        return '📊';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-3xl font-bold text-gray-900 font-display">
                  Szenarien-Management
                </h1>
                <p className="text-base text-gray-600 mt-1">
                  Cashflow-Prognosen und Szenarien verwalten
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center space-x-3 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <span className="text-lg">+</span>
                <span className="font-semibold">Neues Szenario</span>
              </button>
              <a
                href="/cashflow"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Zurück zum Cashflow
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Scenario Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 font-display">
            Aktives Szenario
          </h2>
          {scenarios.find(s => s.isActive) ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-3xl">
                  {getTypeIcon(scenarios.find(s => s.isActive)?.type || 'main')}
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-blue-900">
                    {scenarios.find(s => s.isActive)?.name}
                  </h3>
                  <p className="text-blue-700">
                    {scenarios.find(s => s.isActive)?.description}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Erstellt:</span>
                  <p className="text-blue-600">
                    {scenarios.find(s => s.isActive)?.createdAt}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-blue-700">
                    Zuletzt geändert:
                  </span>
                  <p className="text-blue-600">
                    {scenarios.find(s => s.isActive)?.lastModified}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-blue-700">
                    Risikolevel:
                  </span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(scenarios.find(s => s.isActive)?.riskLevel || 'medium')}`}
                  >
                    {scenarios.find(s => s.isActive)?.riskLevel === 'low'
                      ? 'Niedrig'
                      : scenarios.find(s => s.isActive)?.riskLevel === 'medium'
                        ? 'Mittel'
                        : 'Hoch'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <span className="text-4xl">📊</span>
              <p className="text-lg mt-2">Kein aktives Szenario ausgewählt</p>
            </div>
          )}
        </div>

        {/* Create New Scenario Form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 font-display">
              Neues Szenario erstellen
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Szenario-Name
                </label>
                <input
                  type="text"
                  value={newScenario.name}
                  onChange={e =>
                    setNewScenario({ ...newScenario, name: e.target.value })
                  }
                  placeholder="z.B. Neue Förderung 2025"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Typ
                </label>
                <select
                  value={newScenario.type}
                  onChange={e =>
                    setNewScenario({
                      ...newScenario,
                      type: e.target.value as
                        | 'main'
                        | 'optimistic'
                        | 'pessimistic'
                        | 'custom',
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="custom">Benutzerdefiniert</option>
                  <option value="optimistic">Optimistisch</option>
                  <option value="pessimistic">Pessimistisch</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beschreibung
              </label>
              <textarea
                value={newScenario.description}
                onChange={e =>
                  setNewScenario({
                    ...newScenario,
                    description: e.target.value,
                  })
                }
                placeholder="Beschreiben Sie die Annahmen und Bedingungen dieses Szenarios..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risikolevel
              </label>
              <select
                value={newScenario.riskLevel}
                onChange={e =>
                  setNewScenario({
                    ...newScenario,
                    riskLevel: e.target.value as 'low' | 'medium' | 'high',
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Annahmen & Bedingungen
                </label>
                <button
                  type="button"
                  onClick={addAssumption}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Annahme hinzufügen
                </button>
              </div>
              <div className="space-y-3">
                {newScenario.assumptions.map((assumption, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={assumption}
                      onChange={e => updateAssumption(index, e.target.value)}
                      placeholder="z.B. Erhöhte Fördergelder um 15%"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {newScenario.assumptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAssumption(index)}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={addScenario}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
              >
                Szenario erstellen
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl text-sm font-medium transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* All Scenarios */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 font-display">
            Alle Szenarien
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {scenarios.map(scenario => (
              <div
                key={scenario.id}
                className={`border rounded-xl p-6 ${
                  scenario.isActive
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {getTypeIcon(scenario.type)}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {scenario.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {scenario.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(scenario.riskLevel)}`}
                  >
                    {scenario.riskLevel === 'low'
                      ? 'Niedrig'
                      : scenario.riskLevel === 'medium'
                        ? 'Mittel'
                        : 'Hoch'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-xs text-gray-500">
                    Erstellt: {scenario.createdAt}
                  </p>
                  <p className="text-xs text-gray-500">
                    Geändert: {scenario.lastModified}
                  </p>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Annahmen:
                  </h4>
                  <ul className="space-y-1">
                    {scenario.assumptions.map((assumption, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-600 flex items-start"
                      >
                        <span className="text-gray-400 mr-2">•</span>
                        {assumption}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex space-x-3">
                  {!scenario.isActive && (
                    <button
                      onClick={() => activateScenario(scenario.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Aktivieren
                    </button>
                  )}
                  {scenario.isActive && (
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-lg text-sm font-medium">
                      Aktiv
                    </span>
                  )}
                  {scenario.type !== 'main' && (
                    <button
                      onClick={() => deleteScenario(scenario.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
