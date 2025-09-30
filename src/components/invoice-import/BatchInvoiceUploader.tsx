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

interface BatchUploadResult {
  success: boolean;
  filename: string;
  data?: ParsedInvoiceData;
  error?: string;
}

interface BatchInvoiceUploaderProps {
  onBatchComplete: (results: BatchUploadResult[]) => void;
  onProgress: (completed: number, total: number) => void;
  className?: string;
}

export default function BatchInvoiceUploader({
  onBatchComplete,
  onProgress,
  className = '',
}: BatchInvoiceUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<File[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [results, setResults] = useState<BatchUploadResult[]>([]);

  const processFile = useCallback(
    async (file: File): Promise<BatchUploadResult> => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/invoices/extract', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            success: false,
            filename: file.name,
            error: errorData.error || 'Failed to process invoice',
          };
        }

        const result = await response.json();

        if (result.success && result.extractedData) {
          return {
            success: true,
            filename: file.name,
            data: result.extractedData,
          };
        } else {
          return {
            success: false,
            filename: file.name,
            error: 'No data extracted from invoice',
          };
        }
      } catch (error) {
        return {
          success: false,
          filename: file.name,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to process invoice',
        };
      }
    },
    []
  );

  const processBatch = useCallback(
    async (files: File[]) => {
      setIsProcessing(true);
      setProcessingFiles(files);
      setCompletedCount(0);
      setResults([]);

      const batchResults: BatchUploadResult[] = [];

      // Process files sequentially to avoid overwhelming the server
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);

        const result = await processFile(file);
        batchResults.push(result);

        setCompletedCount(i + 1);
        onProgress(i + 1, files.length);

        // Small delay between files to be gentle on the server
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setResults(batchResults);
      setIsProcessing(false);
      setProcessingFiles([]);
      onBatchComplete(batchResults);
    },
    [processFile, onProgress, onBatchComplete]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        processBatch(acceptedFiles);
      }
    },
    [processBatch]
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
    multiple: true, // Enable multiple file selection
    maxFiles: 20, // Limit to 20 files per batch
    maxSize: 10 * 1024 * 1024, // 10MB per file
    disabled: isProcessing,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return (
    <div className={`space-y-6 ${className}`}>
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
              Processing {completedCount} of {processingFiles.length}{' '}
              invoices...
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(completedCount / processingFiles.length) * 100}%`,
                }}
              ></div>
            </div>
            <div className="text-sm text-gray-500">
              {processingFiles[completedCount - 1]?.name || 'Processing...'}
            </div>
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
                {isDragActive
                  ? 'Drop invoices here'
                  : 'Upload Multiple Invoices'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Drag & drop or click to select multiple files
              </p>
            </div>
            <div className="text-xs text-gray-400">
              Supports PDF, JPG, PNG, TIFF, GIF, BMP (max 20 files, 10MB each)
            </div>
          </div>
        )}
      </div>

      {/* Processing Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Batch Processing Results
            </h3>
            <div className="flex space-x-4 text-sm">
              <span className="text-green-600">
                ✅ {successCount} successful
              </span>
              {errorCount > 0 && (
                <span className="text-red-600">❌ {errorCount} failed</span>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  result.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      result.success ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  ></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {result.filename}
                    </p>
                    {result.data && (
                      <p className="text-xs text-gray-500">
                        {result.data.vendor} • {result.data.currency}{' '}
                        {result.data.totalAmount?.toFixed(2)}
                      </p>
                    )}
                    {result.error && (
                      <p className="text-xs text-red-600">{result.error}</p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {result.data?.processingMethod || 'Failed'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Batch Processing</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Upload up to 20 invoices at once</li>
            <li>• Sequential processing for reliability</li>
            <li>• Real-time progress tracking</li>
            <li>• Individual file status reporting</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Smart Features</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Automatic format detection</li>
            <li>• Error recovery and fallbacks</li>
            <li>• Processing method optimization</li>
            <li>• Batch result summary</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export type { BatchUploadResult, ParsedInvoiceData };
