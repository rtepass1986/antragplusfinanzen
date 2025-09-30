'use client';

import { useState } from 'react';

interface PaymentDocument {
  id: string;
  status: 'exported' | 'pending' | 'paid';
  businessPartner: string;
  bankAccount: string;
  invoiceNumber: string;
  dueDate: string;
  totalAmount: string;
  discount: string;
  isSelected: boolean;
}

export default function PaymentsPage() {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [bankAccount, setBankAccount] = useState('');

  // Mock data - in real app this would come from API
  const paymentDocuments: PaymentDocument[] = [
    {
      id: '1',
      status: 'exported',
      businessPartner: 'Nicole und F...',
      bankAccount: 'DE72 2004 1144 0000 0000 61 08',
      invoiceNumber: 'Ausl... der',
      dueDate: '29.03.2024',
      totalAmount: '56,08 €',
      discount: '-',
      isSelected: true,
    },
    {
      id: '2',
      status: 'exported',
      businessPartner: 'Lennart Mar...',
      bankAccount: 'DE63 2004 1144 0000 0000 74 31',
      invoiceNumber: 'Sch... ung',
      dueDate: '31.12.2027',
      totalAmount: '164,74 €',
      discount: '-',
      isSelected: true,
    },
  ];

  const totalAmount = paymentDocuments
    .filter(doc => doc.isSelected)
    .reduce(
      (sum, doc) =>
        sum +
        parseFloat(doc.totalAmount.replace('€', '').replace(',', '.').trim()),
      0
    );

  const handleSelectAll = () => {
    if (selectedDocuments.length === paymentDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(paymentDocuments.map(doc => doc.id));
    }
  };

  const handleDocumentSelect = (documentId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-display">
              Zahlungen
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Verwalten Sie Ihre Zahlungen und SEPA-Exporte
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-6 p-6">
        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {/* Payable Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Zahlbar
            </h2>
            <p className="text-sm text-gray-600 mb-4">2 Dokumente</p>

            {/* Payment History Placeholder */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-green-600"
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
                </div>
                <div className="h-px bg-gray-300 flex-1"></div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-green-600"
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
                </div>
                <div className="h-px bg-gray-300 flex-1"></div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-green-600"
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
                </div>
                <div className="h-px bg-gray-300 flex-1"></div>
              </div>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Hier erscheint die Zahlungshistorie, sobald Rechnungen bezahlt
              wurden.
            </p>
          </div>

          {/* Documents to Transfer */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              2 zu überweisende Dokumente
            </h2>

            {/* DATEV Transfer Banner */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-purple-900 mb-2">
                    Übertrage Zahlungsdaten nach DATEV
                  </h3>
                  <p className="text-sm text-purple-700 mb-3">
                    Hinterlege vollständige Zahlungsdaten in Candis und
                    übertrage sie nach DATEV Rechnungswesen
                  </p>
                  <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    Mehr erfahren
                  </button>
                </div>
                <button className="ml-4 text-purple-400 hover:text-purple-600">
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">2 von 2 ausgewählt</span>
              <button
                onClick={handleSelectAll}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Auswahl aufheben
              </button>
            </div>

            {/* Documents Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedDocuments.length === paymentDocuments.length
                        }
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Geschäftspartner
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bankkonto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rechnungsnummer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fälligkeitsdatum
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gesamtbetrag
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Skonto
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentDocuments.map(document => (
                    <tr
                      key={document.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(document.id)}
                          onChange={() => handleDocumentSelect(document.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Exportiert
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {document.businessPartner}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-mono">
                          {document.bankAccount}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {document.invoiceNumber}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {document.dueDate}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {document.totalAmount}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {document.discount}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Help Text */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-2">
                Du findest deine zu zahlenden Dokumente hier nicht?
                <button className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                  Erfahre warum
                </button>
              </p>
              <p className="text-xs text-gray-500">
                Zahlung aktiviert ab 06.02.2024
              </p>
            </div>
          </div>
        </div>

        {/* Right Sidebar - New Payment */}
        <div className="w-80 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Neue Zahlung
            </h2>

            {/* Bank Account Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zu belastendes Bankkonto
              </label>
              <input
                type="text"
                value={bankAccount}
                onChange={e => setBankAccount(e.target.value)}
                placeholder="IBAN eingeben"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Add Bank Account Section */}
            {!bankAccount && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-2">
                  Jetzt ein Bankkonto hinterlegen
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Gib die IBAN des zu belastenden Kontos an und speichere diese.
                </p>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Konto hinzufügen
                </button>
              </div>
            )}

            {/* SEPA Export */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
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
                <div>
                  <h3 className="font-medium text-gray-900">SEPA XML</h3>
                  <p className="text-sm text-gray-600">SEPA-XML-Export</p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-3">
                Zusammenfassung
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">2 Dokumente ausgewählt</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-900">Zahlungssumme:</span>
                  <span className="text-gray-900">
                    {totalAmount.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div className="space-y-3">
              {!bankAccount && (
                <p className="text-xs text-gray-500 text-center">
                  Gib ein zu belastendes Bankkonto an
                </p>
              )}
              <button
                disabled={!bankAccount}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  bankAccount
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                SEPA-XML exportieren
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
