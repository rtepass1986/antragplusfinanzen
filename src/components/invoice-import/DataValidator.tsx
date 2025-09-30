'use client';

import { useState, useEffect } from 'react';
import { type InvoiceData, type InvoiceItem } from '@/lib/aws/textract';

interface DataValidatorProps {
  data: InvoiceData | null;
  onDataConfirmed: (data: InvoiceData) => void;
  onDataEdited: (data: InvoiceData) => void;
}

export default function DataValidator({
  data,
  onDataConfirmed,
  onDataEdited,
}: DataValidatorProps) {
  const [editedData, setEditedData] = useState<InvoiceData | null>(data);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setEditedData(data);
  }, [data]);

  if (!data) return null;

  const handleFieldChange = (
    field: keyof InvoiceData,
    value: string | number | Date
  ) => {
    if (!editedData) return;

    setEditedData({
      ...editedData,
      [field]: value,
    });
  };

  const handleItemChange = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    if (!editedData) return;

    const newItems = [...editedData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Recalculate totals if needed
    if (field === 'total' || field === 'unitPrice' || field === 'quantity') {
      // This could be enhanced with better calculation logic
    }

    setEditedData({
      ...editedData,
      items: newItems,
    });
  };

  const addItem = () => {
    if (!editedData) return;

    const newItem: InvoiceItem = {
      description: '',
      total: 0,
    };

    setEditedData({
      ...editedData,
      items: [...editedData.items, newItem],
    });
  };

  const removeItem = (index: number) => {
    if (!editedData) return;

    const newItems = editedData.items.filter((_, i) => i !== index);
    setEditedData({
      ...editedData,
      items: newItems,
    });
  };

  const handleConfirm = () => {
    if (editedData) {
      onDataConfirmed(editedData);
    }
  };

  const handleSaveInvoice = () => {
    if (editedData) {
      onDataConfirmed(editedData);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editedData) {
      onDataEdited(editedData);
      setIsEditing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 90) return 'Excellent';
    if (confidence >= 70) return 'Good';
    if (confidence >= 50) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        {/* Workflow Steps */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm font-medium">1</span>
              </div>
              <span className="text-sm text-gray-600">OCR Processing</span>
            </div>
            <div className="w-8 h-1 bg-gray-200"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm font-medium">2</span>
              </div>
              <span className="text-sm text-gray-600">Review & Edit</span>
            </div>
            <div className="w-8 h-1 bg-gray-200"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">3</span>
              </div>
              <span className="text-sm text-gray-600">Save Invoice</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Step 2: Review & Validate Extracted Data
            </h3>
            <div className="flex items-center space-x-3 mt-2">
              <span className="text-sm text-gray-600">OCR Confidence:</span>
              <span
                className={`text-sm font-medium ${getConfidenceColor(data.confidence)}`}
              >
                {getConfidenceText(data.confidence)} (
                {Math.round(data.confidence)}%)
              </span>
            </div>
          </div>
          <div className="flex space-x-3">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Save Changes
              </button>
            ) : (
              <button
                onClick={handleEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Edit Data
              </button>
            )}
            <button
              onClick={handleSaveInvoice}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
            >
              💾 Save Invoice
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Basic Information</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Number
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedData?.invoiceNumber || ''}
                onChange={e =>
                  handleFieldChange('invoiceNumber', e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                {data.invoiceNumber || 'Not detected'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            {isEditing ? (
              <input
                type="date"
                value={editedData?.date || ''}
                onChange={e => handleFieldChange('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                {data.date || 'Not detected'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            {isEditing ? (
              <input
                type="date"
                value={editedData?.dueDate || ''}
                onChange={e => handleFieldChange('dueDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                {data.dueDate || 'Not detected'}
              </p>
            )}
          </div>
        </div>

        {/* Customer Information */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Customer Information</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedData?.customerName || ''}
                onChange={e =>
                  handleFieldChange('customerName', e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                {data.customerName || 'Not detected'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Address
            </label>
            {isEditing ? (
              <textarea
                value={editedData?.customerAddress || ''}
                onChange={e =>
                  handleFieldChange('customerAddress', e.target.value)
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                {data.customerAddress || 'Not detected'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Items */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900">Invoice Items</h4>
          {isEditing && (
            <button
              onClick={addItem}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + Add Item
            </button>
          )}
        </div>

        <div className="space-y-3">
          {data.items.map((item, index) => (
            <div
              key={index}
              className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData?.items[index]?.description || ''}
                    onChange={e =>
                      handleItemChange(index, 'description', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Item description"
                  />
                ) : (
                  <p className="text-sm text-gray-900">
                    {item.description || 'No description'}
                  </p>
                )}
              </div>
              <div className="w-32">
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editedData?.items[index]?.total || 0}
                    onChange={e =>
                      handleItemChange(
                        index,
                        'total',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Amount"
                  />
                ) : (
                  <p className="text-sm text-gray-900 text-right">
                    €{item.total?.toFixed(2) || '0.00'}
                  </p>
                )}
              </div>
              {isEditing && (
                <button
                  onClick={() => removeItem(index)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="mt-6 border-t pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Financial Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subtotal
            </label>
            {isEditing ? (
              <input
                type="number"
                step="0.01"
                value={editedData?.subtotal || 0}
                onChange={e =>
                  handleFieldChange('subtotal', parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                €{data.subtotal?.toFixed(2) || '0.00'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Amount
            </label>
            {isEditing ? (
              <input
                type="number"
                step="0.01"
                value={editedData?.taxAmount || 0}
                onChange={e =>
                  handleFieldChange(
                    'taxAmount',
                    parseFloat(e.target.value) || 0
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                €{data.taxAmount?.toFixed(2) || '0.00'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total
            </label>
            {isEditing ? (
              <input
                type="number"
                step="0.01"
                value={editedData?.total || 0}
                onChange={e =>
                  handleFieldChange('total', parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md font-semibold">
                €{data.total?.toFixed(2) || '0.00'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Final Invoice Summary */}
      <div className="mt-6 border-t pt-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">
            📋 Final Invoice Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Invoice:</span>
              <p className="text-blue-900">
                {editedData?.invoiceNumber || 'Not specified'}
              </p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Customer:</span>
              <p className="text-blue-900">
                {editedData?.customerName || 'Not specified'}
              </p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Date:</span>
              <p className="text-blue-900">
                {editedData?.date || 'Not specified'}
              </p>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Total:</span>
              <p className="text-blue-900 font-semibold">
                €{(editedData?.total || 0).toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              💡 Review all the data above carefully. Once you&apos;re satisfied,
              click &quot;💾 Save Invoice&quot; to store this invoice in your system.
            </p>
          </div>
        </div>
      </div>

      {/* Raw Text Preview */}
      <div className="mt-6 border-t pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Raw Extracted Text</h4>
        <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
          <p className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
            {data.rawText}
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This is the raw text extracted by AWS Textract. You can use this to
          verify the extraction accuracy.
        </p>
      </div>
    </div>
  );
}
