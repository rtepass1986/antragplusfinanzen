'use client';

import FinancialAnalyticsDashboard from '@/components/analytics/FinancialAnalyticsDashboard';
import TopNavigation from '@/components/layout/TopNavigation';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Financial Analytics
          </h1>
          <p className="mt-2 text-gray-600">
            Advanced financial analysis with machine learning forecasting and
            comprehensive metrics
          </p>
        </div>

        <FinancialAnalyticsDashboard />
      </div>
    </div>
  );
}
