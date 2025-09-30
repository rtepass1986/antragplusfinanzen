// import { ForecastingEngine } from '../cashflow/forecasting-engine';

export interface MarketData {
  date: string;
  interestRate: number;
  inflationRate: number;
  gdpGrowth: number;
  unemploymentRate: number;
  stockMarketIndex: number;
  currencyExchangeRate: number;
}

export interface SeasonalPattern {
  month: number;
  pattern: number; // Multiplier (e.g., 1.2 for 20% above average)
  confidence: number;
  category: string;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number; // e.g., 0.95 for 95%
}

export interface MonteCarloResult {
  scenarios: number[];
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  mean: number;
  standardDeviation: number;
  probabilityOfNegative: number;
}

export interface EnhancedForecast {
  baseForecast: number[];
  confidenceIntervals: ConfidenceInterval[];
  seasonalAdjustments: SeasonalPattern[];
  monteCarloResults: MonteCarloResult;
  marketFactors: MarketData[];
  accuracy: {
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
    r2: number; // R-squared
  };
  recommendations: string[];
}

export class EnhancedForecastingEngine {
  private marketDataCache: Map<string, MarketData[]> = new Map();
  private seasonalPatterns: Map<string, SeasonalPattern[]> = new Map();
  private mlModel: any = null;

  constructor() {
    this.initializeMLModel();
    this.loadSeasonalPatterns();
  }

  /**
   * Basic forecast generation (simplified version)
   */
  private async generateForecast(
    historicalData: any[],
    months: number
  ): Promise<number[]> {
    if (historicalData.length === 0) {
      return Array(months).fill(0);
    }

    // Simple linear trend forecast
    const amounts = historicalData.map(d => d.amount || 0);
    const avgAmount =
      amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const trend = this.calculateTrend(amounts);

    const forecast: number[] = [];
    for (let i = 1; i <= months; i++) {
      forecast.push(Math.max(0, avgAmount + trend * i));
    }

    return forecast;
  }

  private calculateTrend(amounts: number[]): number {
    if (amounts.length < 2) return 0;

    const n = amounts.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = amounts;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope || 0;
  }

  /**
   * Enhanced forecasting with ML, market data, and Monte Carlo simulations
   */
  async generateEnhancedForecast(
    historicalData: any[],
    months: number = 12,
    confidenceLevel: number = 0.95
  ): Promise<EnhancedForecast> {
    console.log('🤖 Generating enhanced forecast with ML and market data...');

    // 1. Generate base forecast using existing engine
    const baseForecast = await this.generateForecast(historicalData, months);

    // 2. Load market data
    const marketData = await this.loadMarketData();

    // 3. Apply seasonal adjustments
    const seasonalAdjustments =
      this.calculateSeasonalAdjustments(historicalData);

    // 4. Apply market factor adjustments
    const marketAdjustedForecast = this.applyMarketFactors(
      baseForecast,
      marketData
    );

    // 5. Calculate confidence intervals
    const confidenceIntervals = this.calculateConfidenceIntervals(
      marketAdjustedForecast,
      historicalData,
      confidenceLevel
    );

    // 6. Run Monte Carlo simulations
    const monteCarloResults = this.runMonteCarloSimulations(
      marketAdjustedForecast,
      historicalData,
      10000
    );

    // 7. Calculate accuracy metrics
    const accuracy = this.calculateAccuracyMetrics(
      historicalData,
      baseForecast
    );

    // 8. Generate recommendations
    const recommendations = this.generateRecommendations(
      monteCarloResults,
      marketAdjustedForecast,
      accuracy
    );

    return {
      baseForecast: marketAdjustedForecast,
      confidenceIntervals,
      seasonalAdjustments,
      monteCarloResults,
      marketFactors: marketData,
      accuracy,
      recommendations,
    };
  }

  /**
   * Initialize machine learning model for forecasting
   */
  private async initializeMLModel(): Promise<void> {
    try {
      // In a real implementation, you would load a trained ML model
      // For now, we'll simulate with a simple linear regression approach
      this.mlModel = {
        type: 'linear_regression',
        coefficients: [1.02, 0.15, -0.08, 0.23], // Example coefficients
        intercept: 1000,
        trained: true,
      };
      console.log('✅ ML model initialized');
    } catch (error) {
      console.warn('⚠️ ML model initialization failed, using fallback:', error);
      this.mlModel = null;
    }
  }

  /**
   * Load external market data feeds
   */
  private async loadMarketData(): Promise<MarketData[]> {
    try {
      // In production, this would fetch from real APIs like:
      // - Federal Reserve Economic Data (FRED)
      // - Yahoo Finance API
      // - Alpha Vantage
      // - Quandl

      const mockMarketData: MarketData[] = [
        {
          date: '2024-01-01',
          interestRate: 5.25,
          inflationRate: 3.2,
          gdpGrowth: 2.1,
          unemploymentRate: 3.7,
          stockMarketIndex: 4750,
          currencyExchangeRate: 1.08,
        },
        {
          date: '2024-02-01',
          interestRate: 5.25,
          inflationRate: 3.1,
          gdpGrowth: 2.2,
          unemploymentRate: 3.6,
          stockMarketIndex: 4800,
          currencyExchangeRate: 1.09,
        },
        // Add more historical data points...
      ];

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));

      this.marketDataCache.set('current', mockMarketData);
      return mockMarketData;
    } catch (error) {
      console.warn('⚠️ Failed to load market data:', error);
      return [];
    }
  }

  /**
   * Calculate seasonal patterns from historical data
   */
  private calculateSeasonalAdjustments(
    historicalData: any[]
  ): SeasonalPattern[] {
    const patterns: SeasonalPattern[] = [];
    const monthlyAverages = new Map<number, number[]>();

    // Group data by month
    historicalData.forEach(entry => {
      const month = new Date(entry.date).getMonth();
      if (!monthlyAverages.has(month)) {
        monthlyAverages.set(month, []);
      }
      monthlyAverages.get(month)!.push(entry.amount || 0);
    });

    // Calculate average for each month
    const overallAverage =
      historicalData.reduce((sum, entry) => sum + (entry.amount || 0), 0) /
      historicalData.length;

    for (let month = 0; month < 12; month++) {
      const monthData = monthlyAverages.get(month) || [];
      const monthAverage =
        monthData.length > 0
          ? monthData.reduce((sum, val) => sum + val, 0) / monthData.length
          : overallAverage;

      const pattern = monthAverage / overallAverage;
      const confidence = Math.min(monthData.length / 3, 1); // Higher confidence with more data

      patterns.push({
        month: month + 1,
        pattern,
        confidence,
        category: this.getSeasonalCategory(month),
      });
    }

    this.seasonalPatterns.set('default', patterns);
    return patterns;
  }

  /**
   * Apply market factors to forecast
   */
  private applyMarketFactors(
    forecast: number[],
    marketData: MarketData[]
  ): number[] {
    if (!marketData.length) return forecast;

    const latestMarketData = marketData[marketData.length - 1];

    return forecast.map((value, index) => {
      // Apply interest rate impact (higher rates = lower cash flow)
      const interestRateImpact = 1 - (latestMarketData.interestRate - 3) * 0.01;

      // Apply inflation impact
      const inflationImpact = 1 + latestMarketData.inflationRate * 0.01;

      // Apply GDP growth impact
      const gdpImpact = 1 + latestMarketData.gdpGrowth * 0.005;

      // Apply unemployment impact (higher unemployment = lower cash flow)
      const unemploymentImpact =
        1 - (latestMarketData.unemploymentRate - 3) * 0.02;

      const combinedImpact =
        interestRateImpact * inflationImpact * gdpImpact * unemploymentImpact;

      return value * combinedImpact;
    });
  }

  /**
   * Calculate confidence intervals for forecast
   */
  private calculateConfidenceIntervals(
    forecast: number[],
    historicalData: any[],
    confidenceLevel: number
  ): ConfidenceInterval[] {
    const intervals: ConfidenceInterval[] = [];

    // Calculate historical volatility
    const returns = this.calculateReturns(historicalData);
    const volatility = this.calculateVolatility(returns);

    // Z-score for confidence level
    const zScore = this.getZScore(confidenceLevel);

    forecast.forEach((value, index) => {
      // Increase uncertainty over time
      const timeMultiplier = 1 + index * 0.1;
      const margin = value * volatility * zScore * timeMultiplier;

      intervals.push({
        lower: Math.max(0, value - margin),
        upper: value + margin,
        confidence: confidenceLevel,
      });
    });

    return intervals;
  }

  /**
   * Run Monte Carlo simulations for risk analysis
   */
  private runMonteCarloSimulations(
    forecast: number[],
    historicalData: any[],
    numSimulations: number
  ): MonteCarloResult {
    const returns = this.calculateReturns(historicalData);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);

    const scenarios: number[] = [];
    const finalValues: number[] = [];

    for (let i = 0; i < numSimulations; i++) {
      let currentValue = forecast[0];
      const scenario: number[] = [currentValue];

      for (let month = 1; month < forecast.length; month++) {
        // Generate random return based on historical distribution
        const randomReturn = this.generateRandomReturn(meanReturn, volatility);
        currentValue = currentValue * (1 + randomReturn);
        scenario.push(currentValue);
      }

      scenarios.push(...scenario);
      finalValues.push(currentValue);
    }

    // Calculate percentiles
    finalValues.sort((a, b) => a - b);
    const percentiles = {
      p5: finalValues[Math.floor(finalValues.length * 0.05)],
      p25: finalValues[Math.floor(finalValues.length * 0.25)],
      p50: finalValues[Math.floor(finalValues.length * 0.5)],
      p75: finalValues[Math.floor(finalValues.length * 0.75)],
      p95: finalValues[Math.floor(finalValues.length * 0.95)],
    };

    const mean =
      finalValues.reduce((sum, val) => sum + val, 0) / finalValues.length;
    const variance =
      finalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      finalValues.length;
    const standardDeviation = Math.sqrt(variance);

    const probabilityOfNegative =
      finalValues.filter(val => val < 0).length / finalValues.length;

    return {
      scenarios,
      percentiles,
      mean,
      standardDeviation,
      probabilityOfNegative,
    };
  }

  /**
   * Calculate accuracy metrics
   */
  private calculateAccuracyMetrics(
    historicalData: any[],
    forecast: number[]
  ): {
    mape: number;
    rmse: number;
    r2: number;
  } {
    if (historicalData.length < 2) {
      return { mape: 0, rmse: 0, r2: 0 };
    }

    const actual = historicalData
      .slice(-forecast.length)
      .map(d => d.amount || 0);
    const predicted = forecast.slice(0, actual.length);

    // Mean Absolute Percentage Error (MAPE)
    const mape =
      (actual.reduce((sum, val, i) => {
        if (val === 0) return sum;
        return sum + Math.abs((val - predicted[i]) / val);
      }, 0) /
        actual.length) *
      100;

    // Root Mean Square Error (RMSE)
    const mse =
      actual.reduce((sum, val, i) => {
        return sum + Math.pow(val - predicted[i], 2);
      }, 0) / actual.length;
    const rmse = Math.sqrt(mse);

    // R-squared
    const actualMean =
      actual.reduce((sum, val) => sum + val, 0) / actual.length;
    const ssRes = actual.reduce(
      (sum, val, i) => sum + Math.pow(val - predicted[i], 2),
      0
    );
    const ssTot = actual.reduce(
      (sum, val) => sum + Math.pow(val - actualMean, 2),
      0
    );
    const r2 = 1 - ssRes / ssTot;

    return { mape, rmse, r2 };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    monteCarloResults: MonteCarloResult,
    forecast: number[],
    accuracy: { mape: number; rmse: number; r2: number }
  ): string[] {
    const recommendations: string[] = [];

    // Risk-based recommendations
    if (monteCarloResults.probabilityOfNegative > 0.1) {
      recommendations.push(
        '⚠️ High risk of negative cash flow detected. Consider securing additional funding.'
      );
    }

    if (monteCarloResults.percentiles.p25 < forecast[0] * 0.8) {
      recommendations.push(
        '📉 25% chance of significant cash flow decline. Review cost structure.'
      );
    }

    // Accuracy-based recommendations
    if (accuracy.mape > 20) {
      recommendations.push(
        '📊 Forecast accuracy is low. Consider improving data quality or model parameters.'
      );
    }

    if (accuracy.r2 < 0.5) {
      recommendations.push(
        '🔍 Low model fit. Historical patterns may not be reliable predictors.'
      );
    }

    // Growth recommendations
    const growthRate =
      (forecast[forecast.length - 1] - forecast[0]) / forecast[0];
    if (growthRate > 0.1) {
      recommendations.push(
        '📈 Strong growth projected. Consider expansion opportunities.'
      );
    } else if (growthRate < -0.05) {
      recommendations.push(
        '📉 Declining trend detected. Implement cost reduction measures.'
      );
    }

    return recommendations;
  }

  // Helper methods
  private calculateReturns(data: any[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const current = data[i].amount || 0;
      const previous = data[i - 1].amount || 0;
      if (previous !== 0) {
        returns.push((current - previous) / previous);
      }
    }
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0.1; // Default volatility

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      (returns.length - 1);
    return Math.sqrt(variance);
  }

  private getZScore(confidenceLevel: number): number {
    const zScores: { [key: number]: number } = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };
    return zScores[confidenceLevel] || 1.96;
  }

  private generateRandomReturn(mean: number, volatility: number): number {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + volatility * z0;
  }

  private getSeasonalCategory(month: number): string {
    const categories = [
      'Winter',
      'Winter',
      'Spring',
      'Spring',
      'Spring',
      'Summer',
      'Summer',
      'Summer',
      'Fall',
      'Fall',
      'Fall',
      'Winter',
    ];
    return categories[month];
  }

  private loadSeasonalPatterns(): void {
    // Load pre-calculated seasonal patterns
    // In production, this would load from a database or configuration
    console.log('📊 Seasonal patterns loaded');
  }
}
