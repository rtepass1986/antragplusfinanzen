'use client';

import Link from 'next/link';
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
  grantReference?: string;
  reportingFrequency:
    | 'WEEKLY'
    | 'MONTHLY'
    | 'QUARTERLY'
    | 'BIANNUALLY'
    | 'ANNUALLY'
    | 'CUSTOM';
  nextReportDue?: string;
  projectManager?: string;
  teamMembers: string[];
  categories: string[];
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Load projects from API/database
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const projectsData = await response.json();
          setProjects(projectsData);
          setFilteredProjects(projectsData);
        } else {
          console.error('Error loading projects:', response.statusText);
          // Fallback to empty array
          setProjects([]);
          setFilteredProjects([]);
        }
      } catch (error) {
        console.error('Error loading projects:', error);
        // Fallback to empty array
        setProjects([]);
        setFilteredProjects([]);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    filterAndSortProjects();
  }, [projects, searchQuery, statusFilter, sortBy, sortOrder]);

  const filterAndSortProjects = () => {
    const filtered = projects.filter(project => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.grantGiverName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'budget':
          comparison = (a.totalBudget || 0) - (b.totalBudget || 0);
          break;
        case 'spent':
          comparison = (a.spentAmount || 0) - (b.spentAmount || 0);
          break;
        case 'progress':
          const progressA = a.totalBudget
            ? (a.spentAmount || 0) / a.totalBudget
            : 0;
          const progressB = b.totalBudget
            ? (b.spentAmount || 0) / b.totalBudget
            : 0;
          comparison = progressA - progressB;
          break;
        case 'startDate':
          comparison =
            new Date(a.startDate || 0).getTime() -
            new Date(b.startDate || 0).getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredProjects(filtered);
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

  const formatCurrency = (
    amount: number | undefined,
    currency: string = 'EUR'
  ) => {
    if (!amount) return '0,00 €';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
    }).format(amount);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Projekte</h1>
              <p className="mt-2 text-gray-600">
                Verwalten Sie Ihre Projekte, Budgets und Fördergelder
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href="/projects/upload"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <span>📤</span>
                <span>Projekt hochladen</span>
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <span>+</span>
                <span>Neues Projekt</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">🎯</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Gesamt Projekte
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {projects.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Aktive Projekte
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {projects.filter(p => p.status === 'ACTIVE').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Gesamtbudget
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    projects.reduce((sum, p) => sum + (p.totalBudget || 0), 0)
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <span className="text-2xl">📊</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ausgegeben</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    projects.reduce((sum, p) => sum + (p.spentAmount || 0), 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Projekte durchsuchen..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Alle Status</option>
                <option value="ACTIVE">Aktiv</option>
                <option value="COMPLETED">Abgeschlossen</option>
                <option value="ON_HOLD">Pausiert</option>
                <option value="CANCELLED">Abgebrochen</option>
              </select>

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={e => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order as 'asc' | 'desc');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="status-asc">Status</option>
                <option value="budget-desc">Budget (Hoch)</option>
                <option value="budget-asc">Budget (Niedrig)</option>
                <option value="progress-desc">Fortschritt</option>
                <option value="startDate-desc">Startdatum (Neu)</option>
                <option value="startDate-asc">Startdatum (Alt)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            const progress = calculateProgress(
              project.spentAmount,
              project.totalBudget
            );

            return (
              <div
                key={project.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {project.name}
                      </h3>
                      {project.code && (
                        <p className="text-sm text-gray-500">{project.code}</p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}
                    >
                      {getStatusText(project.status)}
                    </span>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  {/* Grant Giver */}
                  {project.grantGiverName && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Fördergeber
                      </p>
                      <p className="text-sm text-gray-900">
                        {project.grantGiverName}
                      </p>
                      {project.grantReference && (
                        <p className="text-xs text-gray-500">
                          Referenz: {project.grantReference}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Budget Information */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Budget</span>
                      <span className="font-medium">
                        {formatCurrency(project.totalBudget, project.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Ausgegeben</span>
                      <span className="font-medium">
                        {formatCurrency(project.spentAmount, project.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-gray-600">Verbleibt</span>
                      <span className="font-medium">
                        {formatCurrency(
                          project.remainingBudget,
                          project.currency
                        )}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getProgressColor(progress)}`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {progress}% ausgegeben
                    </p>
                  </div>

                  {/* Project Details */}
                  <div className="space-y-2 text-sm">
                    {project.projectManager && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Projektleiter</span>
                        <span className="text-gray-900">
                          {project.projectManager}
                        </span>
                      </div>
                    )}

                    {project.startDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Start</span>
                        <span className="text-gray-900">
                          {new Date(project.startDate).toLocaleDateString(
                            'de-DE'
                          )}
                        </span>
                      </div>
                    )}

                    {project.endDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ende</span>
                        <span className="text-gray-900">
                          {new Date(project.endDate).toLocaleDateString(
                            'de-DE'
                          )}
                        </span>
                      </div>
                    )}

                    {project.nextReportDue && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Nächster Bericht</span>
                        <span className="text-gray-900">
                          {new Date(project.nextReportDue).toLocaleDateString(
                            'de-DE'
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex space-x-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex-1 bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Details
                    </Link>
                    <button
                      onClick={() => setEditingProject(project)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      Bearbeiten
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">🎯</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Keine Projekte gefunden
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Versuchen Sie andere Suchkriterien oder Filter.'
                : 'Erstellen Sie Ihr erstes Projekt, um loszulegen.'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Erstes Projekt erstellen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Project Modal */}
      {(showCreateModal || editingProject) && (
        <ProjectModal
          project={editingProject}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProject(null);
          }}
          onSave={project => {
            // Handle save logic here
            console.log('Saving project:', project);
            setShowCreateModal(false);
            setEditingProject(null);
          }}
        />
      )}
    </div>
  );
}

// Project Modal Component
interface ProjectModalProps {
  project?: Project | null;
  onClose: () => void;
  onSave: (project: any) => void;
}

function ProjectModal({ project, onClose, onSave }: ProjectModalProps) {
  const [formData, setFormData] = useState({
    name: project?.name || '',
    code: project?.code || '',
    description: project?.description || '',
    status: project?.status || 'ACTIVE',
    startDate: project?.startDate || '',
    endDate: project?.endDate || '',
    totalBudget: project?.totalBudget || '',
    currency: project?.currency || 'EUR',
    grantGiverName: project?.grantGiverName || '',
    grantGiverContact: project?.grantGiverContact || '',
    grantGiverEmail: project?.grantGiverEmail || '',
    grantGiverPhone: project?.grantGiverPhone || '',
    grantGiverAddress: project?.grantGiverAddress || '',
    grantReference: project?.grantReference || '',
    reportingFrequency: project?.reportingFrequency || 'MONTHLY',
    projectManager: project?.projectManager || '',
    teamMembers: project?.teamMembers?.join(', ') || '',
    categories: project?.categories?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const projectData = {
      ...formData,
      totalBudget: parseFloat(formData.totalBudget) || 0,
      teamMembers: formData.teamMembers
        .split(',')
        .map(m => m.trim())
        .filter(m => m),
      categories: formData.categories
        .split(',')
        .map(c => c.trim())
        .filter(c => c),
    };
    onSave(projectData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {project ? 'Projekt bearbeiten' : 'Neues Projekt erstellen'}
            </h2>
            <button
              onClick={onClose}
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Projektname *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Projektcode
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beschreibung
              </label>
              <textarea
                value={formData.description}
                onChange={e =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Project Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={e =>
                    setFormData({ ...formData, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ACTIVE">Aktiv</option>
                  <option value="ON_HOLD">Pausiert</option>
                  <option value="COMPLETED">Abgeschlossen</option>
                  <option value="CANCELLED">Abgebrochen</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Startdatum
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enddatum
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Financial Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gesamtbudget
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalBudget}
                  onChange={e =>
                    setFormData({ ...formData, totalBudget: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Währung
                </label>
                <select
                  value={formData.currency}
                  onChange={e =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            {/* Grant Giver Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Fördergeber Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name des Fördergebers
                  </label>
                  <input
                    type="text"
                    value={formData.grantGiverName}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        grantGiverName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ansprechpartner
                  </label>
                  <input
                    type="text"
                    value={formData.grantGiverContact}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        grantGiverContact: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-Mail
                  </label>
                  <input
                    type="email"
                    value={formData.grantGiverEmail}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        grantGiverEmail: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Förderreferenz
                  </label>
                  <input
                    type="text"
                    value={formData.grantReference}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        grantReference: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Reporting Framework */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Berichtswesen
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Berichtsfrequenz
                </label>
                <select
                  value={formData.reportingFrequency}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      reportingFrequency: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="WEEKLY">Wöchentlich</option>
                  <option value="MONTHLY">Monatlich</option>
                  <option value="QUARTERLY">Vierteljährlich</option>
                  <option value="BIANNUALLY">Halbjährlich</option>
                  <option value="ANNUALLY">Jährlich</option>
                  <option value="CUSTOM">Benutzerdefiniert</option>
                </select>
              </div>
            </div>

            {/* Project Team */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Projektteam
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Projektleiter
                  </label>
                  <input
                    type="text"
                    value={formData.projectManager}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        projectManager: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teammitglieder (kommagetrennt)
                  </label>
                  <input
                    type="text"
                    value={formData.teamMembers}
                    onChange={e =>
                      setFormData({ ...formData, teamMembers: e.target.value })
                    }
                    placeholder="Max Mustermann, Anna Müller, ..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Erlaubte Kategorien (kommagetrennt)
              </label>
              <input
                type="text"
                value={formData.categories}
                onChange={e =>
                  setFormData({ ...formData, categories: e.target.value })
                }
                placeholder="Software, Hardware, Personalkosten, ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {project ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
