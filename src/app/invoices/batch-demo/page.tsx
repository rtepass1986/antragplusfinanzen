'use client';

import BatchInvoiceUploader, {
  BatchUploadResult,
  ParsedInvoiceData,
} from '@/components/invoice-import/BatchInvoiceUploader';
import { useState } from 'react';

export default function BatchInvoiceDemo() {
  const [batchResults, setBatchResults] = useState<BatchUploadResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<any[]>([]);

  const handleBatchComplete = async (results: BatchUploadResult[]) => {
    setBatchResults(results);

    // Auto-save successful invoices
    const successfulInvoices = results
      .filter(r => r.success && r.data)
      .map(r => r.data!);

    if (successfulInvoices.length > 0) {
      await saveInvoices(successfulInvoices);
    }
  };

  const handleProgress = (completed: number, total: number) => {
    console.log(`Progress: ${completed}/${total}`);
  };

  const saveInvoices = async (invoices: ParsedInvoiceData[]) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/invoices/batch-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoices }),
      });

      const result = await response.json();
      setSaveResults(result.results || []);

      if (result.success) {
        console.log(`Saved ${result.summary.successful} invoices successfully`);
      }
    } catch (error) {
      console.error('Error saving invoices:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetDemo = () => {
    setBatchResults([]);
    setSaveResults([]);
  };

  const successCount = batchResults.filter(r => r.success).length;
  const errorCount = batchResults.filter(r => !r.success).length;
  const saveSuccessCount = saveResults.filter(r => r.success).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Batch Invoice Processing Demo
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Upload and process multiple invoices simultaneously
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload Multiple Invoices
              </h2>
              <BatchInvoiceUploader
                onBatchComplete={handleBatchComplete}
                onProgress={handleProgress}
              />
            </div>

            {/* Save Status */}
            {isSaving && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-blue-800">
                    Saving invoices to database...
                  </span>
                </div>
              </div>
            )}

            {/* Save Results */}
            {saveResults.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Database Save Results
                </h3>
                <div className="space-y-2">
                  {saveResults.map((result, index) => (
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
                          {result.invoiceId && (
                            <p className="text-xs text-gray-500">
                              Invoice ID: {result.invoiceId}
                            </p>
                          )}
                          {result.error && (
                            <p className="text-xs text-red-600">
                              {result.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {result.success ? 'Saved' : 'Failed'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {batchResults.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Processing Results
                  </h2>
                  <button
                    onClick={resetDemo}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Process New Batch
                  </button>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {batchResults.length}
                    </div>
                    <div className="text-sm text-gray-500">Total Files</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {successCount}
                    </div>
                    <div className="text-sm text-gray-500">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {errorCount}
                    </div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </div>
                </div>

                {/* Detailed Results */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {batchResults.map((result, index) => (
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
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {result.filename}
                          </p>
                          {result.data && (
                            <div className="text-xs text-gray-500 mt-1">
                              <p>{result.data.vendor}</p>
                              <p>
                                {result.data.currency}{' '}
                                {result.data.totalAmount?.toFixed(2)} •
                                {result.data.processingMethod}
                              </p>
                            </div>
                          )}
                          {result.error && (
                            <p className="text-xs text-red-600 mt-1">
                              {result.error}
                            </p>
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
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
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
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No invoices processed
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload multiple invoices to see the batch processing results
                    here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Overview */}
        <div className="mt-12 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Batch Processing Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-blue-600"
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
              <h3 className="text-lg font-medium text-gray-900">
                Multi-File Upload
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Upload up to 20 invoices at once with drag & drop support.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">
                Sequential Processing
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Reliable processing with real-time progress tracking and error
                handling.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Auto-Save</h3>
              <p className="text-sm text-gray-500 mt-1">
                Automatically saves successful invoices to the database with
                line items.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
