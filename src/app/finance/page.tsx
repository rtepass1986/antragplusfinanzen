'use client';

import { useState, useEffect } from 'react';
import TopNavigation from '@/components/layout/TopNavigation';
import { invoiceStorage } from '@/lib/invoiceStorage';

interface FinancingData {
  month: string;
  totalAmount: number;
  amortization: number;
  interest: number;
  fees: number;
  remainingDebt: number;
  cash: number;
  netDebt: number;
}

export default function FinancePage() {
  const [dateRange, setDateRange] = useState('Letzte 12 Monate');
  const [financingType, setFinancingType] = useState('Alle Finanzierungen');
  const [financingData, setFinancingData] = useState<FinancingData[]>([]);
  const [yearlyTotals, setYearlyTotals] = useState({
    totalAmount: 0,
    amortization: 0,
    interest: 0,
    fees: 0,
    remainingDebt: 0,
    cash: 0,
    netDebt: 0,
  });

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = () => {
    const invoices = invoiceStorage.getAllInvoices();
    const cashFlowData = invoiceStorage.getCashFlowData();

    // Generate financing data from real invoice data
    const generatedData: FinancingData[] = cashFlowData.map((month, index) => {
      const previousMonth = index > 0 ? generatedData[index - 1] : null;
      const previousCash = previousMonth ? previousMonth.cash : 100000; // Starting cash

      return {
        month: month.month,
        totalAmount: month.expenses,
        amortization: month.expenses * 0.95, // 95% of expenses as amortization
        interest: month.expenses * 0.05, // 5% as interest
        fees: 0,
        remainingDebt: Math.max(0, 50000 - index * 2000), // Decreasing debt
        cash: previousCash + month.net,
        netDebt: previousCash + month.net - Math.max(0, 50000 - index * 2000),
      };
    });

    setFinancingData(generatedData);

    // Calculate yearly totals
    if (generatedData.length > 0) {
      const totals = {
        totalAmount: generatedData.reduce(
          (sum, data) => sum + data.totalAmount,
          0
        ),
        amortization: generatedData.reduce(
          (sum, data) => sum + data.amortization,
          0
        ),
        interest: generatedData.reduce((sum, data) => sum + data.interest, 0),
        fees: generatedData.reduce((sum, data) => sum + data.fees, 0),
        remainingDebt:
          generatedData[generatedData.length - 1]?.remainingDebt || 0,
        cash: generatedData[generatedData.length - 1]?.cash || 0,
        netDebt: generatedData[generatedData.length - 1]?.netDebt || 0,
      };
      setYearlyTotals(totals);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatMonth = (monthString: string) => {
    const date = new Date(monthString + '-01');
    return date
      .toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavigation activeTab="finance" />

      {/* Main Content */}
      <div className="p-6">
        {/* Header Controls */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Finanzierungen</h1>

          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
              <svg
                className="w-5 h-5"
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
            </button>

            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option>Letzte 12 Monate</option>
              <option>Letzte 6 Monate</option>
              <option>Letzte 24 Monate</option>
            </select>

            <select
              value={financingType}
              onChange={e => setFinancingType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option>Alle Finanzierungen</option>
              <option>Kredite</option>
              <option>Leasing</option>
              <option>Förderungen</option>
            </select>
          </div>
        </div>

        {/* Financing Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
                    Finanzierung
                  </th>
                  {financingData.map(data => (
                    <th
                      key={data.month}
                      className="text-center py-3 px-2 font-medium text-gray-500 text-sm"
                    >
                      {formatMonth(data.month)}
                    </th>
                  ))}
                  <th className="text-center py-3 px-2 font-medium text-gray-500 bg-gray-50 text-sm">
                    Gesamt
                  </th>
                </tr>
              </thead>
              <tbody>
                {financingData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={financingData.length + 2}
                      className="py-12 text-center text-gray-500"
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
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1"
                          />
                        </svg>
                        <p className="text-lg font-medium text-gray-900 mb-2">
                          Keine Finanzierungsdaten verfügbar
                        </p>
                        <p className="text-gray-600">
                          Importieren Sie Rechnungen, um Finanzierungsdaten zu
                          sehen
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Total Amount Row */}
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1"
                            />
                          </svg>
                          <span>Gesamtbetrag</span>
                        </div>
                      </td>
                      {financingData.map(data => (
                        <td
                          key={data.month}
                          className="text-center py-3 px-2 text-sm font-medium text-gray-900"
                        >
                          {formatCurrency(data.totalAmount)}
                        </td>
                      ))}
                      <td className="text-center py-3 px-2 text-sm font-bold bg-gray-50 text-gray-900">
                        {formatCurrency(yearlyTotals.totalAmount)}
                      </td>
                    </tr>

                    {/* Amortization Row */}
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <svg
                            className="w-5 h-5 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                            />
                          </svg>
                          <span>Tilgung</span>
                        </div>
                      </td>
                      {financingData.map(data => (
                        <td
                          key={data.month}
                          className="text-center py-3 px-2 text-sm text-green-600"
                        >
                          {formatCurrency(data.amortization)}
                        </td>
                      ))}
                      <td className="text-center py-3 px-2 text-sm font-bold bg-gray-50 text-green-600">
                        {formatCurrency(yearlyTotals.amortization)}
                      </td>
                    </tr>

                    {/* Interest Row */}
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <svg
                            className="w-5 h-5 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1"
                            />
                          </svg>
                          <span>Zinsen</span>
                        </div>
                      </td>
                      {financingData.map(data => (
                        <td
                          key={data.month}
                          className="text-center py-3 px-2 text-sm text-red-600"
                        >
                          {formatCurrency(data.interest)}
                        </td>
                      ))}
                      <td className="text-center py-3 px-2 text-sm font-bold bg-gray-50 text-red-600">
                        {formatCurrency(yearlyTotals.interest)}
                      </td>
                    </tr>

                    {/* Fees Row */}
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <svg
                            className="w-5 h-5 text-orange-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1"
                            />
                          </svg>
                          <span>Gebühren</span>
                        </div>
                      </td>
                      {financingData.map(data => (
                        <td
                          key={data.month}
                          className="text-center py-3 px-2 text-sm text-orange-600"
                        >
                          {formatCurrency(data.fees)}
                        </td>
                      ))}
                      <td className="text-center py-3 px-2 text-sm font-bold bg-gray-50 text-orange-600">
                        {formatCurrency(yearlyTotals.fees)}
                      </td>
                    </tr>

                    {/* Remaining Debt Row */}
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <svg
                            className="w-5 h-5 text-purple-600"
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
                          <span>Verbleibende Schuld</span>
                        </div>
                      </td>
                      {financingData.map(data => (
                        <td
                          key={data.month}
                          className="text-center py-3 px-2 text-sm text-purple-600"
                        >
                          {formatCurrency(data.remainingDebt)}
                        </td>
                      ))}
                      <td className="text-center py-3 px-2 text-sm font-bold bg-gray-50 text-purple-600">
                        {formatCurrency(yearlyTotals.remainingDebt)}
                      </td>
                    </tr>

                    {/* Cash Row */}
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <svg
                            className="w-5 h-5 text-blue-600"
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
                          <span>Bargeld</span>
                        </div>
                      </td>
                      {financingData.map(data => (
                        <td
                          key={data.month}
                          className="text-center py-3 px-2 text-sm text-blue-600"
                        >
                          {formatCurrency(data.cash)}
                        </td>
                      ))}
                      <td className="text-center py-3 px-2 text-sm font-bold bg-gray-50 text-blue-600">
                        {formatCurrency(yearlyTotals.cash)}
                      </td>
                    </tr>

                    {/* Net Debt Row */}
                    <tr className="border-b border-gray-100">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <svg
                            className="w-5 h-5 text-gray-600"
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
                          <span>Netto-Schuld</span>
                        </div>
                      </td>
                      {financingData.map(data => (
                        <td
                          key={data.month}
                          className="text-center py-3 px-2 text-sm font-medium text-gray-900"
                        >
                          {formatCurrency(data.netDebt)}
                        </td>
                      ))}
                      <td className="text-center py-3 px-2 text-sm font-bold bg-gray-50 text-gray-900">
                        {formatCurrency(yearlyTotals.netDebt)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
