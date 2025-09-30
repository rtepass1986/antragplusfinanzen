'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface ParsedInvoiceData {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  taxAmount: number;
  subtotal: number;
  currency: string;
  vendorAddress: string;
  vendorTaxId: string;
  paymentTerms: string;
  category: string;
  description: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category: string;
    taxRate: number;
  }>;
  notes: string;
  filename: string;
  fileSize: number;
  fileType: string;
  ocrConfidence: number;
  ocrRawText: string;
  processingMethod: string;
  projectSuggestions: Array<{
    projectId: string;
    projectName: string;
    confidence: number;
    reasoning: string;
  }>;
}

interface EnhancedInvoiceUploaderProps {
  onInvoiceParsed: (data: ParsedInvoiceData) => void;
  onError: (error: string) => void;
  className?: string;
}

export default function EnhancedInvoiceUploader({
  onInvoiceParsed,
  onError,
  className = '',
}: EnhancedInvoiceUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setUploadedFile(file);
      setProcessingStep('Uploading file...');

      try {
        const formData = new FormData();
        formData.append('file', file);

        setProcessingStep('Extracting data with AI...');
        const response = await fetch('/api/invoices/extract', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to process invoice');
        }

        setProcessingStep('Processing results...');
        const result = await response.json();

        if (result.success && result.extractedData) {
          setProcessingStep('Complete!');
          onInvoiceParsed(result.extractedData);
        } else {
          throw new Error('No data extracted from invoice');
        }
      } catch (error) {
        console.error('Invoice processing error:', error);
        onError(
          error instanceof Error ? error.message : 'Failed to process invoice'
        );
      } finally {
        setIsProcessing(false);
        setProcessingStep('');
      }
    },
    [onInvoiceParsed, onError]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isProcessing,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getProcessingMethodBadge = (method: string) => {
    const badges = {
      'aws-textract': {
        color: 'bg-blue-100 text-blue-800',
        label: 'AWS Textract',
      },
      'openai-vision': {
        color: 'bg-green-100 text-green-800',
        label: 'OpenAI Vision',
      },
      'pdf-parse-fallback': {
        color: 'bg-yellow-100 text-yellow-800',
        label: 'PDF Parse',
      },
    };
    const badge = badges[method as keyof typeof badges] || {
      color: 'bg-gray-100 text-gray-800',
      label: method,
    };
    return badge;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <div className="text-lg font-medium text-gray-700">
              {processingStep}
            </div>
            {uploadedFile && (
              <div className="text-sm text-gray-500">
                Processing: {uploadedFile.name}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-700">
                {isDragActive ? 'Drop the invoice here' : 'Upload Invoice'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Drag & drop or click to select
              </p>
            </div>
            <div className="text-xs text-gray-400">
              Supports PDF, JPG, PNG, TIFF, GIF, BMP (max 10MB)
            </div>
          </div>
        )}
      </div>

      {/* Processing Methods Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Processing Methods
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span>AWS Textract (PDF)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>OpenAI Vision (Images)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            <span>PDF Parse (Fallback)</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            AI-Powered Extraction
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Automatic text recognition</li>
            <li>• Smart field detection</li>
            <li>• Multi-language support</li>
            <li>• Line item parsing</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Advanced Features</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Project suggestions</li>
            <li>• Duplicate detection</li>
            <li>• Confidence scoring</li>
            <li>• Fallback processing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Export the ParsedInvoiceData type for use in other components
export type { ParsedInvoiceData };
