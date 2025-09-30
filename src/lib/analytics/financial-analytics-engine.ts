export interface FinancialMetrics {
  cashRunway: {
    months: number;
    days: number;
    confidence: number;
    burnRate: number;
    currentCash: number;
  };
  liquidityRatios: {
    currentRatio: number;
    quickRatio: number;
    cashRatio: number;
    interpretation: string;
  };
  workingCapital: {
    current: number;
    optimal: number;
    efficiency: number;
    recommendations: string[];
  };
  cashConversionCycle: {
    days: number;
    components: {
      daysSalesOutstanding: number;
      daysInventoryOutstanding: number;
      daysPayableOutstanding: number;
    };
    trend: 'improving' | 'stable' | 'declining';
  };
  varianceAnalysis: {
    actual: number[];
    forecast: number[];
    variance: number[];
    variancePercentage: number[];
    significantVariances: Array<{
      period: string;
      actual: number;
      forecast: number;
      variance: number;
      percentage: number;
    }>;
  };
}

export interface BalanceSheetData {
  currentAssets: {
    cash: number;
    accountsReceivable: number;
    inventory: number;
    other: number;
  };
  currentLiabilities: {
    accountsPayable: number;
    shortTermDebt: number;
    other: number;
  };
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
}

export interface IncomeStatementData {
  revenue: number;
  costOfGoodsSold: number;
  operatingExpenses: number;
  netIncome: number;
  period: string;
}

export class FinancialAnalyticsEngine {
  /**
   * Calculate comprehensive financial metrics
   */
  async calculateFinancialMetrics(
    balanceSheet: BalanceSheetData,
    incomeStatement: IncomeStatementData[],
    cashFlowData: any[],
    forecastData: any[]
  ): Promise<FinancialMetrics> {
    console.log('📊 Calculating comprehensive financial metrics...');

    const cashRunway = this.calculateCashRunway(
      cashFlowData,
      balanceSheet.currentAssets.cash
    );
    const liquidityRatios = this.calculateLiquidityRatios(balanceSheet);
    const workingCapital = this.calculateWorkingCapitalOptimization(
      balanceSheet,
      incomeStatement
    );
    const cashConversionCycle = this.calculateCashConversionCycle(
      incomeStatement,
      balanceSheet
    );
    const varianceAnalysis = this.calculateVarianceAnalysis(
      cashFlowData,
      forecastData
    );

    return {
      cashRunway,
      liquidityRatios,
      workingCapital,
      cashConversionCycle,
      varianceAnalysis,
    };
  }

  /**
   * Calculate cash runway (how long current cash will last)
   */
  private calculateCashRunway(
    cashFlowData: any[],
    currentCash: number
  ): {
    months: number;
    days: number;
    confidence: number;
    burnRate: number;
    currentCash: number;
  } {
    if (cashFlowData.length < 2) {
      return {
        months: 0,
        days: 0,
        confidence: 0,
        burnRate: 0,
        currentCash,
      };
    }

    // Calculate average monthly burn rate
    const monthlyFlows = this.calculateMonthlyFlows(cashFlowData);
    const burnRate = this.calculateBurnRate(monthlyFlows);

    // Calculate confidence based on data consistency
    const confidence = this.calculateBurnRateConfidence(monthlyFlows);

    // Calculate runway
    const months = burnRate > 0 ? currentCash / burnRate : Infinity;
    const days = months * 30.44; // Average days per month

    return {
      months: Math.max(0, months),
      days: Math.max(0, days),
      confidence,
      burnRate,
      currentCash,
    };
  }

  /**
   * Calculate liquidity ratios
   */
  private calculateLiquidityRatios(balanceSheet: BalanceSheetData): {
    currentRatio: number;
    quickRatio: number;
    cashRatio: number;
    interpretation: string;
  } {
    const currentAssets =
      balanceSheet.currentAssets.cash +
      balanceSheet.currentAssets.accountsReceivable +
      balanceSheet.currentAssets.inventory +
      balanceSheet.currentAssets.other;

    const currentLiabilities =
      balanceSheet.currentLiabilities.accountsPayable +
      balanceSheet.currentLiabilities.shortTermDebt +
      balanceSheet.currentLiabilities.other;

    const currentRatio =
      currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickRatio =
      currentLiabilities > 0
        ? (balanceSheet.currentAssets.cash +
            balanceSheet.currentAssets.accountsReceivable) /
          currentLiabilities
        : 0;
    const cashRatio =
      currentLiabilities > 0
        ? balanceSheet.currentAssets.cash / currentLiabilities
        : 0;

    const interpretation = this.interpretLiquidityRatios(
      currentRatio,
      quickRatio,
      cashRatio
    );

    return {
      currentRatio,
      quickRatio,
      cashRatio,
      interpretation,
    };
  }

  /**
   * Calculate working capital optimization
   */
  private calculateWorkingCapitalOptimization(
    balanceSheet: BalanceSheetData,
    incomeStatement: IncomeStatementData[]
  ): {
    current: number;
    optimal: number;
    efficiency: number;
    recommendations: string[];
  } {
    const currentWorkingCapital =
      balanceSheet.currentAssets.cash +
      balanceSheet.currentAssets.accountsReceivable +
      balanceSheet.currentAssets.inventory -
      (balanceSheet.currentLiabilities.accountsPayable +
        balanceSheet.currentLiabilities.shortTermDebt);

    // Calculate optimal working capital based on industry benchmarks
    const annualRevenue = incomeStatement.reduce(
      (sum, stmt) => sum + stmt.revenue,
      0
    );
    const optimalWorkingCapital = annualRevenue * 0.15; // 15% of annual revenue as benchmark

    const efficiency =
      optimalWorkingCapital > 0
        ? currentWorkingCapital / optimalWorkingCapital
        : 1;

    const recommendations = this.generateWorkingCapitalRecommendations(
      currentWorkingCapital,
      optimalWorkingCapital,
      efficiency,
      balanceSheet
    );

    return {
      current: currentWorkingCapital,
      optimal: optimalWorkingCapital,
      efficiency,
      recommendations,
    };
  }

  /**
   * Calculate cash conversion cycle
   */
  private calculateCashConversionCycle(
    incomeStatement: IncomeStatementData[],
    balanceSheet: BalanceSheetData
  ): {
    days: number;
    components: {
      daysSalesOutstanding: number;
      daysInventoryOutstanding: number;
      daysPayableOutstanding: number;
    };
    trend: 'improving' | 'stable' | 'declining';
  } {
    const annualRevenue = incomeStatement.reduce(
      (sum, stmt) => sum + stmt.revenue,
      0
    );
    const annualCOGS = incomeStatement.reduce(
      (sum, stmt) => sum + stmt.costOfGoodsSold,
      0
    );
    const annualPurchases = annualCOGS; // Simplified assumption

    // Days Sales Outstanding (DSO)
    const avgAccountsReceivable = balanceSheet.currentAssets.accountsReceivable;
    const daysSalesOutstanding =
      annualRevenue > 0 ? (avgAccountsReceivable / annualRevenue) * 365 : 0;

    // Days Inventory Outstanding (DIO)
    const avgInventory = balanceSheet.currentAssets.inventory;
    const daysInventoryOutstanding =
      annualCOGS > 0 ? (avgInventory / annualCOGS) * 365 : 0;

    // Days Payable Outstanding (DPO)
    const avgAccountsPayable = balanceSheet.currentLiabilities.accountsPayable;
    const daysPayableOutstanding =
      annualPurchases > 0 ? (avgAccountsPayable / annualPurchases) * 365 : 0;

    const cashConversionCycle =
      daysSalesOutstanding + daysInventoryOutstanding - daysPayableOutstanding;

    const trend = this.calculateCashConversionTrend(
      incomeStatement,
      balanceSheet
    );

    return {
      days: Math.max(0, cashConversionCycle),
      components: {
        daysSalesOutstanding,
        daysInventoryOutstanding,
        daysPayableOutstanding,
      },
      trend,
    };
  }

  /**
   * Calculate variance analysis between actual and forecast
   */
  private calculateVarianceAnalysis(
    actualData: any[],
    forecastData: any[]
  ): {
    actual: number[];
    forecast: number[];
    variance: number[];
    variancePercentage: number[];
    significantVariances: Array<{
      period: string;
      actual: number;
      forecast: number;
      variance: number;
      percentage: number;
    }>;
  } {
    const actual = actualData.map(d => d.amount || 0);
    const forecast = forecastData.map(d => d.amount || 0);

    const variance = actual.map(
      (actualVal, index) => actualVal - (forecast[index] || 0)
    );
    const variancePercentage = actual.map((actualVal, index) => {
      const forecastVal = forecast[index] || 0;
      return forecastVal !== 0 ? (variance[index] / forecastVal) * 100 : 0;
    });

    // Identify significant variances (>10% or >$10,000)
    const significantVariances = actual
      .map((actualVal, index) => {
        const forecastVal = forecast[index] || 0;
        const varianceAmount = variance[index];
        const variancePct = variancePercentage[index];

        return {
          period: actualData[index]?.date || `Period ${index + 1}`,
          actual: actualVal,
          forecast: forecastVal,
          variance: varianceAmount,
          percentage: variancePct,
        };
      })
      .filter(v => Math.abs(v.percentage) > 10 || Math.abs(v.variance) > 10000);

    return {
      actual,
      forecast,
      variance,
      variancePercentage,
      significantVariances,
    };
  }

  // Helper methods
  private calculateMonthlyFlows(cashFlowData: any[]): number[] {
    const monthlyFlows: { [key: string]: number } = {};

    cashFlowData.forEach(entry => {
      const month = new Date(entry.date).toISOString().substring(0, 7); // YYYY-MM
      monthlyFlows[month] = (monthlyFlows[month] || 0) + (entry.amount || 0);
    });

    return Object.values(monthlyFlows);
  }

  private calculateBurnRate(monthlyFlows: number[]): number {
    if (monthlyFlows.length < 2) return 0;

    // Calculate average monthly burn (negative cash flow)
    const negativeFlows = monthlyFlows.filter(flow => flow < 0);
    return negativeFlows.length > 0
      ? negativeFlows.reduce((sum, flow) => sum + Math.abs(flow), 0) /
          negativeFlows.length
      : 0;
  }

  private calculateBurnRateConfidence(monthlyFlows: number[]): number {
    if (monthlyFlows.length < 3) return 0.5;

    // Calculate coefficient of variation
    const mean =
      monthlyFlows.reduce((sum, flow) => sum + flow, 0) / monthlyFlows.length;
    const variance =
      monthlyFlows.reduce((sum, flow) => sum + Math.pow(flow - mean, 2), 0) /
      monthlyFlows.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation =
      mean !== 0 ? standardDeviation / Math.abs(mean) : 1;

    // Higher confidence with lower variation
    return Math.max(0, 1 - coefficientOfVariation);
  }

  private interpretLiquidityRatios(
    currentRatio: number,
    quickRatio: number,
    cashRatio: number
  ): string {
    if (currentRatio < 1) {
      return '⚠️ Low liquidity - may struggle to meet short-term obligations';
    } else if (currentRatio < 2) {
      return '⚠️ Moderate liquidity - monitor cash flow closely';
    } else if (currentRatio < 3) {
      return '✅ Good liquidity - healthy short-term financial position';
    } else {
      return '✅ Excellent liquidity - very strong short-term financial position';
    }
  }

  private generateWorkingCapitalRecommendations(
    current: number,
    optimal: number,
    efficiency: number,
    balanceSheet: BalanceSheetData
  ): string[] {
    const recommendations: string[] = [];

    if (efficiency < 0.8) {
      recommendations.push(
        '📉 Working capital is below optimal. Consider increasing cash reserves or reducing short-term debt.'
      );
    } else if (efficiency > 1.5) {
      recommendations.push(
        '📈 Working capital is above optimal. Consider investing excess cash or paying down debt.'
      );
    }

    if (
      balanceSheet.currentAssets.accountsReceivable >
      balanceSheet.currentAssets.cash * 2
    ) {
      recommendations.push(
        '💳 High accounts receivable. Implement stricter credit policies or improve collection processes.'
      );
    }

    if (
      balanceSheet.currentAssets.inventory > balanceSheet.currentAssets.cash
    ) {
      recommendations.push(
        '📦 High inventory levels. Consider inventory optimization or just-in-time purchasing.'
      );
    }

    return recommendations;
  }

  private calculateCashConversionTrend(
    incomeStatement: IncomeStatementData[],
    balanceSheet: BalanceSheetData
  ): 'improving' | 'stable' | 'declining' {
    // Simplified trend calculation based on recent performance
    // In production, this would analyze historical data
    const recentRevenue = incomeStatement
      .slice(-3)
      .reduce((sum, stmt) => sum + stmt.revenue, 0);
    const olderRevenue = incomeStatement
      .slice(-6, -3)
      .reduce((sum, stmt) => sum + stmt.revenue, 0);

    if (recentRevenue > olderRevenue * 1.1) return 'improving';
    if (recentRevenue < olderRevenue * 0.9) return 'declining';
    return 'stable';
  }
}
