import { FinancialAnalyticsEngine } from '@/lib/analytics/financial-analytics-engine';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { balanceSheet, incomeStatement, cashFlowData, forecastData } = body;

    if (!balanceSheet || !incomeStatement || !cashFlowData) {
      return NextResponse.json(
        {
          error:
            'Balance sheet, income statement, and cash flow data are required',
        },
        { status: 400 }
      );
    }

    const analyticsEngine = new FinancialAnalyticsEngine();
    const metrics = await analyticsEngine.calculateFinancialMetrics(
      balanceSheet,
      incomeStatement,
      cashFlowData,
      forecastData || []
    );

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Financial analytics API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate financial metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Financial Analytics API',
    endpoints: {
      POST: '/api/analytics/financial-metrics',
      description: 'Calculate comprehensive financial metrics and analytics',
      parameters: {
        balanceSheet: 'Balance sheet data with current assets and liabilities',
        incomeStatement: 'Array of income statement data',
        cashFlowData: 'Array of historical cash flow data',
        forecastData: 'Array of forecast data (optional)',
      },
    },
  });
}
