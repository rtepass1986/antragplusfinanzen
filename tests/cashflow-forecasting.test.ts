/**
 * CASH FLOW FORECASTING ENGINE TESTS
 * Tests AI-powered forecasting with seasonal adjustments
 */

import { CashFlowEngine } from '../src/lib/cashflow/engine';
import { prisma } from '../src/lib/prisma';

jest.mock('../src/lib/prisma');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('💰 Cash Flow Forecasting Engine', () => {
  let cashFlowEngine: CashFlowEngine;

  beforeEach(() => {
    cashFlowEngine = new CashFlowEngine();
    jest.clearAllMocks();
  });

  describe('Forecast Generation', () => {
    test('should generate 12-month forecast from historical data', async () => {
      const mockHistoricalData = [
        {
          date: new Date('2024-01-01'),
          inflow: 50000,
          outflow: 30000,
          netFlow: 20000,
          category: 'REVENUE'
        },
        {
          date: new Date('2024-02-01'),
          inflow: 55000,
          outflow: 32000,
          netFlow: 23000,
          category: 'REVENUE'
        },
        {
          date: new Date('2024-03-01'),
          inflow: 48000,
          outflow: 35000,
          netFlow: 13000,
          category: 'REVENUE'
        }
      ];

      const mockScenario = {
        id: 'scenario-1',
        name: 'Base Case',
        companyId: 'comp-1',
        assumptions: {
          growthRate: 0.05,
          seasonality: true,
          inflationRate: 0.03
        }
      };

      mockPrisma.transaction.findMany.mockResolvedValue(mockHistoricalData);
      mockPrisma.cashFlowScenario.findUnique.mockResolvedValue(mockScenario);
      mockPrisma.cashFlowForecast.createMany.mockResolvedValue({ count: 12 });

      const forecast = await cashFlowEngine.generateForecast('comp-1', 'scenario-1', 12);

      expect(forecast).toHaveLength(12);
      expect(forecast[0]).toHaveProperty('date');
      expect(forecast[0]).toHaveProperty('predictedInflow');
      expect(forecast[0]).toHaveProperty('predictedOutflow');
      expect(forecast[0]).toHaveProperty('netCashFlow');
      expect(forecast[0]).toHaveProperty('cumulativeBalance');
      expect(forecast[0].confidence).toBeGreaterThan(0.7);
    });

    test('should apply seasonal adjustments correctly', async () => {
      const mockData = Array.from({ length: 24 }, (_, i) => ({
        date: new Date(2023, i % 12, 1),
        inflow: 50000 + (i % 12 === 11 ? 20000 : 0), // December peak
        outflow: 30000,
        netFlow: 20000 + (i % 12 === 11 ? 20000 : 0),
        category: 'REVENUE'
      }));

      const mockScenario = {
        id: 'scenario-1',
        assumptions: { seasonality: true, growthRate: 0.02 }
      };

      mockPrisma.transaction.findMany.mockResolvedValue(mockData);
      mockPrisma.cashFlowScenario.findUnique.mockResolvedValue(mockScenario);
      mockPrisma.cashFlowForecast.createMany.mockResolvedValue({ count: 12 });

      const forecast = await cashFlowEngine.generateForecast('comp-1', 'scenario-1', 12);
      const decemberForecast = forecast.find(f => f.date.getMonth() === 11);

      expect(decemberForecast?.predictedInflow).toBeGreaterThan(
        forecast.find(f => f.date.getMonth() === 0)?.predictedInflow || 0
      );
    });

    test('should handle insufficient historical data', async () => {
      const mockLimitedData = [
        {
          date: new Date('2024-01-01'),
          inflow: 50000,
          outflow: 30000,
          netFlow: 20000,
          category: 'REVENUE'
        }
      ];

      const mockScenario = {
        id: 'scenario-1',
        assumptions: { growthRate: 0.05 }
      };

      mockPrisma.transaction.findMany.mockResolvedValue(mockLimitedData);
      mockPrisma.cashFlowScenario.findUnique.mockResolvedValue(mockScenario);

      const forecast = await cashFlowEngine.generateForecast('comp-1', 'scenario-1', 12);

      expect(forecast).toHaveLength(12);
      expect(forecast[0].confidence).toBeLessThan(0.6); // Lower confidence due to limited data
    });
  });

  describe('Scenario Modeling', () => {
    test('should create optimistic scenario', async () => {
      const mockBaseData = [
        { inflow: 50000, outflow: 30000, netFlow: 20000 }
      ];

      const optimisticScenario = {
        id: 'opt-1',
        name: 'Optimistic',
        assumptions: {
          growthRate: 0.15,
          revenueMultiplier: 1.2,
          costReduction: 0.1
        }
      };

      mockPrisma.transaction.findMany.mockResolvedValue(mockBaseData);
      mockPrisma.cashFlowScenario.findUnique.mockResolvedValue(optimisticScenario);
      mockPrisma.cashFlowForecast.createMany.mockResolvedValue({ count: 12 });

      const forecast = await cashFlowEngine.generateForecast('comp-1', 'opt-1', 6);

      expect(forecast[5].predictedInflow).toBeGreaterThan(
        forecast[0].predictedInflow * 1.5 // Should show significant growth
      );
    });

    test('should create pessimistic scenario', async () => {
      const mockBaseData = [
        { inflow: 50000, outflow: 30000, netFlow: 20000 }
      ];

      const pessimisticScenario = {
        id: 'pess-1',
        name: 'Pessimistic',
        assumptions: {
          growthRate: -0.05,
          revenueMultiplier: 0.8,
          costIncrease: 0.15
        }
      };

      mockPrisma.transaction.findMany.mockResolvedValue(mockBaseData);
      mockPrisma.cashFlowScenario.findUnique.mockResolvedValue(pessimisticScenario);
      mockPrisma.cashFlowForecast.createMany.mockResolvedValue({ count: 12 });

      const forecast = await cashFlowEngine.generateForecast('comp-1', 'pess-1', 6);

      expect(forecast[5].netCashFlow).toBeLessThan(forecast[0].netCashFlow);
    });

    test('should handle stress test scenarios', async () => {
      const stressScenario = {
        id: 'stress-1',
        name: 'Crisis Scenario',
        assumptions: {
          revenueShock: -0.5, // 50% revenue drop
          delayedPayments: 60, // 60-day payment delays
          emergencyExpenses: 100000
        }
      };

      mockPrisma.cashFlowScenario.findUnique.mockResolvedValue(stressScenario);
      mockPrisma.cashFlowForecast.createMany.mockResolvedValue({ count: 12 });

      const forecast = await cashFlowEngine.generateStressTest('comp-1', 'stress-1');

      expect(forecast.minimumBalance).toBeLessThan(0);
      expect(forecast.recoveryPeriod).toBeGreaterThan(6);
      expect(forecast.riskLevel).toBe('HIGH');
    });
  });

  describe('Cash Flow Categories', () => {
    test('should categorize cash flows correctly', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          amount: 50000,
          type: 'INFLOW',
          category: 'SALES',
          description: 'Invoice payment'
        },
        {
          id: 'tx-2',
          amount: -15000,
          type: 'OUTFLOW',
          category: 'SALARIES',
          description: 'Monthly payroll'
        },
        {
          id: 'tx-3',
          amount: -5000,
          type: 'OUTFLOW',
          category: 'MARKETING',
          description: 'Ad spend'
        }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const categorized = await cashFlowEngine.categorizeCashFlows('comp-1');

      expect(categorized.SALES.total).toBe(50000);
      expect(categorized.SALARIES.total).toBe(-15000);
      expect(categorized.MARKETING.total).toBe(-5000);
    });

    test('should track category trends over time', async () => {
      const mockCategoryHistory = [
        {
          month: '2024-01',
          category: 'SALES',
          amount: 45000
        },
        {
          month: '2024-02',
          category: 'SALES',
          amount: 50000
        },
        {
          month: '2024-03',
          category: 'SALES',
          amount: 55000
        }
      ];

      mockPrisma.transaction.groupBy.mockResolvedValue(mockCategoryHistory);

      const trends = await cashFlowEngine.analyzeCategoryTrends('comp-1', 'SALES');

      expect(trends.growthRate).toBeGreaterThan(0);
      expect(trends.trend).toBe('INCREASING');
      expect(trends.volatility).toBeLessThan(0.2);
    });
  });

  describe('Liquidity Analysis', () => {
    test('should calculate liquidity ratios', async () => {
      const mockCurrentAssets = 150000;
      const mockCurrentLiabilities = 75000;
      const mockCashPosition = 50000;

      const mockBalanceSheet = {
        currentAssets: mockCurrentAssets,
        currentLiabilities: mockCurrentLiabilities,
        cash: mockCashPosition
      };

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        balanceSheet: mockBalanceSheet
      });

      const liquidity = await cashFlowEngine.analyzeLiquidity('comp-1');

      expect(liquidity.currentRatio).toBe(2.0); // 150k / 75k
      expect(liquidity.quickRatio).toBeGreaterThan(0.5);
      expect(liquidity.cashRatio).toBeCloseTo(0.67, 1); // 50k / 75k
      expect(liquidity.riskLevel).toBe('LOW');
    });

    test('should identify liquidity warnings', async () => {
      const mockLowLiquidity = {
        currentAssets: 30000,
        currentLiabilities: 50000,
        cash: 5000
      };

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        balanceSheet: mockLowLiquidity
      });

      const liquidity = await cashFlowEngine.analyzeLiquidity('comp-1');

      expect(liquidity.currentRatio).toBeLessThan(1.0);
      expect(liquidity.riskLevel).toBe('HIGH');
      expect(liquidity.warnings).toContain('LOW_CURRENT_RATIO');
    });

    test('should predict cash runway', async () => {
      const mockCurrentCash = 100000;
      const mockMonthlyBurn = -15000;

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        currentCash: mockCurrentCash
      });

      const avgBurn = await cashFlowEngine.calculateAverageBurnRate('comp-1');
      const runway = mockCurrentCash / Math.abs(avgBurn);

      expect(runway).toBeCloseTo(6.67, 1); // ~6.7 months runway
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate forecast accuracy', async () => {
      const mockForecasts = [
        { predicted: 50000, actual: 52000, date: '2024-01' },
        { predicted: 55000, actual: 54000, date: '2024-02' },
        { predicted: 48000, actual: 47000, date: '2024-03' }
      ];

      const accuracy = cashFlowEngine.calculateForecastAccuracy(mockForecasts);

      expect(accuracy.meanAbsoluteError).toBeLessThan(3000);
      expect(accuracy.meanAbsolutePercentageError).toBeLessThan(0.05); // < 5%
      expect(accuracy.overallAccuracy).toBeGreaterThan(0.95); // > 95%
    });

    test('should benchmark against industry standards', async () => {
      const mockCompanyMetrics = {
        cashConversionCycle: 45,
        daysPayableOutstanding: 30,
        daysReceivableOutstanding: 40
      };

      const mockIndustryBenchmarks = {
        avgCashConversionCycle: 50,
        avgDPO: 35,
        avgDRO: 45
      };

      const benchmark = await cashFlowEngine.benchmarkPerformance(
        'comp-1',
        mockCompanyMetrics,
        mockIndustryBenchmarks
      );

      expect(benchmark.cashConversionCycle.performance).toBe('ABOVE_AVERAGE');
      expect(benchmark.overallScore).toBeGreaterThan(70);
    });
  });
});

export default {};