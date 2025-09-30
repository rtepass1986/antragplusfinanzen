'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Project {
  id: string;
  name: string;
  code?: string;
  description?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
  startDate?: string;
  endDate?: string;
  budget?: number;
  totalBudget?: number;
  spentAmount?: number;
  remainingBudget?: number;
  currency: string;
  grantGiverName?: string;
  grantGiverContact?: string;
  grantGiverEmail?: string;
  grantGiverPhone?: string;
  grantGiverAddress?: string;
  grantReference?: string;
  grantAgreementUrl?: string;
  reportingFrequency:
    | 'WEEKLY'
    | 'MONTHLY'
    | 'QUARTERLY'
    | 'BIANNUALLY'
    | 'ANNUALLY'
    | 'CUSTOM';
  nextReportDue?: string;
  lastReportSent?: string;
  reportingTemplate?: string;
  reportingEmail?: string;
  autoReporting: boolean;
  projectManager?: string;
  teamMembers: string[];
  categories: string[];
  milestones?: any;
  deliverables?: any;
  risks?: any;
  createdAt: string;
  updatedAt: string;
}

interface ProjectTransaction {
  id: string;
  type: 'invoice' | 'expense' | 'income';
  description: string;
  amount: number;
  date: string;
  category: string;
  status: string;
  reference?: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<ProjectTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'transactions' | 'reports' | 'settings'
  >('overview');

  useEffect(() => {
    loadProjectData();
  }, [params.id]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/projects/${params.id}`);
      // const projectData = await response.json();
      // setProject(projectData);

      // Mock data for demonstration
      const mockProject: Project = {
        id: params.id as string,
        name: 'Digitalisierung Initiative 2024',
        code: 'DIGI-2024',
        description:
          'Umfassende Digitalisierung der Geschäftsprozesse mit Fokus auf Automatisierung und Effizienzsteigerung.',
        status: 'ACTIVE',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        budget: 50000,
        totalBudget: 50000,
        spentAmount: 12500,
        remainingBudget: 37500,
        currency: 'EUR',
        grantGiverName: 'Bundesministerium für Wirtschaft',
        grantGiverContact: 'Dr. Maria Schmidt',
        grantGiverEmail: 'maria.schmidt@bmwk.bund.de',
        grantGiverPhone: '+49 30 18615-0',
        grantGiverAddress: 'Scharnhorststraße 34-37, 10115 Berlin',
        grantReference: 'BMWK-2024-001',
        grantAgreementUrl: 'https://example.com/agreement.pdf',
        reportingFrequency: 'MONTHLY',
        nextReportDue: '2024-02-15',
        lastReportSent: '2024-01-15',
        reportingTemplate: 'Standard Monthly Report',
        reportingEmail: 'reports@company.com',
        autoReporting: true,
        projectManager: 'Max Mustermann',
        teamMembers: ['Anna Müller', 'Peter Weber', 'Lisa Schmidt'],
        categories: ['Software', 'Hardware', 'Schulungen', 'Beratung'],
        milestones: [
          { name: 'Projektstart', date: '2024-01-01', status: 'completed' },
          {
            name: 'Anforderungsanalyse',
            date: '2024-02-15',
            status: 'completed',
          },
          { name: 'Systemauswahl', date: '2024-03-31', status: 'in_progress' },
          {
            name: 'Implementierung Phase 1',
            date: '2024-06-30',
            status: 'pending',
          },
          {
            name: 'Implementierung Phase 2',
            date: '2024-09-30',
            status: 'pending',
          },
          { name: 'Projektabschluss', date: '2024-12-31', status: 'pending' },
        ],
        deliverables: [
          {
            name: 'Anforderungsdokument',
            status: 'completed',
            dueDate: '2024-02-15',
          },
          {
            name: 'Systemarchitektur',
            status: 'in_progress',
            dueDate: '2024-03-31',
          },
          {
            name: 'Implementierungsplan',
            status: 'pending',
            dueDate: '2024-04-15',
          },
          {
            name: 'Benutzerhandbuch',
            status: 'pending',
            dueDate: '2024-11-30',
          },
        ],
        risks: [
          {
            name: 'Verzögerung bei Systemauswahl',
            probability: 'medium',
            impact: 'high',
            mitigation: 'Frühzeitige Einbindung aller Stakeholder',
          },
          {
            name: 'Budgetüberschreitung',
            probability: 'low',
            impact: 'high',
            mitigation: 'Regelmäßige Budgetkontrolle und -anpassung',
          },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      };

      const mockTransactions: ProjectTransaction[] = [
        {
          id: '1',
          type: 'expense',
          description: 'Software-Lizenz - Microsoft 365',
          amount: -1200,
          date: '2024-01-15',
          category: 'Software',
          status: 'paid',
          reference: 'INV-001',
        },
        {
          id: '2',
          type: 'expense',
          description: 'Hardware - Laptops für Team',
          amount: -3500,
          date: '2024-01-20',
          category: 'Hardware',
          status: 'paid',
          reference: 'INV-002',
        },
        {
          id: '3',
          type: 'expense',
          description: 'Schulung - Projektmanagement',
          amount: -1800,
          date: '2024-02-01',
          category: 'Schulungen',
          status: 'paid',
          reference: 'INV-003',
        },
        {
          id: '4',
          type: 'income',
          description: 'Fördergelder - Erste Rate',
          amount: 15000,
          date: '2024-01-01',
          category: 'Förderung',
          status: 'received',
          reference: 'GRANT-001',
        },
      ];

      setProject(mockProject);
      setTransactions(mockTransactions);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'ON_HOLD':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Aktiv';
      case 'COMPLETED':
        return 'Abgeschlossen';
      case 'ON_HOLD':
        return 'Pausiert';
      case 'CANCELLED':
        return 'Abgebrochen';
      default:
        return status;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const calculateProgress = (
    spent: number | undefined,
    total: number | undefined
  ) => {
    if (!total || total === 0) return 0;
    return Math.round(((spent || 0) / total) * 100);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-red-500';
    if (progress >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Projekt wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
            <span className="text-4xl">🎯</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Projekt nicht gefunden
          </h3>
          <p className="text-gray-600 mb-6">
            Das angeforderte Projekt konnte nicht gefunden werden.
          </p>
          <Link
            href="/projects"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Zurück zu Projekten
          </Link>
        </div>
      </div>
    );
  }

  const progress = calculateProgress(project.spentAmount, project.totalBudget);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/projects"
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {project.name}
                </h1>
                {project.code && (
                  <p className="text-lg text-gray-600">{project.code}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}
              >
                {getStatusText(project.status)}
              </span>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Bearbeiten
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Übersicht', icon: '📊' },
              { id: 'transactions', name: 'Transaktionen', icon: '💰' },
              { id: 'reports', name: 'Berichte', icon: '📋' },
              { id: 'settings', name: 'Einstellungen', icon: '⚙️' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Financial Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Finanzübersicht
                  </h3>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Gesamtbudget</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(
                          project.totalBudget || 0,
                          project.currency
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Ausgegeben</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(
                          project.spentAmount || 0,
                          project.currency
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Verbleibt</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(
                          project.remainingBudget || 0,
                          project.currency
                        )}
                      </span>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Fortschritt
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${getProgressColor(progress)}`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Project Info */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Projektinformationen
                  </h3>

                  <div className="space-y-3 text-sm">
                    {project.startDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Startdatum</span>
                        <span className="text-gray-900">
                          {formatDate(project.startDate)}
                        </span>
                      </div>
                    )}

                    {project.endDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Enddatum</span>
                        <span className="text-gray-900">
                          {formatDate(project.endDate)}
                        </span>
                      </div>
                    )}

                    {project.projectManager && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Projektleiter</span>
                        <span className="text-gray-900">
                          {project.projectManager}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Teammitglieder</span>
                      <span className="text-gray-900">
                        {project.teamMembers.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grant Information */}
                {project.grantGiverName && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Fördergeber
                    </h3>

                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-600">Name</span>
                        <p className="text-gray-900">
                          {project.grantGiverName}
                        </p>
                      </div>

                      {project.grantGiverContact && (
                        <div>
                          <span className="text-gray-600">Ansprechpartner</span>
                          <p className="text-gray-900">
                            {project.grantGiverContact}
                          </p>
                        </div>
                      )}

                      {project.grantReference && (
                        <div>
                          <span className="text-gray-600">Referenz</span>
                          <p className="text-gray-900">
                            {project.grantReference}
                          </p>
                        </div>
                      )}

                      {project.nextReportDue && (
                        <div>
                          <span className="text-gray-600">
                            Nächster Bericht
                          </span>
                          <p className="text-gray-900">
                            {formatDate(project.nextReportDue)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Milestones */}
            {project.milestones && project.milestones.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Meilensteine
                </h3>

                <div className="space-y-4">
                  {project.milestones.map((milestone: any, index: number) => (
                    <div key={index} className="flex items-center space-x-4">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          milestone.status === 'completed'
                            ? 'bg-green-500'
                            : milestone.status === 'in_progress'
                              ? 'bg-yellow-500'
                              : 'bg-gray-300'
                        }`}
                      ></div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {milestone.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(milestone.date)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          milestone.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : milestone.status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {milestone.status === 'completed'
                          ? 'Abgeschlossen'
                          : milestone.status === 'in_progress'
                            ? 'In Bearbeitung'
                            : 'Ausstehend'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Letzte Transaktionen
                </h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Alle anzeigen
                </button>
              </div>

              <div className="space-y-3">
                {transactions.slice(0, 5).map(transaction => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          transaction.type === 'income'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      ></div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {transaction.description}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(transaction.date)} •{' '}
                          {transaction.category}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-semibold ${
                        transaction.amount > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(transaction.amount, project.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Alle Transaktionen
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Beschreibung
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategorie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Betrag
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map(transaction => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`w-2 h-2 rounded-full mr-3 ${
                              transaction.type === 'income'
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                          ></div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {transaction.description}
                            </div>
                            {transaction.reference && (
                              <div className="text-sm text-gray-500">
                                {transaction.reference}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {transaction.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-semibold ${
                            transaction.amount > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(transaction.amount, project.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transaction.status === 'paid' ||
                            transaction.status === 'received'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {transaction.status === 'paid'
                            ? 'Bezahlt'
                            : transaction.status === 'received'
                              ? 'Erhalten'
                              : 'Ausstehend'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Berichtswesen
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-4">
                  Berichtseinstellungen
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Berichtsfrequenz
                    </label>
                    <p className="text-sm text-gray-900">
                      {project.reportingFrequency === 'MONTHLY'
                        ? 'Monatlich'
                        : project.reportingFrequency === 'QUARTERLY'
                          ? 'Vierteljährlich'
                          : project.reportingFrequency === 'ANNUALLY'
                            ? 'Jährlich'
                            : project.reportingFrequency}
                    </p>
                  </div>

                  {project.nextReportDue && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nächster Bericht fällig
                      </label>
                      <p className="text-sm text-gray-900">
                        {formatDate(project.nextReportDue)}
                      </p>
                    </div>
                  )}

                  {project.lastReportSent && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Letzter Bericht gesendet
                      </label>
                      <p className="text-sm text-gray-900">
                        {formatDate(project.lastReportSent)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-4">Aktionen</h4>
                <div className="space-y-3">
                  <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Bericht generieren
                  </button>
                  <button className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                    Vorlage bearbeiten
                  </button>
                  <button className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                    Automatische Berichte{' '}
                    {project.autoReporting ? 'deaktivieren' : 'aktivieren'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Projekteinstellungen
            </h3>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-4">
                  Allgemeine Einstellungen
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Projektstatus
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option
                        value="ACTIVE"
                        selected={project.status === 'ACTIVE'}
                      >
                        Aktiv
                      </option>
                      <option
                        value="ON_HOLD"
                        selected={project.status === 'ON_HOLD'}
                      >
                        Pausiert
                      </option>
                      <option
                        value="COMPLETED"
                        selected={project.status === 'COMPLETED'}
                      >
                        Abgeschlossen
                      </option>
                      <option
                        value="CANCELLED"
                        selected={project.status === 'CANCELLED'}
                      >
                        Abgebrochen
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Projektleiter
                    </label>
                    <input
                      type="text"
                      defaultValue={project.projectManager || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-4">
                  Budget Einstellungen
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gesamtbudget
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={project.totalBudget || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Währung
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="EUR" selected={project.currency === 'EUR'}>
                        EUR
                      </option>
                      <option value="USD" selected={project.currency === 'USD'}>
                        USD
                      </option>
                      <option value="GBP" selected={project.currency === 'GBP'}>
                        GBP
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t">
                <div className="flex justify-end space-x-3">
                  <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    Abbrechen
                  </button>
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
