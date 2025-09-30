'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TopNavigation from '@/components/layout/TopNavigation';
import { invoiceStorage } from '@/lib/invoiceStorage';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    processingCount: 0,
    approvedCount: 0,
    paidCount: 0,
  });

  useEffect(() => {
    loadStats();
    // Refresh stats every 5 seconds to show real-time updates
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = () => {
    const invoiceStats = invoiceStorage.getStats();
    setStats({
      totalInvoices: invoiceStats.total,
      totalAmount: invoiceStats.totalAmount,
      processingCount: invoiceStats.processing,
      approvedCount: invoiceStats.approved,
      paidCount: invoiceStats.paid,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getRecentInvoices = () => {
    return invoiceStorage
      .getAllInvoices()
      .sort(
        (a, b) =>
          new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
      )
      .slice(0, 5);
  };

  const getProcessingInvoices = () => {
    return invoiceStorage.getProcessingInvoices();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation activeTab="liquidity" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">€</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Financial Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Übersicht über Ihre Finanzen und Rechnungen
              </p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Gesamt Rechnungen
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.totalInvoices}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  In Bearbeitung
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.processingCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Genehmigt</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.approvedCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
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
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Gesamtbetrag
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(stats.totalAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Meine Aufgaben */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Meine Aufgaben
            </h2>
            <Link
              href="/invoices/import"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Rechnung hochladen
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Processing Invoices */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  In Bearbeitung
                </h3>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {stats.processingCount}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Rechnungen warten auf Ihre Überprüfung und Bearbeitung
              </p>
              <Link
                href="/invoices"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
              >
                Alle anzeigen →
              </Link>
            </div>

            {/* Recent Invoices */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Neueste Rechnungen
                </h3>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {getRecentInvoices().length}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Zuletzt verarbeitete Rechnungen
              </p>
              <Link
                href="/invoices"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
              >
                Alle anzeigen →
              </Link>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Schnellaktionen
              </h3>
              <div className="space-y-3">
                <Link
                  href="/invoices/import"
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium text-center transition-colors"
                >
                  Rechnung importieren
                </Link>
                <Link
                  href="/cashflow"
                  className="block w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium text-center transition-colors"
                >
                  Cash Flow anzeigen
                </Link>
                <Link
                  href="/liquidity"
                  className="block w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium text-center transition-colors"
                >
                  Liquidität prüfen
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Invoices Management */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                Rechnungsverwaltung
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Verwalten Sie alle Ihre Rechnungen, von der Einreichung bis zur
              Zahlung
            </p>
            <div className="space-y-2">
              <Link
                href="/invoices"
                className="block text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
              >
                Alle Rechnungen anzeigen →
              </Link>
              <Link
                href="/invoices/import"
                className="block text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
              >
                Neue Rechnung importieren →
              </Link>
            </div>
          </div>

          {/* Cash Flow */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
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
              </div>
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                Cash Flow
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Überwachen Sie Ihre Ein- und Ausgaben mit detaillierten Analysen
            </p>
            <div className="space-y-2">
              <Link
                href="/cashflow"
                className="block text-green-600 hover:text-green-700 text-sm font-medium transition-colors"
              >
                Cash Flow Übersicht →
              </Link>
              <Link
                href="/cashflow/scenarios"
                className="block text-green-600 hover:text-green-700 text-sm font-medium transition-colors"
              >
                Szenarien planen →
              </Link>
            </div>
          </div>

          {/* Liquidity Management */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                Liquiditätsmanagement
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Behalten Sie den Überblick über Ihre Liquidität und Finanzplanung
            </p>
            <div className="space-y-2">
              <Link
                href="/liquidity"
                className="block text-purple-600 hover:text-purple-700 text-sm font-medium transition-colors"
              >
                Liquidität anzeigen →
              </Link>
              <Link
                href="/bank"
                className="block text-purple-600 hover:text-purple-700 text-sm font-medium transition-colors"
              >
                Bankkonten verwalten →
              </Link>
            </div>
          </div>

          {/* Business Partners */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                Geschäftspartner
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Verwalten Sie Ihre Lieferanten, Kunden und Geschäftspartner
            </p>
            <Link
              href="/business-partners"
              className="text-orange-600 hover:text-orange-700 text-sm font-medium transition-colors"
            >
              Partner verwalten →
            </Link>
          </div>

          {/* Approvals */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-indigo-600"
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
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                Genehmigungen
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Genehmigen Sie Rechnungen und Ausgaben nach Ihren Workflows
            </p>
            <Link
              href="/approvals"
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors"
            >
              Genehmigungen verwalten →
            </Link>
          </div>

          {/* Payments */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-emerald-600"
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
              </div>
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                Zahlungen
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Verwalten Sie Zahlungen und SEPA-Exporte
            </p>
            <Link
              href="/payments"
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
            >
              Zahlungen verwalten →
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        {getRecentInvoices().length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Letzte Aktivitäten
            </h3>
            <div className="space-y-3">
              {getRecentInvoices().map(invoice => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-blue-600"
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
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {invoice.extractedData.vendor} -{' '}
                        {invoice.extractedData.invoiceNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(invoice.processedAt).toLocaleDateString(
                          'de-DE'
                        )}{' '}
                        • {formatCurrency(invoice.extractedData.totalAmount)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      invoice.status === 'processing'
                        ? 'bg-yellow-100 text-yellow-800'
                        : invoice.status === 'reviewed'
                          ? 'bg-blue-100 text-blue-800'
                          : invoice.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {invoice.status === 'processing'
                      ? 'In Bearbeitung'
                      : invoice.status === 'reviewed'
                        ? 'Überprüft'
                        : invoice.status === 'approved'
                          ? 'Genehmigt'
                          : invoice.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link
                href="/invoices"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
              >
                Alle Aktivitäten anzeigen →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
