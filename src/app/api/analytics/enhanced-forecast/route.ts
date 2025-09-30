import { EnhancedForecastingEngine } from '@/lib/forecasting/enhanced-forecasting-engine';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { historicalData, months = 12, confidenceLevel = 0.95 } = body;

    if (!historicalData || !Array.isArray(historicalData)) {
      return NextResponse.json(
        { error: 'Historical data is required and must be an array' },
        { status: 400 }
      );
    }

    const forecastingEngine = new EnhancedForecastingEngine();
    const enhancedForecast = await forecastingEngine.generateEnhancedForecast(
      historicalData,
      months,
      confidenceLevel
    );

    return NextResponse.json({
      success: true,
      data: enhancedForecast,
    });
  } catch (error) {
    console.error('Enhanced forecast API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate enhanced forecast',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Enhanced Forecasting API',
    endpoints: {
      POST: '/api/analytics/enhanced-forecast',
      description:
        'Generate enhanced forecast with ML, market data, and Monte Carlo simulations',
      parameters: {
        historicalData: 'Array of historical financial data',
        months: 'Number of months to forecast (default: 12)',
        confidenceLevel: 'Confidence level for intervals (default: 0.95)',
      },
    },
  });
}
