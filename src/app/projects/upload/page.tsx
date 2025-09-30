'use client';

import { projectDataExtractor } from '@/lib/projects/data-extractor';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface GrantTemplate {
  id: string;
  name: string;
  country: string;
  type: string;
  fields: {
    grantGiverName: string;
    grantGiverContact?: string;
    grantGiverEmail?: string;
    grantGiverPhone?: string;
    grantGiverAddress?: string;
    reportingFrequency: string;
    reportingTemplate?: string;
    commonCategories: string[];
    defaultCurrency: string;
  };
}

interface UploadedProjectData {
  name?: string;
  code?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  totalBudget?: number;
  currency?: string;
  grantGiverName?: string;
  grantGiverContact?: string;
  grantGiverEmail?: string;
  grantGiverPhone?: string;
  grantGiverAddress?: string;
  grantReference?: string;
  grantAgreementUrl?: string;
  reportingFrequency?: string;
  reportingTemplate?: string;
  projectManager?: string;
  teamMembers?: string[];
  categories?: string[];
  milestones?: any[];
  deliverables?: any[];
  budgetBreakdown?: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  risks?: Array<{
    description: string;
    impact: 'low' | 'medium' | 'high';
    probability: 'low' | 'medium' | 'high';
  }>;
  confidence?: number;
  processingNotes?: string;
}

interface UploadedFile {
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  extractedData?: UploadedProjectData;
  quality?: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
    recommendations: string[];
  };
  error?: string;
}

export default function ProjectUploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [extractedData, setExtractedData] = useState<UploadedProjectData>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [showQualityAnalysis, setShowQualityAnalysis] = useState(false);

  // Common grant templates
  const grantTemplates: GrantTemplate[] = [
    {
      id: 'bmwk',
      name: 'Bundesministerium für Wirtschaft und Klimaschutz',
      country: 'Deutschland',
      type: 'Bundesministerium',
      fields: {
        grantGiverName: 'Bundesministerium für Wirtschaft und Klimaschutz',
        grantGiverContact: 'Dr. Maria Schmidt',
        grantGiverEmail: 'maria.schmidt@bmwk.bund.de',
        grantGiverPhone: '+49 30 18615-0',
        grantGiverAddress: 'Scharnhorststraße 34-37, 10115 Berlin',
        reportingFrequency: 'MONTHLY',
        reportingTemplate: 'BMWK Standard Report',
        commonCategories: [
          'Software',
          'Hardware',
          'Personalkosten',
          'Beratung',
          'Schulungen',
        ],
        defaultCurrency: 'EUR',
      },
    },
    {
      id: 'eu-horizon',
      name: 'EU Horizon Europe',
      country: 'Europa',
      type: 'EU-Förderprogramm',
      fields: {
        grantGiverName: 'European Commission - Horizon Europe',
        grantGiverContact: 'Horizon Europe Support Team',
        grantGiverEmail: 'support@horizon-europe.eu',
        grantGiverPhone: '+32 2 299 11 11',
        grantGiverAddress: 'Rue de la Loi 200, 1049 Brussels, Belgium',
        reportingFrequency: 'QUARTERLY',
        reportingTemplate: 'Horizon Europe Progress Report',
        commonCategories: [
          'Forschung',
          'Entwicklung',
          'Innovation',
          'Personalkosten',
          'Ausstattung',
        ],
        defaultCurrency: 'EUR',
      },
    },
    {
      id: 'dfg',
      name: 'Deutsche Forschungsgemeinschaft',
      country: 'Deutschland',
      type: 'Forschungsförderung',
      fields: {
        grantGiverName: 'Deutsche Forschungsgemeinschaft',
        grantGiverContact: 'Prof. Dr. Klaus Wagner',
        grantGiverEmail: 'wagner@dfg.de',
        grantGiverPhone: '+49 228 885-1',
        grantGiverAddress: 'Kennedyallee 40, 53175 Bonn',
        reportingFrequency: 'BIANNUALLY',
        reportingTemplate: 'DFG Progress Report',
        commonCategories: [
          'Forschung',
          'Entwicklung',
          'Personalkosten',
          'Geräte',
          'Reisen',
        ],
        defaultCurrency: 'EUR',
      },
    },
    {
      id: 'bmbf',
      name: 'Bundesministerium für Bildung und Forschung',
      country: 'Deutschland',
      type: 'Bundesministerium',
      fields: {
        grantGiverName: 'Bundesministerium für Bildung und Forschung',
        grantGiverContact: 'Dr. Anna Müller',
        grantGiverEmail: 'anna.mueller@bmbf.bund.de',
        grantGiverPhone: '+49 30 1857-0',
        grantGiverAddress: 'Kapelle-Ufer 1, 10117 Berlin',
        reportingFrequency: 'MONTHLY',
        reportingTemplate: 'BMBF Project Report',
        commonCategories: [
          'Forschung',
          'Bildung',
          'Personalkosten',
          'Ausstattung',
          'Veranstaltungen',
        ],
        defaultCurrency: 'EUR',
      },
    },
    {
      id: 'custom',
      name: 'Eigene Vorlage',
      country: 'Alle',
      type: 'Benutzerdefiniert',
      fields: {
        grantGiverName: '',
        reportingFrequency: 'MONTHLY',
        commonCategories: [],
        defaultCurrency: 'EUR',
      },
    },
  ];

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingStep('Dateien werden hochgeladen...');

    // Initialize uploaded files
    const newUploadedFiles: UploadedFile[] = acceptedFiles.map(file => ({
      file,
      status: 'uploading',
      progress: 0,
    }));

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);

    try {
      if (acceptedFiles.length === 1) {
        // Single file processing
        setProcessingStep('Datei wird analysiert...');
        const extractedData = await projectDataExtractor.extractFromFile(
          acceptedFiles[0]
        );

        // Analyze document quality
        const quality = await projectDataExtractor.analyzeDocumentQuality(
          acceptedFiles[0]
        );

        setUploadedFiles(prev =>
          prev.map(uf =>
            uf.file === acceptedFiles[0]
              ? {
                  ...uf,
                  status: 'completed',
                  progress: 100,
                  extractedData,
                  quality,
                }
              : uf
          )
        );

        setExtractedData(extractedData);
      } else {
        // Multiple files processing
        setProcessingStep('Mehrere Dateien werden analysiert...');

        if (useAI) {
          // Use AI API endpoint for processing
          try {
            const formData = new FormData();
            acceptedFiles.forEach(file => {
              formData.append('files', file);
            });

            const response = await fetch('/api/projects/process-documents', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              throw new Error('AI processing failed');
            }

            const result = await response.json();
            setExtractedData(result.consolidatedData);
          } catch (error) {
            console.error(
              'AI processing failed, falling back to basic extraction:',
              error
            );
            // Fallback to basic extraction
            const extractedData =
              await projectDataExtractor.extractFromMultipleFiles(
                acceptedFiles
              );
            setExtractedData(extractedData);
          }
        } else {
          // Use basic extraction
          const extractedData =
            await projectDataExtractor.extractFromMultipleFiles(acceptedFiles);
          setExtractedData(extractedData);
        }

        // Update all files as completed
        setUploadedFiles(prev =>
          prev.map(uf =>
            acceptedFiles.includes(uf.file)
              ? { ...uf, status: 'completed', progress: 100 }
              : uf
          )
        );
      }

      setProcessingStep('Abgeschlossen');
    } catch (error) {
      console.error('Error processing files:', error);
      setProcessingStep('Fehler beim Verarbeiten der Dateien');

      // Mark files as error
      setUploadedFiles(prev =>
        prev.map(uf =>
          acceptedFiles.includes(uf.file)
            ? {
                ...uf,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            : uf
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'application/json': ['.json'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple: true,
    maxFiles: 10,
  });

  const applyTemplate = () => {
    if (!selectedTemplate) return;

    const template = grantTemplates.find(t => t.id === selectedTemplate);
    if (!template) return;

    setExtractedData(prev => ({
      ...prev,
      ...template.fields,
      categories: template.fields.commonCategories,
      currency: template.fields.defaultCurrency,
    }));
  };

  const removeFile = (fileToRemove: File) => {
    setUploadedFiles(prev => prev.filter(uf => uf.file !== fileToRemove));

    // If this was the only file, clear extracted data
    const remainingFiles = uploadedFiles.filter(uf => uf.file !== fileToRemove);
    if (remainingFiles.length === 0) {
      setExtractedData({});
    }
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
    setExtractedData({});
    setSelectedTemplate('');
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-600 bg-green-100';
      case 'good':
        return 'text-blue-600 bg-blue-100';
      case 'fair':
        return 'text-yellow-600 bg-yellow-100';
      case 'poor':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📄';
    }
  };

  const saveProject = async () => {
    try {
      setIsProcessing(true);
      setProcessingStep('Projekt wird gespeichert...');

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractedData),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern des Projekts');
      }

      const savedProject = await response.json();

      setProcessingStep('Projekt erfolgreich erstellt!');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Redirect to projects page
      window.location.href = '/projects';
    } catch (error) {
      console.error('Error saving project:', error);
      setProcessingStep('Fehler beim Speichern des Projekts');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
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
                Projekt hochladen
              </h1>
              <p className="mt-2 text-gray-600">
                Laden Sie Projektdaten hoch und lassen Sie alle Felder
                automatisch ausfüllen
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            {/* AI Processing Toggle */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    KI-Verarbeitung
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Verwenden Sie KI für intelligente Dokumentenanalyse
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAI}
                    onChange={e => setUseAI(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* File Upload */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Dokumente hochladen
                </h3>
                {uploadedFiles.length > 0 && (
                  <button
                    onClick={clearAllFiles}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Alle löschen
                  </button>
                )}
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>

                  {isDragActive ? (
                    <div>
                      <p className="text-lg font-medium text-blue-600">
                        Dateien hier ablegen...
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        Dateien hier ablegen oder klicken zum Auswählen
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        PDF, Word, Excel, Text, JSON oder Bilder werden
                        unterstützt
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Maximal 10 Dateien gleichzeitig
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map((uploadedFile, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">
                          {getStatusIcon(uploadedFile.status)}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {uploadedFile.file.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {(uploadedFile.file.size / 1024).toFixed(1)} KB
                          </p>
                          {uploadedFile.quality && (
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getQualityColor(
                                uploadedFile.quality.quality
                              )}`}
                            >
                              {uploadedFile.quality.quality}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {uploadedFile.status === 'completed' && (
                          <button
                            onClick={() =>
                              setShowQualityAnalysis(!showQualityAnalysis)
                            }
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Qualität
                          </button>
                        )}
                        <button
                          onClick={() => removeFile(uploadedFile.file)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isProcessing && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <p className="text-blue-800">{processingStep}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Grant Template Selection */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Fördergeber-Vorlage auswählen
              </h3>

              <div className="space-y-3">
                {grantTemplates.map(template => (
                  <label
                    key={template.id}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="template"
                      value={template.id}
                      checked={selectedTemplate === template.id}
                      onChange={e => setSelectedTemplate(e.target.value)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">
                          {template.name}
                        </p>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {template.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {template.country}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <button
                onClick={applyTemplate}
                disabled={!selectedTemplate}
                className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Vorlage anwenden
              </button>
            </div>
          </div>

          {/* Extracted Data Preview */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Extrahierte Daten
              </h3>

              {Object.keys(extractedData).length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500">
                    Laden Sie eine Datei hoch, um extrahierte Daten zu sehen
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Basic Information */}
                  {extractedData.name && (
                    <div className="border-b pb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Projektname
                      </label>
                      <p className="text-gray-900">{extractedData.name}</p>
                    </div>
                  )}

                  {extractedData.code && (
                    <div className="border-b pb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Projektcode
                      </label>
                      <p className="text-gray-900">{extractedData.code}</p>
                    </div>
                  )}

                  {extractedData.description && (
                    <div className="border-b pb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Beschreibung
                      </label>
                      <p className="text-gray-900 text-sm">
                        {extractedData.description}
                      </p>
                    </div>
                  )}

                  {/* Financial Information */}
                  <div className="border-b pb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Budget
                    </label>
                    <div className="flex items-center space-x-4">
                      <p className="text-gray-900">
                        {new Intl.NumberFormat('de-DE', {
                          style: 'currency',
                          currency: extractedData.currency || 'EUR',
                        }).format(extractedData.totalBudget || 0)}
                      </p>
                      <span className="text-sm text-gray-500">
                        {extractedData.currency || 'EUR'}
                      </span>
                    </div>
                  </div>

                  {/* Timeline */}
                  {(extractedData.startDate || extractedData.endDate) && (
                    <div className="border-b pb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Zeitraum
                      </label>
                      <div className="flex items-center space-x-4 text-sm">
                        {extractedData.startDate && (
                          <span className="text-gray-900">
                            Von:{' '}
                            {new Date(
                              extractedData.startDate
                            ).toLocaleDateString('de-DE')}
                          </span>
                        )}
                        {extractedData.endDate && (
                          <span className="text-gray-900">
                            Bis:{' '}
                            {new Date(extractedData.endDate).toLocaleDateString(
                              'de-DE'
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Grant Information */}
                  {extractedData.grantGiverName && (
                    <div className="border-b pb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fördergeber
                      </label>
                      <p className="text-gray-900">
                        {extractedData.grantGiverName}
                      </p>
                      {extractedData.grantReference && (
                        <p className="text-sm text-gray-600 mt-1">
                          Referenz: {extractedData.grantReference}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Categories */}
                  {extractedData.categories &&
                    extractedData.categories.length > 0 && (
                      <div className="border-b pb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Kategorien
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {extractedData.categories.map((category, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Milestones */}
                  {extractedData.milestones &&
                    extractedData.milestones.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Meilensteine
                        </label>
                        <div className="space-y-2">
                          {extractedData.milestones
                            .slice(0, 3)
                            .map((milestone: any, index: number) => (
                              <div
                                key={index}
                                className="flex items-center space-x-3 text-sm"
                              >
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    milestone.status === 'completed'
                                      ? 'bg-green-500'
                                      : milestone.status === 'in_progress'
                                        ? 'bg-yellow-500'
                                        : 'bg-gray-300'
                                  }`}
                                ></div>
                                <span className="text-gray-900">
                                  {milestone.name}
                                </span>
                                <span className="text-gray-500">
                                  {new Date(milestone.date).toLocaleDateString(
                                    'de-DE'
                                  )}
                                </span>
                              </div>
                            ))}
                          {extractedData.milestones.length > 3 && (
                            <p className="text-sm text-gray-500">
                              +{extractedData.milestones.length - 3} weitere
                              Meilensteine
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Budget Breakdown */}
                  {extractedData.budgetBreakdown &&
                    extractedData.budgetBreakdown.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Budgetaufteilung
                        </label>
                        <div className="space-y-2">
                          {extractedData.budgetBreakdown.map((item, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-900">
                                {item.category}
                              </span>
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-600">
                                  {new Intl.NumberFormat('de-DE', {
                                    style: 'currency',
                                    currency: extractedData.currency || 'EUR',
                                  }).format(item.amount)}
                                </span>
                                <span className="text-gray-500">
                                  ({item.percentage}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Risks */}
                  {extractedData.risks && extractedData.risks.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Risiken
                      </label>
                      <div className="space-y-2">
                        {extractedData.risks.map((risk, index) => (
                          <div
                            key={index}
                            className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                          >
                            <p className="text-sm text-gray-900">
                              {risk.description}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-xs">
                              <span
                                className={`px-2 py-1 rounded ${
                                  risk.impact === 'high'
                                    ? 'bg-red-100 text-red-800'
                                    : risk.impact === 'medium'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-green-100 text-green-800'
                                }`}
                              >
                                Impact: {risk.impact}
                              </span>
                              <span
                                className={`px-2 py-1 rounded ${
                                  risk.probability === 'high'
                                    ? 'bg-red-100 text-red-800'
                                    : risk.probability === 'medium'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-green-100 text-green-800'
                                }`}
                              >
                                Probability: {risk.probability}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Processing Information */}
                  {(extractedData.confidence ||
                    extractedData.processingNotes) && (
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        KI-Verarbeitung
                      </label>
                      <div className="space-y-2">
                        {extractedData.confidence && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">
                              Vertrauen:
                            </span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${extractedData.confidence * 100}%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">
                              {Math.round(extractedData.confidence * 100)}%
                            </span>
                          </div>
                        )}
                        {extractedData.processingNotes && (
                          <p className="text-xs text-gray-500">
                            {extractedData.processingNotes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            {Object.keys(extractedData).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Aktionen
                </h3>

                <div className="space-y-3">
                  <button
                    onClick={saveProject}
                    className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Projekt erstellen
                  </button>

                  <button
                    onClick={clearAllFiles}
                    className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quality Analysis Modal */}
        {showQualityAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Dokumentqualitätsanalyse
                </h3>
                <button
                  onClick={() => setShowQualityAnalysis(false)}
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

              <div className="space-y-4">
                {uploadedFiles.map(
                  (uploadedFile, index) =>
                    uploadedFile.quality && (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            {uploadedFile.file.name}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getQualityColor(uploadedFile.quality.quality)}`}
                          >
                            {uploadedFile.quality.quality}
                          </span>
                        </div>

                        {uploadedFile.quality.issues.length > 0 && (
                          <div className="mb-3">
                            <h5 className="text-sm font-medium text-red-800 mb-2">
                              Probleme:
                            </h5>
                            <ul className="text-sm text-red-700 space-y-1">
                              {uploadedFile.quality.issues.map(
                                (issue, issueIndex) => (
                                  <li key={issueIndex}>• {issue}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                        {uploadedFile.quality.recommendations.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-blue-800 mb-2">
                              Empfehlungen:
                            </h5>
                            <ul className="text-sm text-blue-700 space-y-1">
                              {uploadedFile.quality.recommendations.map(
                                (rec, recIndex) => (
                                  <li key={recIndex}>• {rec}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Supported File Types */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            Unterstützte Dateiformate
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Dokumente</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• PDF - Projektanträge, Verträge</li>
                <li>• Word (.docx, .doc) - Projektbeschreibungen</li>
                <li>• Text (.txt) - Einfache Projektbeschreibungen</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-blue-800 mb-2">Daten</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Excel (.xlsx, .xls) - Budget und Zeitpläne</li>
                <li>• JSON - Strukturierte Projektdaten</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-blue-800 mb-2">Bilder</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• PNG, JPG - OCR-Verarbeitung</li>
                <li>• Gescannte Dokumente</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>KI-Features:</strong> Das System verwendet künstliche
              Intelligenz zur automatischen Erkennung und Extraktion von
              Projektinformationen, Budgets, Zeitplänen, Risiken und
              Fördergeber-Details aus Ihren Dokumenten.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
