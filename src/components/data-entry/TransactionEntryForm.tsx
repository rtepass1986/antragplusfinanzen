'use client';

import { useEffect, useState } from 'react';

interface TransactionData {
  id?: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  category: string;
  subcategory?: string;
  date: string;
  dueDate?: string;
  reference?: string;
  bankAccount?: string;
  tags?: string[];
  recurring?: {
    enabled: boolean;
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    endDate?: string;
  };
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  confidence?: number;
}

interface TransactionEntryFormProps {
  onSave: (transaction: TransactionData) => void;
  initialData?: TransactionData;
  onCancel?: () => void;
}

const TransactionEntryForm: React.FC<TransactionEntryFormProps> = ({
  onSave,
  initialData,
  onCancel,
}) => {
  const [formData, setFormData] = useState<TransactionData>(
    initialData || {
      type: 'EXPENSE',
      amount: 0,
      description: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      status: 'PENDING',
      recurring: { enabled: false, frequency: 'MONTHLY' },
    }
  );

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;

    if (name.startsWith('recurring.')) {
      const recurringField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        recurring: {
          ...prev.recurring,
          [recurringField]: type === 'checkbox' ? checked : value,
        } as any,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);

    // Reset form after save if not editing
    if (!initialData) {
      setFormData({
        type: 'EXPENSE',
        amount: 0,
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        recurring: { enabled: false, frequency: 'MONTHLY' },
      });
    }
  };

  const categories = [
    'Büro & Verwaltung',
    'Marketing & Werbung',
    'Reisen & Transport',
    'Miete & Nebenkosten',
    'Software & IT',
    'Beratung & Dienstleistungen',
    'Versicherungen',
    'Steuern & Gebühren',
    'Sonstiges',
  ];

  const subcategories = {
    'Büro & Verwaltung': [
      'Büromaterial',
      'Post & Versand',
      'Telefon & Internet',
      'Büroausstattung',
    ],
    'Marketing & Werbung': [
      'Online-Werbung',
      'Print-Werbung',
      'Events',
      'Social Media',
    ],
    'Reisen & Transport': ['Flugreisen', 'Hotel', 'Mietwagen', 'Bahn', 'Taxi'],
    'Miete & Nebenkosten': ['Büromiete', 'Strom', 'Gas', 'Wasser', 'Heizung'],
    'Software & IT': [
      'Software-Lizenzen',
      'Cloud-Services',
      'Hardware',
      'Wartung',
    ],
    'Beratung & Dienstleistungen': [
      'Rechtsberatung',
      'Steuerberatung',
      'Buchhaltung',
      'Design',
    ],
    Versicherungen: [
      'Haftpflicht',
      'Berufshaftpflicht',
      'Büroinhaltsversicherung',
    ],
    'Steuern & Gebühren': [
      'Gewerbesteuer',
      'Umsatzsteuer',
      'Gebühren',
      'Abgaben',
    ],
    Sonstiges: ['Spenden', 'Reparaturen', 'Schulungen', 'Andere'],
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Type */}
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Transaktionstyp *
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="INCOME">Einnahme</option>
            <option value="EXPENSE">Ausgabe</option>
          </select>
        </div>

        {/* Amount */}
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Betrag (€) *
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            step="0.01"
            min="0"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Beschreibung *
          </label>
          <input
            type="text"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="z.B. Büromaterial, Rechnung #12345"
          />
        </div>

        {/* Category */}
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Kategorie *
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Kategorie wählen</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory */}
        <div>
          <label
            htmlFor="subcategory"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Unterkategorie
          </label>
          <select
            id="subcategory"
            name="subcategory"
            value={formData.subcategory || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={!formData.category}
          >
            <option value="">Unterkategorie wählen</option>
            {formData.category &&
              subcategories[
                formData.category as keyof typeof subcategories
              ]?.map(sub => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label
            htmlFor="date"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Datum *
          </label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Due Date */}
        <div>
          <label
            htmlFor="dueDate"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Fälligkeitsdatum
          </label>
          <input
            type="date"
            id="dueDate"
            name="dueDate"
            value={formData.dueDate || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Reference */}
        <div>
          <label
            htmlFor="reference"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Referenz
          </label>
          <input
            type="text"
            id="reference"
            name="reference"
            value={formData.reference || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="z.B. Rechnungsnummer, Vertragsnummer"
          />
        </div>

        {/* Bank Account */}
        <div>
          <label
            htmlFor="bankAccount"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Bankkonto
          </label>
          <select
            id="bankAccount"
            name="bankAccount"
            value={formData.bankAccount || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Bankkonto wählen</option>
            <option value="hauptkonto">Geschäftskonto Haupt</option>
            <option value="sparkonto">Sparkonto</option>
            <option value="kreditkarte">Kreditkarte</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="PENDING">Ausstehend</option>
            <option value="CONFIRMED">Bestätigt</option>
            <option value="CANCELLED">Storniert</option>
          </select>
        </div>

        {/* Tags */}
        <div className="md:col-span-2">
          <label
            htmlFor="tags"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Tags
          </label>
          <input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags?.join(', ') || ''}
            onChange={e => {
              const tags = e.target.value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag);
              setFormData(prev => ({ ...prev, tags }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="z.B. dringend, projekt-xyz, q1-2024"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tags durch Komma getrennt eingeben
          </p>
        </div>
      </div>

      {/* Recurring Transaction */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center mb-4">
          <input
            id="recurring.enabled"
            name="recurring.enabled"
            type="checkbox"
            checked={formData.recurring?.enabled || false}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="recurring.enabled"
            className="ml-2 block text-sm font-medium text-gray-900"
          >
            Wiederkehrende Transaktion
          </label>
        </div>

        {formData.recurring?.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
            <div>
              <label
                htmlFor="recurring.frequency"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Häufigkeit
              </label>
              <select
                id="recurring.frequency"
                name="recurring.frequency"
                value={formData.recurring?.frequency || 'MONTHLY'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="WEEKLY">Wöchentlich</option>
                <option value="MONTHLY">Monatlich</option>
                <option value="QUARTERLY">Vierteljährlich</option>
                <option value="YEARLY">Jährlich</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="recurring.endDate"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Enddatum (optional)
              </label>
              <input
                type="date"
                id="recurring.endDate"
                name="recurring.endDate"
                value={formData.recurring?.endDate || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Abbrechen
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {initialData ? 'Transaktion aktualisieren' : 'Transaktion hinzufügen'}
        </button>
      </div>
    </form>
  );
};

export default TransactionEntryForm;
