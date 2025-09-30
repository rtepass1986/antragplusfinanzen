'use client';

import BankStatementReviewModal from '@/components/bank/BankStatementReviewModal';
import BankStatementUploader from '@/components/bank/BankStatementUploader';
import TopNavigation from '@/components/layout/TopNavigation';
import {
  AIAnalysisResult,
  BankTransaction as AITransaction,
  BankStatementData,
} from '@/lib/ai/bank-statement-analyzer';
import { invoiceStorage } from '@/lib/invoiceStorage';
import { useEffect, useState } from 'react';

interface BankTransaction {
  id: string;
  description: string;
  bankAccount: string;
  category: string;
  project: string;
  paymentDate: string;
  amount: number;
  isCategorized: boolean;
}

export default function BankPage() {
  const [activeTab, setActiveTab] = useState<
    'all-transactions' | 'categorization' | 'import'
  >('all-transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);

  // AI Statement Processing State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [statementData, setStatementData] = useState<BankStatementData | null>(
    null
  );
  const [analysisData, setAnalysisData] = useState<AIAnalysisResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Projects data - will be loaded from API/database
  const [projects] = useState<
    Array<{ id: string; name: string; code?: string }>
  >([]);

  useEffect(() => {
    loadBankData();
  }, []);

  const loadBankData = () => {
    const invoices = invoiceStorage.getAllInvoices();

    // Convert invoices to bank transactions
    const bankTransactions: BankTransaction[] = invoices
      .filter(invoice => invoice.status === 'paid')
      .map(invoice => ({
        id: invoice.id,
        description: `${invoice.extractedData.vendor} - ${invoice.extractedData.invoiceNumber}`,
        bankAccount: 'VereinsKonto - DE11100500000190443545', // Default account
        category: invoice.category || 'Zu kategorisieren',
        project: invoice.project || 'Zuordnen',
        paymentDate: invoice.paidAt
          ? new Date(invoice.paidAt).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : 'Unbekannt',
        amount: -invoice.extractedData.totalAmount, // Negative for expenses
        isCategorized:
          !!invoice.category && invoice.category !== 'Zu kategorisieren',
      }));

    setTransactions(bankTransactions);
  };

  const categorizedCount = transactions.filter(t => t.isCategorized).length;
  const totalCount = transactions.length;
  const categorizationPercentage = Math.round(
    (categorizedCount / totalCount) * 100
  );

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch =
      transaction.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'categorized' && transaction.isCategorized) ||
      (filterType === 'uncategorized' && !transaction.isCategorized);
    const matchesProject =
      projectFilter === 'all' ||
      (projectFilter === 'unassigned' && transaction.project === 'Zuordnen') ||
      transaction.project === projectFilter;

    return matchesSearch && matchesFilter && matchesProject;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount));
  };

  // AI Statement Processing Handlers
  const handleStatementProcessed = (
    statement: BankStatementData,
    analysis: AIAnalysisResult
  ) => {
    setStatementData(statement);
    setAnalysisData(analysis);
    setShowReviewModal(true);
    setError(null);
  };

  const handleStatementError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleSaveTransactions = async (transactions: AITransaction[]) => {
    try {
      // In production, this would save to the database
      console.log('Saving transactions:', transactions);

      // For now, just add to local state
      const newTransactions = transactions.map(tx => ({
        id: tx.id,
        description: tx.description,
        bankAccount: 'VereinsKonto - DE11100500000190443545',
        category: tx.category || 'Zu kategorisieren',
        project: 'Zuordnen',
        paymentDate: new Date(tx.date).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        amount: tx.type === 'income' ? tx.amount : -tx.amount,
        isCategorized: !!tx.category && tx.category !== 'Zu kategorisieren',
      }));

      setTransactions(prev => [...prev, ...newTransactions]);
      setShowReviewModal(false);
      setActiveTab('all-transactions');

      // Show success message
      alert(`Successfully imported ${transactions.length} transactions!`);
    } catch (err) {
      console.error('Error saving transactions:', err);
      alert('Error saving transactions. Please try again.');
    }
  };

  const handleCloseReviewModal = () => {
    setShowReviewModal(false);
    setStatementData(null);
    setAnalysisData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation activeTab="bank" />

      {/* Main Content */}
      <div className="p-6">
        {/* Action Buttons */}
        <div className="flex items-center space-x-4 mb-6">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Regeln verwalten
          </button>
          <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Banken verwalten
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            AI Statement Import
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center space-x-8 mb-6">
          <button
            onClick={() => setActiveTab('all-transactions')}
            className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'all-transactions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Alle Vorgänge
          </button>
          <button
            onClick={() => setActiveTab('categorization')}
            className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'categorization'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Kategorisierung
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'import'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            AI Import
          </button>
        </div>

        {activeTab === 'categorization' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Kategorisierungsfortschritt
            </h3>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Fortschritt
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {categorizationPercentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${categorizationPercentage}%` }}
                  ></div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">
                    {categorizedCount}
                  </span>{' '}
                  von {totalCount} kategorisiert
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="space-y-6">
            {/* AI Statement Upload Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                AI-Powered Bank Statement Import
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Upload your bank statement (CSV, XLS, XLSX, or PDF) and let AI
                automatically categorize and process your transactions. All
                formats are now fully supported!
              </p>

              <BankStatementUploader
                onStatementProcessed={handleStatementProcessed}
                onError={handleStatementError}
              />

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
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
                        Error
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Features Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-medium text-gray-900">
                    Smart Categorization
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  AI automatically categorizes transactions based on description
                  patterns and learns from your preferences.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                      />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-medium text-gray-900">
                    Duplicate Detection
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  Automatically detects and flags potential duplicate
                  transactions to prevent double-counting.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-medium text-gray-900">
                    Anomaly Detection
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  Identifies unusual transactions, amounts, or patterns that may
                  require manual review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Suchen"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex space-x-3">
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">Alle Vorgänge</option>
                <option value="categorized">Kategorisiert</option>
                <option value="uncategorized">Nicht kategorisiert</option>
              </select>

              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">Alle Projekte</option>
                <option value="unassigned">Nicht zugeordnet</option>
                {projects.map(project => (
                  <option key={project.id} value={project.name}>
                    {project.code ? `${project.code} - ` : ''}
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Beschreibung
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bankkonto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Projekt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zahlungsdatum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Betrag
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center">
                        <svg
                          className="w-12 h-12 text-gray-400 mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                        <p className="text-lg font-medium text-gray-900 mb-2">
                          Keine Bankvorgänge verfügbar
                        </p>
                        <p className="text-gray-600">
                          {searchTerm || filterType !== 'all'
                            ? 'Versuchen Sie andere Suchbegriffe oder Filter'
                            : 'Zahlen Sie Rechnungen, um Bankvorgänge zu sehen'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(transaction => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {transaction.description}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {transaction.bankAccount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            transaction.isCategorized
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {transaction.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {transaction.project}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {transaction.paymentDate}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-medium ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {transaction.amount < 0 ? '-' : '+'}
                          {formatCurrency(transaction.amount)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bank Statement Review Modal */}
      {statementData && analysisData && (
        <BankStatementReviewModal
          isOpen={showReviewModal}
          onClose={handleCloseReviewModal}
          statementData={statementData}
          analysis={analysisData}
          onSave={handleSaveTransactions}
        />
      )}
    </div>
  );
}
