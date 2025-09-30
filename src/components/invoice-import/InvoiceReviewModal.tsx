'use client';

import { useEffect, useState } from 'react';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ExtractedData {
  vendor?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  currency?: string;
  category?: string;
  project?: string;
  notes?: string;
  tags?: string[];
  lineItems?: LineItem[];
  aiAnalysis?: {
    suggestedProject?: {
      projectId: string;
      projectName: string;
      confidence: number;
      reasoning: string;
    };
    paymentStatus: 'paid' | 'unpaid' | 'partial';
    matchedTransactions: any[];
    categorySuggestion?: string;
    riskAssessment?: string;
    budgetImpact?: {
      budgetImpact: 'safe' | 'warning' | 'critical';
      remainingBudget: number;
      utilizationPercentage: number;
      recommendation: string;
    };
  };
}

interface InvoiceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ExtractedData) => void;
  extractedData: ExtractedData;
  filename: string;
}

export default function InvoiceReviewModal({
  isOpen,
  onClose,
  onSave,
  extractedData,
  filename,
}: InvoiceReviewModalProps) {
  const [formData, setFormData] = useState<ExtractedData>(extractedData);
  const [lineItems, setLineItems] = useState<LineItem[]>(
    extractedData.lineItems || []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(extractedData);
      setLineItems(extractedData.lineItems || []);
      setErrors({});
      setSaveError(null);
    }
  }, [isOpen, extractedData]);

  const handleInputChange = (
    field: keyof ExtractedData,
    value: string | number | string[]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLineItemChange = (
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // Recalculate total
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity =
        field === 'quantity' ? Number(value) : updatedItems[index].quantity;
      const unitPrice =
        field === 'unitPrice' ? Number(value) : updatedItems[index].unitPrice;
      updatedItems[index].total = quantity * unitPrice;
    }

    setLineItems(updatedItems);
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.vendor?.trim()) {
      newErrors.vendor = 'Vendor ist erforderlich';
    }
    if (!formData.totalAmount || formData.totalAmount <= 0) {
      newErrors.totalAmount = 'Gültiger Gesamtbetrag ist erforderlich';
    }
    if (!formData.invoiceDate?.trim()) {
      newErrors.invoiceDate = 'Rechnungsdatum ist erforderlich';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const dataToSave = {
        ...formData,
        lineItems,
      };

      // Call the save API
      const response = await fetch('/api/invoices/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...dataToSave,
          companyId: 'default-company-id',
          filename: filename,
          s3Key: null, // This would come from the OCR result
          s3Url: null,
          extractedFields: {},
          ocrConfidence: 0.9,
          ocrRawText: '',
          tags: ['ai-extracted'],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save invoice');
      }

      const result = await response.json();

      if (result.success) {
        // Call the original onSave callback
        onSave(dataToSave);
        onClose();
      } else {
        throw new Error(result.error || 'Failed to save invoice');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save invoice'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags?.includes(tag.trim())) {
      const newTags = [...(formData.tags || []), tag.trim()];
      handleInputChange('tags', newTags);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = formData.tags?.filter(tag => tag !== tagToRemove) || [];
    handleInputChange('tags', newTags);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Rechnungsdaten überprüfen
              </h2>
              <p className="text-sm text-gray-600 mt-1">Datei: {filename}</p>
            </div>
            <button
              onClick={onClose}
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* AI Analysis Results */}
          {formData.aiAnalysis && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                AI-Analyse Ergebnisse
              </h3>

              <div className="space-y-3">
                {/* Project Suggestion */}
                {formData.aiAnalysis.suggestedProject && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        KI-Empfehlung:
                      </span>
                      <span className="text-sm text-blue-600">
                        {Math.round(
                          formData.aiAnalysis.suggestedProject.confidence * 100
                        )}
                        % Vertrauen
                      </span>
                    </div>
                    <p className="text-gray-700 font-medium">
                      {formData.aiAnalysis.suggestedProject.projectName}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formData.aiAnalysis.suggestedProject.reasoning}
                    </p>
                    <button
                      onClick={() =>
                        handleInputChange(
                          'project',
                          formData.aiAnalysis.suggestedProject!.projectName
                        )
                      }
                      className="mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                    >
                      Als Projekt übernehmen
                    </button>
                  </div>
                )}

                {/* Payment Status */}
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      Zahlungsstatus:
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        formData.aiAnalysis.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : formData.aiAnalysis.paymentStatus === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {formData.aiAnalysis.paymentStatus === 'paid'
                        ? 'Bezahlt'
                        : formData.aiAnalysis.paymentStatus === 'partial'
                          ? 'Teilweise bezahlt'
                          : 'Unbezahlt'}
                    </span>
                  </div>
                  {formData.aiAnalysis.matchedTransactions.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {formData.aiAnalysis.matchedTransactions.length} passende
                      Transaktion(en) gefunden
                    </p>
                  )}
                </div>

                {/* Budget Impact */}
                {formData.aiAnalysis.budgetImpact && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        Budgetauswirkung:
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          formData.aiAnalysis.budgetImpact.budgetImpact ===
                          'safe'
                            ? 'bg-green-100 text-green-800'
                            : formData.aiAnalysis.budgetImpact.budgetImpact ===
                                'warning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {formData.aiAnalysis.budgetImpact.budgetImpact ===
                        'safe'
                          ? 'SICHER'
                          : formData.aiAnalysis.budgetImpact.budgetImpact ===
                              'warning'
                            ? 'WARNUNG'
                            : 'KRITISCH'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Projektauslastung:{' '}
                      {Math.round(
                        formData.aiAnalysis.budgetImpact.utilizationPercentage
                      )}
                      %
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {formData.aiAnalysis.budgetImpact.recommendation}
                    </p>
                  </div>
                )}

                {/* Risk Assessment */}
                {formData.aiAnalysis.riskAssessment && (
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <span className="font-medium text-gray-900">
                      Risikobewertung:
                    </span>
                    <p className="text-sm text-gray-600 mt-1">
                      {formData.aiAnalysis.riskAssessment}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lieferant *
              </label>
              <input
                type="text"
                value={formData.vendor || ''}
                onChange={e => handleInputChange('vendor', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.vendor ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Lieferantenname eingeben"
              />
              {errors.vendor && (
                <p className="text-red-500 text-sm mt-1">{errors.vendor}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechnungsnummer
              </label>
              <input
                type="text"
                value={formData.invoiceNumber || ''}
                onChange={e =>
                  handleInputChange('invoiceNumber', e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Rechnungsnummer eingeben"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechnungsdatum *
              </label>
              <input
                type="date"
                value={formData.invoiceDate || ''}
                onChange={e => handleInputChange('invoiceDate', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.invoiceDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.invoiceDate && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.invoiceDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fälligkeitsdatum
              </label>
              <input
                type="date"
                value={formData.dueDate || ''}
                onChange={e => handleInputChange('dueDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gesamtbetrag *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.totalAmount || ''}
                onChange={e =>
                  handleInputChange(
                    'totalAmount',
                    parseFloat(e.target.value) || 0
                  )
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.totalAmount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
              {errors.totalAmount && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.totalAmount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Währung
              </label>
              <select
                value={formData.currency || 'EUR'}
                onChange={e => handleInputChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF (CHF)</option>
              </select>
            </div>
          </div>

          {/* Category and Project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategorie
              </label>
              <select
                value={formData.category || ''}
                onChange={e => handleInputChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Kategorie auswählen</option>
                <option value="office">Büro & Verwaltung</option>
                <option value="travel">Reisen & Transport</option>
                <option value="marketing">Marketing & Werbung</option>
                <option value="software">Software & IT</option>
                <option value="consulting">Beratung & Dienstleistungen</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projekt
              </label>
              <input
                type="text"
                value={formData.project || ''}
                onChange={e => handleInputChange('project', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Projektname eingeben"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Rechnungspositionen
              </h3>
              <button
                onClick={addLineItem}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                + Position hinzufügen
              </button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-3 items-center p-3 border border-gray-200 rounded-lg"
                >
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e =>
                        handleLineItemChange(
                          index,
                          'description',
                          e.target.value
                        )
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Beschreibung"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e =>
                        handleLineItemChange(
                          index,
                          'quantity',
                          parseInt(e.target.value) || 1
                        )
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      min="1"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={e =>
                        handleLineItemChange(
                          index,
                          'unitPrice',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      value={item.total}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm bg-gray-50"
                      readOnly
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeLineItem(index)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes and Tags */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notizen
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={e => handleInputChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Zusätzliche Notizen eingeben..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tag hinzufügen..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.querySelector(
                      'input[placeholder="Tag hinzufügen..."]'
                    ) as HTMLInputElement;
                    if (input?.value) {
                      addTag(input.value);
                      input.value = '';
                    }
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          {/* Error Message */}
          {saveError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{saveError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSaving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{isSaving ? 'Speichern...' : 'Rechnung speichern'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
