'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CategoryData {
  name: string;
  value: number;
  color: string;
  subcategories?: SubCategoryData[];
}

interface SubCategoryData {
  name: string;
  value: number;
  transactions?: TransactionData[];
}

interface TransactionData {
  id: string;
  description: string;
  amount: number;
  date: string;
  vendor?: string;
}

interface DrillDownChartProps {
  data: CategoryData[];
  title?: string;
  subtitle?: string;
}

export default function DrillDownChart({
  data,
  title = 'Ausgaben nach Kategorie',
  subtitle = 'Klicken Sie auf eine Kategorie für Details',
}: DrillDownChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(
    null
  );
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<SubCategoryData | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleCategoryClick = (category: CategoryData) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setBreadcrumb([category.name]);
  };

  const handleSubcategoryClick = (subcategory: SubCategoryData) => {
    setSelectedSubcategory(subcategory);
    setBreadcrumb([...breadcrumb, subcategory.name]);
  };

  const handleBackClick = () => {
    if (selectedSubcategory) {
      setSelectedSubcategory(null);
      setBreadcrumb(breadcrumb.slice(0, -1));
    } else if (selectedCategory) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setBreadcrumb([]);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {payload[0].payload.name}
          </p>
          <p className="text-lg font-bold text-blue-600 mt-1">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const getCurrentData = () => {
    if (selectedSubcategory?.transactions) {
      return selectedSubcategory.transactions.map(t => ({
        name:
          t.description.length > 20
            ? t.description.substring(0, 20) + '...'
            : t.description,
        value: t.amount,
      }));
    }
    if (selectedCategory?.subcategories) {
      return selectedCategory.subcategories.map(sc => ({
        name: sc.name,
        value: sc.value,
      }));
    }
    return data.map(d => ({
      name: d.name,
      value: d.value,
      color: d.color,
    }));
  };

  const currentData = getCurrentData();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackClick}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Zurück
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Alle</span>
              {breadcrumb.map((item, index) => (
                <span key={index} className="flex items-center gap-2">
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-900 font-medium">{item}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={currentData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          onClick={(data: any) => {
            if (!data || !data.activePayload) return;
            const clickedItem = data.activePayload[0].payload;

            if (!selectedCategory) {
              const category = data.find(d => d.name === clickedItem.name);
              if (category) handleCategoryClick(category);
            } else if (!selectedSubcategory && selectedCategory.subcategories) {
              const subcategory = selectedCategory.subcategories.find(
                sc => sc.name === clickedItem.name
              );
              if (subcategory) handleSubcategoryClick(subcategory);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
            stroke="#9CA3AF"
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12 }}
            stroke="#9CA3AF"
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
          />
          <Legend />
          <Bar
            dataKey="value"
            fill="#3B82F6"
            name="Betrag"
            radius={[8, 8, 0, 0]}
            cursor="pointer"
          >
            {currentData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || '#3B82F6'}
                className="hover:opacity-80 transition-opacity"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Transaction Details Table */}
      {selectedSubcategory?.transactions && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Transaktionen ({selectedSubcategory.transactions.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Datum
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Beschreibung
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Anbieter
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Betrag
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedSubcategory.transactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600">
                      {new Date(transaction.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="py-2 px-3 text-gray-900">
                      {transaction.description}
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {transaction.vendor || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300">
                <tr>
                  <td
                    colSpan={3}
                    className="py-2 px-3 font-semibold text-gray-900"
                  >
                    Gesamt
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-gray-900">
                    {formatCurrency(selectedSubcategory.value)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-200 pt-6">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600 mb-1">Kategorien</p>
          <p className="text-2xl font-bold text-gray-900">
            {!selectedCategory
              ? data.length
              : selectedCategory.subcategories?.length || 0}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600 mb-1">Gesamt</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(currentData.reduce((sum, d) => sum + d.value, 0))}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600 mb-1">Durchschnitt</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(
              currentData.reduce((sum, d) => sum + d.value, 0) /
                currentData.length
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
