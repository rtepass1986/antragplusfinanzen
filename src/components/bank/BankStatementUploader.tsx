'use client';

import {
  AIAnalysisResult,
  BankStatementData,
  bankStatementAnalyzer,
} from '@/lib/ai/bank-statement-analyzer';
import { useState } from 'react';

interface BankStatementUploaderProps {
  companyId?: string;
  bankAccountId?: string;
  saveToDatabase?: boolean;
  onStatementProcessed: (
    statementData: BankStatementData,
    analysis: AIAnalysisResult
  ) => void;
  onError: (error: string) => void;
}

export default function BankStatementUploader({
  companyId,
  bankAccountId,
  saveToDatabase = false,
  onStatementProcessed,
  onError,
}: BankStatementUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setUploadProgress(0);
    setSelectedFile(file);

    try {
      // Validate file type
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          'Unsupported file type. Please upload CSV, XLS, XLSX, or PDF files.'
        );
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          'File size too large. Please upload files smaller than 10MB.'
        );
      }

      setUploadProgress(10);
      setProcessingStage('Uploading file...');

      let statementData: BankStatementData;
      let analysis: AIAnalysisResult;

      if (file.type === 'application/pdf') {
        // Process PDF via API endpoint (uses AWS Textract + AI)
        setProcessingStage('Extracting text with AWS Textract...');
        setUploadProgress(20);

        const formData = new FormData();
        formData.append('file', file);
        if (companyId) {
          formData.append('companyId', companyId);
        }
        if (bankAccountId) {
          formData.append('bankAccountId', bankAccountId);
        }
        if (saveToDatabase) {
          formData.append('saveToDatabase', 'true');
        }

        const response = await fetch('/api/bank/process-statement', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to process PDF');
        }

        const result = await response.json();
        statementData = result.statementData;
        analysis = result.analysis;

        setUploadProgress(100);
        setProcessingStage('Processing complete!');
      } else if (file.type === 'text/csv') {
        // Process CSV file
        setProcessingStage('Parsing CSV file...');
        const csvContent = await file.text();
        statementData = bankStatementAnalyzer.parseCSVStatement(csvContent);

        setUploadProgress(40);
        setProcessingStage('Analyzing with AI...');

        // Analyze the statement with AI
        analysis = await bankStatementAnalyzer.analyzeBankStatement(
          statementData,
          companyId
        );

        setUploadProgress(70);

        // Save to database if requested
        if (saveToDatabase && companyId) {
          setProcessingStage('Saving to database...');
          await saveViaAPI(file);
        }

        setUploadProgress(100);
        setProcessingStage('Processing complete!');
      } else if (
        file.type === 'application/vnd.ms-excel' ||
        file.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        // Process Excel file
        setProcessingStage('Parsing Excel file...');
        const excelBuffer = Buffer.from(await file.arrayBuffer());
        statementData = bankStatementAnalyzer.parseXLSStatement(excelBuffer);

        setUploadProgress(40);
        setProcessingStage('Analyzing with AI...');

        // Analyze the statement with AI
        analysis = await bankStatementAnalyzer.analyzeBankStatement(
          statementData,
          companyId
        );

        setUploadProgress(70);

        // Save to database if requested
        if (saveToDatabase && companyId) {
          setProcessingStage('Saving to database...');
          await saveViaAPI(file);
        }

        setUploadProgress(100);
        setProcessingStage('Processing complete!');
      } else {
        throw new Error(
          'Unsupported file type. Please upload CSV, XLS, XLSX, or PDF files.'
        );
      }

      // Pass the processed data to parent component
      onStatementProcessed(statementData, analysis);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An error occurred during processing';
      onError(errorMessage);
      console.error('Bank statement processing error:', err);
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
      setSelectedFile(null);
      setProcessingStage('');
    }
  };

  const saveViaAPI = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    if (companyId) {
      formData.append('companyId', companyId);
    }
    if (bankAccountId) {
      formData.append('bankAccountId', bankAccountId);
    }
    formData.append('saveToDatabase', 'true');

    const response = await fetch('/api/bank/process-statement', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save to database');
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
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv,.xls,.xlsx,.pdf"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto">
              <svg
                className="animate-spin h-12 w-12 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Processing Bank Statement
              </p>
              <p className="text-sm text-gray-600 mt-1">{selectedFile?.name}</p>
              {processingStage && (
                <p className="text-xs text-blue-600 mt-2">{processingStage}</p>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">{uploadProgress}% complete</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto text-gray-400">
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
              <p className="text-lg font-medium text-gray-900">
                Upload Bank Statement
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Drag and drop your bank statement file here, or click to browse
              </p>
            </div>
            <div className="text-xs text-gray-500">
              <p>Supported formats: CSV, XLS, XLSX, PDF</p>
              <p>Maximum file size: 10MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Features List */}
      <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">
          🤖 AI-Powered Features:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex items-start space-x-2">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-xs text-blue-800">
              Bank format detection (Deutsche Bank, Sparkasse, N26, etc.)
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-xs text-blue-800">
              Automatic currency detection
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-xs text-blue-800">
              Smart counterparty extraction
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-xs text-blue-800">
              Transaction categorization
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-xs text-blue-800">Duplicate detection</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-xs text-blue-800">Anomaly detection</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-xs text-blue-800">
              Invoice reconciliation
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600 font-bold">✓</span>
            <span className="text-xs text-blue-800">
              Multi-page PDF support
            </span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-amber-900 mb-2">
          📋 How to prepare your bank statement:
        </h3>
        <ul className="text-xs text-amber-800 space-y-1">
          <li>• Export your bank statement as CSV, Excel, or PDF format</li>
          <li>
            • For CSV/Excel: Ensure columns include Date, Description, Amount
          </li>
          <li>
            • For PDF: Any standard bank statement format (AI will extract
            everything)
          </li>
          <li>
            • Supported banks: Deutsche Bank, Sparkasse, N26, Commerzbank, ING,
            and more
          </li>
        </ul>
      </div>
    </div>
  );
}
