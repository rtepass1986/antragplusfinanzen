'use client';

import { useState } from 'react';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  parentCategory?: string;
  isActive: boolean;
  color: string;
}

interface KPI {
  id: string;
  name: string;
  description: string;
  formula: string;
  target: number;
  unit: string;
  isActive: boolean;
}

export default function CashFlowSettingsPage() {
  const [activeTab, setActiveTab] = useState('categories');
  const [categories, setCategories] = useState<Category[]>([
    {
      id: '1',
      name: 'Stationäre Jugendhilfe',
      type: 'income',
      isActive: true,
      color: 'bg-blue-500',
    },
    {
      id: '2',
      name: 'Nationale Projekte',
      type: 'income',
      isActive: true,
      color: 'bg-green-500',
    },
    {
      id: '3',
      name: 'weltwärts, ESK Freiwilligendienst, IJFD',
      type: 'income',
      isActive: true,
      color: 'bg-purple-500',
    },
    {
      id: '4',
      name: 'Freie Spenden',
      type: 'income',
      isActive: true,
      color: 'bg-yellow-500',
    },
    {
      id: '5',
      name: 'Kredite',
      type: 'income',
      isActive: true,
      color: 'bg-indigo-500',
    },
    {
      id: '6',
      name: 'Personalkosten',
      type: 'expense',
      isActive: true,
      color: 'bg-red-500',
    },
    {
      id: '7',
      name: 'Wertpapierdepot',
      type: 'expense',
      isActive: true,
      color: 'bg-pink-500',
    },
    {
      id: '8',
      name: 'Rücklagen',
      type: 'expense',
      isActive: true,
      color: 'bg-orange-500',
    },
  ]);

  const [kpis, setKPIs] = useState<KPI[]>([
    {
      id: '1',
      name: 'Liquiditätsquote',
      description:
        'Verhältnis von liquiden Mitteln zu kurzfristigen Verbindlichkeiten',
      formula: 'Liquide Mittel / Kurzfristige Verbindlichkeiten',
      target: 1.5,
      unit: '',
      isActive: true,
    },
    {
      id: '2',
      name: 'Cash Flow Coverage',
      description:
        'Verhältnis von operativem Cash Flow zu Gesamtverbindlichkeiten',
      formula: 'Operativer CF / Gesamtverbindlichkeiten',
      target: 0.25,
      unit: '',
      isActive: true,
    },
    {
      id: '3',
      name: 'Working Capital',
      description: 'Umlaufvermögen abzüglich kurzfristiger Verbindlichkeiten',
      formula: 'Umlaufvermögen - Kurzfristige Verbindlichkeiten',
      target: 500000,
      unit: 'EUR',
      isActive: true,
    },
  ]);

  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'income' as 'income' | 'expense',
    color: 'bg-blue-500',
  });
  const [newKPI, setNewKPI] = useState({
    name: '',
    description: '',
    formula: '',
    target: 0,
    unit: '',
  });

  const addCategory = () => {
    if (newCategory.name.trim()) {
      const category: Category = {
        id: Date.now().toString(),
        name: newCategory.name.trim(),
        type: newCategory.type,
        isActive: true,
        color: newCategory.color,
      };
      setCategories([...categories, category]);
      setNewCategory({ name: '', type: 'income', color: 'bg-blue-500' });
    }
  };

  const addKPI = () => {
    if (newKPI.name.trim() && newKPI.formula.trim()) {
      const kpi: KPI = {
        id: Date.now().toString(),
        name: newKPI.name.trim(),
        description: newKPI.description.trim(),
        formula: newKPI.formula.trim(),
        target: newKPI.target,
        unit: newKPI.unit.trim(),
        isActive: true,
      };
      setKPIs([...kpis, kpi]);
      setNewKPI({
        name: '',
        description: '',
        formula: '',
        target: 0,
        unit: '',
      });
    }
  };

  const toggleCategoryStatus = (id: string) => {
    setCategories(
      categories.map(cat =>
        cat.id === id ? { ...cat, isActive: !cat.isActive } : cat
      )
    );
  };

  const toggleKPIStatus = (id: string) => {
    setKPIs(
      kpis.map(kpi =>
        kpi.id === id ? { ...kpi, isActive: !kpi.isActive } : kpi
      )
    );
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter(cat => cat.id !== id));
  };

  const deleteKPI = (id: string) => {
    setKPIs(kpis.filter(kpi => kpi.id !== id));
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
                  <span className="text-white font-bold text-xl">⚙️</span>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-3xl font-bold text-gray-900 font-display">
                  Cashflow Einstellungen
                </h1>
                <p className="text-base text-gray-600 mt-1">
                  Kategorien, KPIs und Konfigurationen verwalten
                </p>
              </div>
            </div>
            <a
              href="/cashflow"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Zurück zum Cashflow
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Settings Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-8" aria-label="Tabs">
              {[
                { id: 'categories', name: 'Kategorien', icon: '🏷️' },
                { id: 'kpis', name: 'KPI-Einstellungen', icon: '📊' },
                { id: 'import', name: 'Bankanbindung', icon: '🏦' },
                { id: 'notifications', name: 'Benachrichtigungen', icon: '🔔' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-6 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-8">
            {/* Categories Tab */}
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Einnahmen- und Ausgabenkategorien
                  </h3>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                    + Neue Kategorie
                  </button>
                </div>

                {/* Add New Category Form */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Neue Kategorie hinzufügen
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={e =>
                        setNewCategory({ ...newCategory, name: e.target.value })
                      }
                      placeholder="Kategoriename"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select
                      value={newCategory.type}
                      onChange={e =>
                        setNewCategory({
                          ...newCategory,
                          type: e.target.value as 'income' | 'expense',
                        })
                      }
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="income">Einnahme</option>
                      <option value="expense">Ausgabe</option>
                    </select>
                    <select
                      value={newCategory.color}
                      onChange={e =>
                        setNewCategory({
                          ...newCategory,
                          color: e.target.value,
                        })
                      }
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="bg-blue-500">Blau</option>
                      <option value="bg-green-500">Grün</option>
                      <option value="bg-purple-500">Lila</option>
                      <option value="bg-yellow-500">Gelb</option>
                      <option value="bg-red-500">Rot</option>
                      <option value="bg-pink-500">Pink</option>
                      <option value="bg-orange-500">Orange</option>
                      <option value="bg-indigo-500">Indigo</option>
                    </select>
                    <button
                      onClick={addCategory}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                      Hinzufügen
                    </button>
                  </div>
                </div>

                {/* Categories List */}
                <div className="space-y-3">
                  {categories.map(category => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl"
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          className={`w-4 h-4 rounded-full ${category.color}`}
                        ></div>
                        <span
                          className={`font-medium ${category.type === 'income' ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {category.type === 'income' ? '📈' : '📉'}{' '}
                          {category.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => toggleCategoryStatus(category.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            category.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {category.isActive ? 'Aktiv' : 'Inaktiv'}
                        </button>
                        <button
                          onClick={() => deleteCategory(category.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPIs Tab */}
            {activeTab === 'kpis' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    KPI-Konfigurationen
                  </h3>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                    + Neuer KPI
                  </button>
                </div>

                {/* Add New KPI Form */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Neuen KPI hinzufügen
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      value={newKPI.name}
                      onChange={e =>
                        setNewKPI({ ...newKPI, name: e.target.value })
                      }
                      placeholder="KPI-Name"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={newKPI.unit}
                      onChange={e =>
                        setNewKPI({ ...newKPI, unit: e.target.value })
                      }
                      placeholder="Einheit (z.B. EUR, %)"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      value={newKPI.formula}
                      onChange={e =>
                        setNewKPI({ ...newKPI, formula: e.target.value })
                      }
                      placeholder="Formel"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      value={newKPI.target}
                      onChange={e =>
                        setNewKPI({
                          ...newKPI,
                          target: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="Zielwert"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <textarea
                    value={newKPI.description}
                    onChange={e =>
                      setNewKPI({ ...newKPI, description: e.target.value })
                    }
                    placeholder="Beschreibung"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="mt-4">
                    <button
                      onClick={addKPI}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                      KPI hinzufügen
                    </button>
                  </div>
                </div>

                {/* KPIs List */}
                <div className="space-y-3">
                  {kpis.map(kpi => (
                    <div
                      key={kpi.id}
                      className="p-4 bg-white border border-gray-200 rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-lg font-medium text-gray-900">
                          {kpi.name}
                        </h5>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => toggleKPIStatus(kpi.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium ${
                              kpi.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {kpi.isActive ? 'Aktiv' : 'Inaktiv'}
                          </button>
                          <button
                            onClick={() => deleteKPI(kpi.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-600 mb-2">{kpi.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">
                            Formel:
                          </span>
                          <p className="text-gray-600 font-mono">
                            {kpi.formula}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            Zielwert:
                          </span>
                          <p className="text-gray-600">
                            {kpi.target} {kpi.unit}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            Status:
                          </span>
                          <p className="text-gray-600">
                            {kpi.isActive
                              ? 'Überwachung aktiv'
                              : 'Überwachung inaktiv'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Import Tab */}
            {activeTab === 'import' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Bankanbindung & Import
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h4 className="text-lg font-medium text-blue-900 mb-3">
                      🏦 Bankverbindung
                    </h4>
                    <p className="text-blue-700 mb-4">
                      Verbinden Sie Ihre Bankkonten für automatische
                      Transaktionsimporte.
                    </p>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                      Bank verbinden
                    </button>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <h4 className="text-lg font-medium text-green-900 mb-3">
                      📁 Datei-Import
                    </h4>
                    <p className="text-green-700 mb-4">
                      Importieren Sie CSV- oder Excel-Dateien von Ihrer Bank.
                    </p>
                    <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                      Datei hochladen
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">
                    📊 Import-Einstellungen
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">
                        Automatische Kategorisierung
                      </span>
                      <button className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
                        Aktiviert
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Duplikatserkennung</span>
                      <button className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
                        Aktiviert
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Währungsumrechnung</span>
                      <button className="bg-gray-400 text-white px-3 py-1 rounded-lg text-sm">
                        Deaktiviert
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Benachrichtigungen & Alerts
                </h3>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    E-Mail-Benachrichtigungen
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">
                        Wöchentliche Cashflow-Zusammenfassung
                      </span>
                      <button className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
                        Aktiviert
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">
                        KPI-Warnungen bei Abweichungen
                      </span>
                      <button className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
                        Aktiviert
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Monatliche Berichte</span>
                      <button className="bg-gray-400 text-white px-3 py-1 rounded-lg text-sm">
                        Deaktiviert
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Push-Benachrichtigungen
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">
                        Kritische Liquiditätswarnungen
                      </span>
                      <button className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
                        Aktiviert
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Neue Transaktionen</span>
                      <button className="bg-gray-400 text-white px-3 py-1 rounded-lg text-sm">
                        Deaktiviert
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
