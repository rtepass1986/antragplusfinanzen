'use client';

import EnhancedInvoiceUploader, {
  ParsedInvoiceData,
} from '@/components/invoice-import/EnhancedInvoiceUploader';
import { useState } from 'react';

export default function InvoiceParseDemo() {
  const [parsedData, setParsedData] = useState<ParsedInvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInvoiceParsed = (data: ParsedInvoiceData) => {
    setParsedData(data);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setParsedData(null);
  };

  const resetDemo = () => {
    setParsedData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Enhanced Invoice Parsing Demo
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            AI-powered invoice processing with multiple extraction methods
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload Invoice
              </h2>
              <EnhancedInvoiceUploader
                onInvoiceParsed={handleInvoiceParsed}
                onError={handleError}
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Processing Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {parsedData ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Parsed Results
                  </h2>
                  <button
                    onClick={resetDemo}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Upload Another
                  </button>
                </div>

                {/* Processing Method Badge */}
                <div className="mb-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      parsedData.processingMethod === 'aws-textract'
                        ? 'bg-blue-100 text-blue-800'
                        : parsedData.processingMethod === 'openai-vision'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {parsedData.processingMethod === 'aws-textract' &&
                      'AWS Textract'}
                    {parsedData.processingMethod === 'openai-vision' &&
                      'OpenAI Vision'}
                    {parsedData.processingMethod === 'pdf-parse-fallback' &&
                      'PDF Parse Fallback'}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    Confidence: {Math.round(parsedData.ocrConfidence * 100)}%
                  </span>
                </div>

                {/* Invoice Details */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Vendor
                      </label>
                      <p className="text-sm text-gray-900">
                        {parsedData.vendor || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Invoice Number
                      </label>
                      <p className="text-sm text-gray-900">
                        {parsedData.invoiceNumber || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Invoice Date
                      </label>
                      <p className="text-sm text-gray-900">
                        {parsedData.invoiceDate || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Due Date
                      </label>
                      <p className="text-sm text-gray-900">
                        {parsedData.dueDate || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Subtotal
                      </label>
                      <p className="text-sm text-gray-900">
                        {parsedData.currency}{' '}
                        {parsedData.subtotal?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Tax
                      </label>
                      <p className="text-sm text-gray-900">
                        {parsedData.currency}{' '}
                        {parsedData.taxAmount?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Total
                      </label>
                      <p className="text-lg font-semibold text-gray-900">
                        {parsedData.currency}{' '}
                        {parsedData.totalAmount?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Line Items */}
                  {parsedData.lineItems && parsedData.lineItems.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">
                        Line Items
                      </label>
                      <div className="space-y-2">
                        {parsedData.lineItems.map((item, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center py-2 border-b border-gray-100"
                          >
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">
                                {item.description}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.quantity} × {parsedData.currency}{' '}
                                {item.unitPrice?.toFixed(2)}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                              {parsedData.currency}{' '}
                              {item.totalPrice?.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project Suggestions */}
                  {parsedData.projectSuggestions &&
                    parsedData.projectSuggestions.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Project Suggestions
                        </label>
                        <div className="space-y-2">
                          {parsedData.projectSuggestions.map(
                            (suggestion, index) => (
                              <div
                                key={index}
                                className="p-3 bg-gray-50 rounded-lg"
                              >
                                <p className="text-sm font-medium text-gray-900">
                                  {suggestion.projectName}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {suggestion.reasoning}
                                </p>
                                <div className="mt-1 flex items-center">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full"
                                      style={{
                                        width: `${suggestion.confidence * 100}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <span className="ml-2 text-xs text-gray-500">
                                    {Math.round(suggestion.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
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
                    No invoice processed
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload an invoice to see the parsed results here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Overview */}
        <div className="mt-12 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            System Features
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
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">
                AI-Powered Extraction
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Uses AWS Textract and OpenAI Vision for accurate text
                recognition and data extraction.
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
                Multiple Fallbacks
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Automatic fallback to pdf-parse and heuristics if primary AI
                methods fail.
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
              <h3 className="text-lg font-medium text-gray-900">
                Smart Analysis
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Intelligent project suggestions, duplicate detection, and
                confidence scoring.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
