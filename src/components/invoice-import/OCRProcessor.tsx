'use client';

import { invoiceStorage } from '@/lib/invoiceStorage';
import { useRef, useState } from 'react';
import InvoiceReviewModal from './InvoiceReviewModal';

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
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

interface OCRResult extends ExtractedData {
  id?: string;
  taxAmount?: number;
  subtotal?: number;
  vendorAddress?: string;
  vendorTaxId?: string;
  paymentTerms?: string;
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

export default function OCRProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentFilename, setCurrentFilename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setUploadProgress(0);
    setCurrentFilename(file.name);

    try {
      // Simulate file upload progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', 'default-company-id');

      // Call AI data extraction API (no saving yet)
      const response = await fetch('/api/invoices/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`AI processing failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error('Invoice processing failed');
      }

      // Transform extracted data to our format
      const extractedData = result.extractedData;

      const transformedResult: OCRResult = {
        vendor: extractedData.vendor || '',
        invoiceNumber: extractedData.invoiceNumber || '',
        invoiceDate: extractedData.invoiceDate || '',
        dueDate: extractedData.dueDate || '',
        totalAmount: extractedData.totalAmount || 0,
        taxAmount: extractedData.taxAmount || 0,
        subtotal: extractedData.subtotal || extractedData.totalAmount,
        currency: extractedData.currency || 'EUR',
        category: extractedData.category,
        description: extractedData.description,
        lineItems: extractedData.lineItems || [],
        vendorAddress: extractedData.vendorAddress,
        vendorTaxId: extractedData.vendorTaxId,
        paymentTerms: extractedData.paymentTerms,
        notes: extractedData.notes,
        // Store project suggestions for the review modal
        aiAnalysis: {
          suggestedProject: extractedData.projectSuggestions?.[0]
            ? {
                projectId: extractedData.projectSuggestions[0].projectId,
                projectName: extractedData.projectSuggestions[0].projectName,
                confidence: extractedData.projectSuggestions[0].confidence,
                reasoning: extractedData.projectSuggestions[0].reasoning,
              }
            : undefined,
          paymentStatus: 'unpaid', // Will be determined when saving
          matchedTransactions: [],
          categorySuggestion: extractedData.category,
          riskAssessment: 'Review required before saving',
        },
      };

      setOcrResult(transformedResult);
      setShowReviewModal(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred during AI processing'
      );
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const handleSaveInvoice = (invoiceData: ExtractedData) => {
    // Update the invoice in storage with reviewed status
    setShowReviewModal(false);
    setOcrResult(null);
    setError('');
    // You could add a success state here
  };

  const resetForm = () => {
    setOcrResult(null);
    setCurrentFilename('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isProcessing
            ? 'border-blue-300 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isProcessing ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Processing Invoice...
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Extracting data with OCR
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">{uploadProgress}% complete</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Upload Invoice
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Drag and drop your invoice here, or click to browse
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
            >
              Choose File
            </button>

            <p className="text-xs text-gray-500">
              Supports: JPG, PNG, PDF (max 10MB)
            </p>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
          <button
            onClick={resetForm}
            className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Success Message */}
      {ocrResult && !showReviewModal && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-400 mr-2"
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
              <span className="text-green-800">
                Invoice processed successfully! Ready for review.
              </span>
            </div>
            <button
              onClick={() => setShowReviewModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Review Data
            </button>
          </div>
        </div>
      )}

      {/* Invoice Review Modal */}
      {ocrResult && (
        <InvoiceReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSave={handleSaveInvoice}
          extractedData={ocrResult}
          filename={currentFilename}
        />
      )}

      {/* Processing Queue Info */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Processing Queue
        </h3>
        <div className="space-y-3">
          {invoiceStorage.getProcessingInvoices().map(invoice => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-3 bg-white rounded-md border"
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">
                  {invoice.filename}
                </span>
                <span className="text-xs text-gray-500">
                  {invoice.extractedData.vendor} - €
                  {invoice.extractedData.totalAmount}
                </span>
              </div>
              <span className="text-xs text-gray-500">Processing</span>
            </div>
          ))}

          {invoiceStorage.getProcessingInvoices().length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No invoices in processing queue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
