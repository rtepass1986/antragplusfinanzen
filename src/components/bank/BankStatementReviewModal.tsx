'use client';

import {
  AIAnalysisResult,
  BankStatementData,
  BankTransaction,
} from '@/lib/ai/bank-statement-analyzer';
import { useEffect, useState } from 'react';

interface BankStatementReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  statementData: BankStatementData;
  analysis: AIAnalysisResult;
  onSave: (transactions: BankTransaction[]) => void;
}

export default function BankStatementReviewModal({
  isOpen,
  onClose,
  statementData,
  analysis,
  onSave,
}: BankStatementReviewModalProps) {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(
    new Set()
  );
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && statementData) {
      // Apply AI suggestions to transactions
      const updatedTransactions = statementData.transactions.map(
        transaction => {
          const categorySuggestion = analysis.suggestedCategories.find(
            cat => cat.transactionId === transaction.id
          );
          const counterpartyMapping = analysis.counterpartyMapping.find(
            mapping => mapping.originalDescription === transaction.description
          );

          return {
            ...transaction,
            category: categorySuggestion?.category || transaction.category,
            subcategory:
              categorySuggestion?.subcategory || transaction.subcategory,
            counterparty:
              counterpartyMapping?.suggestedCounterparty ||
              transaction.counterparty,
          };
        }
      );

      setTransactions(updatedTransactions);
    }
  }, [isOpen, statementData, analysis]);

  const handleCategoryChange = (
    transactionId: string,
    category: string,
    subcategory?: string
  ) => {
    setTransactions(prev =>
      prev.map(tx =>
        tx.id === transactionId ? { ...tx, category, subcategory } : tx
      )
    );
  };

  const handleCounterpartyChange = (
    transactionId: string,
    counterparty: string
  ) => {
    setTransactions(prev =>
      prev.map(tx => (tx.id === transactionId ? { ...tx, counterparty } : tx))
    );
  };

  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(tx => tx.id)));
    }
  };

  const handleBulkCategoryChange = (category: string, subcategory?: string) => {
    setTransactions(prev =>
      prev.map(tx =>
        selectedTransactions.has(tx.id) ? { ...tx, category, subcategory } : tx
      )
    );
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch =
      transaction.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transaction.counterparty
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === 'all' || transaction.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(transactions.map(tx => tx.category).filter(Boolean))
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Bank Statement Review
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {statementData.accountNumber &&
                  `Account: ${statementData.accountNumber}`}
                {statementData.statementPeriod &&
                  ` • Period: ${formatDate(statementData.statementPeriod.startDate)} - ${formatDate(statementData.statementPeriod.endDate)}`}
              </p>
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

        {/* Summary Stats */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(analysis.summary.totalIncome)}
              </p>
              <p className="text-sm text-gray-600">Total Income</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(analysis.summary.totalExpenses)}
              </p>
              <p className="text-sm text-gray-600">Total Expenses</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(analysis.summary.netCashFlow)}
              </p>
              <p className="text-sm text-gray-600">Net Cash Flow</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {analysis.summary.categorizationPercentage.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">Categorized</p>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {selectedTransactions.size === filteredTransactions.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              {selectedTransactions.size > 0 && (
                <div className="flex items-center space-x-2">
                  <select
                    onChange={e => handleBulkCategoryChange(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Bulk Category Change</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Software">Software</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Personnel">Personnel</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Travel">Travel</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Communication">Communication</option>
                    <option value="Training">Training</option>
                    <option value="Research">Research</option>
                    <option value="Development">Development</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Legal">Legal</option>
                    <option value="Accounting">Accounting</option>
                    <option value="Banking">Banking</option>
                    <option value="Taxes">Taxes</option>
                    <option value="Other Expenses">Other Expenses</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedTransactions.size ===
                          filteredTransactions.length &&
                        filteredTransactions.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Counterparty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(transaction.id)}
                        onChange={() => handleSelectTransaction(transaction.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div
                        className="max-w-xs truncate"
                        title={transaction.description}
                      >
                        {transaction.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        value={transaction.counterparty || ''}
                        onChange={e =>
                          handleCounterpartyChange(
                            transaction.id,
                            e.target.value
                          )
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Enter counterparty"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={transaction.category || ''}
                        onChange={e =>
                          handleCategoryChange(transaction.id, e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select Category</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Software">Software</option>
                        <option value="Hardware">Hardware</option>
                        <option value="Personnel">Personnel</option>
                        <option value="Consulting">Consulting</option>
                        <option value="Travel">Travel</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Rent">Rent</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Communication">Communication</option>
                        <option value="Training">Training</option>
                        <option value="Research">Research</option>
                        <option value="Development">Development</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Legal">Legal</option>
                        <option value="Accounting">Accounting</option>
                        <option value="Banking">Banking</option>
                        <option value="Taxes">Taxes</option>
                        <option value="Other Expenses">Other Expenses</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span
                        className={
                          transaction.type === 'income'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.balance
                        ? formatCurrency(transaction.balance)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredTransactions.length} transactions •{' '}
              {selectedTransactions.size} selected
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(transactions)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save Transactions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
